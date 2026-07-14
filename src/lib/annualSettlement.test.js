import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAnnualSettlementPreview,
  buildSettlementAccountEntry,
} from './annualSettlement.js';
import { materializeRecurringEntries } from './schemaV3.js';

const utilityRule = {
  id: 'rule-utility', tenancyId: 't1', component: 'utilityAdvance',
  description: 'Betriebskostenvorauszahlung', amount: 190,
  frequency: 'monthly', dueDay: 3, startDate: '2026-08-03', endDate: '2027-07-31', status: 'active',
};

const expense = (id, amount) => ({
  id,
  kind: 'expense',
  allocatable: true,
  servicePeriodStart: '2026-08-01',
  servicePeriodEnd: '2027-07-31',
  allocations: [{
    tenancyId: 't1', unitId: 'u1', amount,
    servicePeriodStart: '2026-08-01', servicePeriodEnd: '2027-07-31',
  }],
});

test('Jahresvorschau verbindet Kosten und typisierte Vorauszahlungs-Sollstellungen', () => {
  const accountEntries = materializeRecurringEntries([utilityRule], [], '2027-07-03');
  const preview = buildAnnualSettlementPreview({
    tenancyId: 't1',
    periodStart: '2026-08-01',
    periodEnd: '2027-07-31',
    agreedUtilityAdvance: 190,
    transactions: [
      expense('tax', 720), expense('insurance', 480), expense('water', 960), expense('heating', 240),
      { id: 'wc', kind: 'expense', allocatable: false, amount: 165, date: '2027-04-11' },
    ],
    accountEntries,
    recurringRules: [utilityRule],
  });
  assert.equal(preview.allocatableCosts, 2400);
  assert.equal(preview.ownerCosts, 165);
  assert.equal(preview.agreedAdvanceDebit, 2280);
  assert.equal(preview.result, 120);
  assert.equal(preview.resultSide, 'debit');
  assert.equal(preview.expectedAdvanceEntries, 12);
  assert.equal(preview.actualAdvanceEntries, 12);
  assert.equal(preview.complete, true);
  const posting = buildSettlementAccountEntry(preview, '2027-08-15');
  assert.equal(posting.amount, 120);
  assert.equal(posting.side, 'debit');
});

test('Jahresvorschau warnt bei fehlenden Sollmonaten und verhindert Posting', () => {
  const onlyTen = materializeRecurringEntries([utilityRule], [], '2027-05-03');
  const preview = buildAnnualSettlementPreview({
    tenancyId: 't1', periodStart: '2026-08-01', periodEnd: '2027-07-31',
    agreedUtilityAdvance: 190,
    transactions: [expense('tax', 720)], accountEntries: onlyTen, recurringRules: [utilityRule],
  });
  assert.equal(preview.expectedAdvanceEntries, 12);
  assert.equal(preview.actualAdvanceEntries, 10);
  assert.equal(preview.complete, false);
  assert.equal(buildSettlementAccountEntry(preview, '2027-08-15'), null);
});

test('Überlappende Mehrjahreskosten werden taggenau periodisiert', () => {
  const preview = buildAnnualSettlementPreview({
    tenancyId: 't1', periodStart: '2025-07-01', periodEnd: '2025-12-31',
    agreedUtilityAdvance: 0,
    transactions: [{
      id: 'annual', kind: 'expense', allocatable: true,
      servicePeriodStart: '2025-01-01', servicePeriodEnd: '2025-12-31',
      allocations: [{ tenancyId: 't1', amount: 365 }],
    }],
    accountEntries: [], recurringRules: [],
  });
  assert.equal(preview.allocatableCosts, 184);
});

test('Settlement ist je Mietverhältnis und Zeitraum dublettengeschützt', () => {
  const accountEntries = materializeRecurringEntries([utilityRule], [], '2027-07-03');
  accountEntries.push({ occurrenceKey: 'settlement:t1:2026-08-01:2027-07-31', tenancyId: 't1' });
  const preview = buildAnnualSettlementPreview({
    tenancyId: 't1', periodStart: '2026-08-01', periodEnd: '2027-07-31',
    agreedUtilityAdvance: 190,
    transactions: [expense('tax', 2400)], accountEntries, recurringRules: [utilityRule],
  });
  assert.equal(preview.alreadyPosted, true);
  assert.equal(buildSettlementAccountEntry(preview, '2027-08-15'), null);
});

test('Explizit 0 Euro Vorauszahlung ist ohne Regel vollständig abrechenbar', () => {
  const preview = buildAnnualSettlementPreview({
    tenancyId: 't-zero',
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    agreedUtilityAdvance: 0,
    transactions: [{
      id: 'water-zero', kind: 'expense', allocatable: true,
      servicePeriodStart: '2026-01-01', servicePeriodEnd: '2026-12-31',
      allocations: [{
        tenancyId: 't-zero', amount: 600,
        servicePeriodStart: '2026-01-01', servicePeriodEnd: '2026-12-31',
      }],
    }],
    accountEntries: [],
    recurringRules: [],
  });
  assert.equal(preview.zeroAdvanceAgreed, true);
  assert.equal(preview.expectedAdvanceEntries, 0);
  assert.equal(preview.agreedAdvanceDebit, 0);
  assert.equal(preview.result, 600);
  assert.equal(preview.complete, true);
  assert.equal(buildSettlementAccountEntry(preview, '2027-01-15').amount, 600);
});

test('Positive Vertragsvorauszahlung ohne typisierte Regel blockiert den Abschluss', () => {
  const preview = buildAnnualSettlementPreview({
    tenancyId: 't-missing-rule',
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    agreedUtilityAdvance: 180,
    transactions: [],
    accountEntries: [],
    recurringRules: [],
  });
  assert.equal(preview.missingAdvanceRule, true);
  assert.equal(preview.complete, false);
  assert.equal(buildSettlementAccountEntry(preview, '2027-01-15'), null);
});

test('0-Euro-Vertrag mit widersprüchlicher Vorauszahlungsregel bleibt gesperrt', () => {
  const preview = buildAnnualSettlementPreview({
    tenancyId: 't1',
    periodStart: '2026-08-01',
    periodEnd: '2027-07-31',
    agreedUtilityAdvance: 0,
    transactions: [],
    accountEntries: [],
    recurringRules: [utilityRule],
  });
  assert.equal(preview.unexpectedAdvanceActivity, true);
  assert.equal(preview.complete, false);
});
