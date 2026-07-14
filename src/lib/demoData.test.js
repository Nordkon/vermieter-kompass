import test from 'node:test';
import assert from 'node:assert/strict';

import {
  demoAccountEntries,
  demoCategories,
  demoContacts,
  demoDocuments,
  demoProperties,
  demoRecurringRules,
  demoTenancies,
  demoTenancyParties,
  demoTransactions,
  demoUnits,
} from '../data/demoData.js';
import { linkedTenantPaymentIsConsistent } from './paymentLink.js';

test('geprüfter Musterbestand bildet den Terra-Endstand vollständig ab', () => {
  assert.equal(demoCategories.length, 43);
  assert.equal(demoProperties.length, 1);
  assert.equal(demoUnits.length, 1);
  assert.equal(demoContacts.length, 2);
  assert.equal(demoTenancies.length, 1);
  assert.equal(demoTenancyParties.length, 2);
  assert.equal(demoRecurringRules.length, 2);
  assert.equal(demoAccountEntries.length, 38);

  const debit = demoAccountEntries
    .filter((entry) => entry.side === 'debit')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const credit = demoAccountEntries
    .filter((entry) => entry.side === 'credit')
    .reduce((sum, entry) => sum + entry.amount, 0);
  assert.equal(debit, 11700);
  assert.equal(credit, 11580);
  assert.equal(debit - credit, 120);

  const costs = demoTransactions.filter((transaction) => transaction.kind === 'expense');
  const allocatableCosts = costs
    .filter((transaction) => transaction.allocatable)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const ownerCosts = costs
    .filter((transaction) => !transaction.allocatable)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  assert.equal(costs.length, 5);
  assert.equal(allocatableCosts, 2400);
  assert.equal(ownerCosts, 165);

  const payments = demoAccountEntries.filter((entry) => entry.entryType === 'payment');
  assert.equal(payments.length, 13);
  for (const payment of payments) {
    const transaction = demoTransactions.find((item) => item.id === payment.transactionId);
    assert.ok(transaction);
    assert.equal(transaction.accountEntryId, payment.id);
    assert.equal(transaction.amount, payment.amount);
    assert.equal(transaction.date, payment.bookingDate);
    assert.equal(linkedTenantPaymentIsConsistent(payment, transaction), true);
  }

  assert.equal(demoDocuments.length, 5);
  for (const document of demoDocuments) {
    assert.match(document.dataUrl, /^\.\/sample-receipts\/.+\.pdf$/);
    assert.ok(demoTransactions.some((transaction) => transaction.id === document.ownerId));
  }
});

test('Musterobjekt trennt Planwerte und Vertragswerte', () => {
  assert.equal(demoUnits[0].targetColdRent, 750);
  assert.equal(demoUnits[0].targetUtilityAdvance, 180);
  assert.equal(demoTenancies[0].coldRent, 775);
  assert.equal(demoTenancies[0].utilityAdvance, 190);
  assert.equal(demoTenancies[0].depositAgreed, 2325);
});
