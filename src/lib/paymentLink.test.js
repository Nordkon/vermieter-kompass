import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLinkedTenantPayment,
  isLinkedTenantPaymentTransaction,
  linkedTenantPaymentIsConsistent,
  voidLinkedTenantPayment,
} from './paymentLink.js';

test('Mietzahlung erzeugt eine betrags- und datumsgleiche bidirektionale Einnahme', () => {
  const linked = buildLinkedTenantPayment({
    entry: {
      tenancyId: 't1', entryType: 'payment', amount: 965,
      bookingDate: '2026-08-05', description: 'Mietzahlung August',
    },
    tenancy: { id: 't1', unitId: 'u1' },
    unit: { id: 'u1', propertyId: 'p1' },
    token: 'fixed-token',
  });
  assert.equal(linked.accountEntry.transactionId, linked.transaction.id);
  assert.equal(linked.transaction.accountEntryId, linked.accountEntry.id);
  assert.equal(linked.transaction.kind, 'income');
  assert.equal(linkedTenantPaymentIsConsistent(linked.accountEntry, linked.transaction), true);
  assert.equal(isLinkedTenantPaymentTransaction(linked.transaction), true);

  const remaining = voidLinkedTenantPayment({
    accountEntry: linked.accountEntry,
    accountEntries: [{ id: 'other-account' }, linked.accountEntry],
    transactions: [linked.transaction, { id: 'other-transaction' }],
  });
  assert.deepEqual(remaining.accountEntries.map((entry) => entry.id), ['other-account']);
  assert.deepEqual(remaining.transactions.map((transaction) => transaction.id), ['other-transaction']);
});

test('Korrektur wird nicht als Zahlungstransaktion materialisiert', () => {
  assert.throws(() => buildLinkedTenantPayment({
    entry: { tenancyId: 't1', entryType: 'correction', amount: 0, bookingDate: '2026-08-05' },
    tenancy: { id: 't1' }, token: 'broken',
  }), /Mietzahlung benötigt/);
  assert.equal(isLinkedTenantPaymentTransaction({ sourceType: 'manual' }), false);
});

test('Widersprüchliche Zahlung wird nicht halb storniert', () => {
  const accountEntries = [{
    id: 'account-1', tenancyId: 't1', entryType: 'payment', transactionId: 'transaction-1',
    bookingDate: '2026-08-05', amount: 965, occurrenceKey: 'tenant-payment:1',
  }];
  const transactions = [{
    id: 'transaction-1', tenancyId: 't1', accountEntryId: 'wrong-account',
    date: '2026-08-05', amount: 965, occurrenceKey: 'tenant-payment:1',
  }];
  assert.throws(() => voidLinkedTenantPayment({
    accountEntry: accountEntries[0], accountEntries, transactions,
  }), /unvollständig oder widersprüchlich/);
  assert.equal(accountEntries.length, 1);
  assert.equal(transactions.length, 1);
});
