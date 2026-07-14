import { accountBalance, materializeRecurringEntries } from './schemaV3.js';

const asArray = (value) => (Array.isArray(value) ? value : []);
const cents = (value) => Math.round((Number(value) || 0) * 100) / 100;

function utcDay(value) {
  return Math.floor(Date.parse(`${value}T00:00:00Z`) / 86_400_000);
}

function inclusiveDays(start, end) {
  if (!start || !end || end < start) return 0;
  return utcDay(end) - utcDay(start) + 1;
}

function overlap(start, end, periodStart, periodEnd) {
  const from = start > periodStart ? start : periodStart;
  const to = end < periodEnd ? end : periodEnd;
  return to < from ? null : { start: from, end: to };
}

export function settlementOccurrenceKey(tenancyId, periodStart, periodEnd) {
  return `settlement:${tenancyId}:${periodStart}:${periodEnd}`;
}

function allocatedCostForPeriod(transaction, tenancyId, periodStart, periodEnd) {
  if (transaction.kind !== 'expense' || transaction.allocatable !== true) return 0;
  return asArray(transaction.allocations)
    .filter((allocation) => allocation.tenancyId === tenancyId)
    .reduce((sum, allocation) => {
      const allocationStart = allocation.servicePeriodStart || transaction.servicePeriodStart;
      const allocationEnd = allocation.servicePeriodEnd || transaction.servicePeriodEnd;
      if (!allocationStart || !allocationEnd) return sum;
      const shared = overlap(allocationStart, allocationEnd, periodStart, periodEnd);
      if (!shared) return sum;
      const totalDays = inclusiveDays(allocationStart, allocationEnd);
      const sharedDays = inclusiveDays(shared.start, shared.end);
      return sum + Number(allocation.amount || 0) * (sharedDays / totalDays);
    }, 0);
}

function ownerCostForPeriod(transaction, periodStart, periodEnd) {
  if (transaction.kind !== 'expense' || transaction.allocatable === true) return 0;
  const start = transaction.servicePeriodStart || transaction.date;
  const end = transaction.servicePeriodEnd || transaction.date;
  if (!start || !end) return 0;
  const shared = overlap(start, end, periodStart, periodEnd);
  if (!shared) return 0;
  return Number(transaction.amount || 0) * (
    inclusiveDays(shared.start, shared.end) / inclusiveDays(start, end)
  );
}

export function buildAnnualSettlementPreview({
  tenancyId,
  periodStart,
  periodEnd,
  agreedUtilityAdvance = null,
  transactions = [],
  accountEntries = [],
  recurringRules = [],
}) {
  const costs = cents(asArray(transactions).reduce(
    (sum, transaction) => sum + allocatedCostForPeriod(transaction, tenancyId, periodStart, periodEnd),
    0,
  ));
  const ownerCosts = cents(asArray(transactions).reduce(
    (sum, transaction) => sum + ownerCostForPeriod(transaction, periodStart, periodEnd),
    0,
  ));
  const utilityEntries = asArray(accountEntries).filter((entry) => (
    entry.tenancyId === tenancyId
    && entry.side === 'debit'
    && entry.component === 'utilityAdvance'
    && (entry.dueDate || entry.bookingDate) >= periodStart
    && (entry.dueDate || entry.bookingDate) <= periodEnd
  ));
  const advanceDebit = cents(utilityEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0));
  const utilityRules = asArray(recurringRules).filter((rule) => (
    rule.tenancyId === tenancyId && rule.component === 'utilityAdvance'
  ));
  const expectedKeys = new Set(materializeRecurringEntries(utilityRules, [], periodEnd)
    .filter((entry) => entry.dueDate >= periodStart && entry.dueDate <= periodEnd)
    .map((entry) => entry.occurrenceKey));
  const existingKeys = new Set(utilityEntries.map((entry) => entry.occurrenceKey).filter(Boolean));
  const missingKeys = [...expectedKeys].filter((key) => !existingKeys.has(key));
  const normalizedAgreement = (
    agreedUtilityAdvance === null
    || agreedUtilityAdvance === undefined
    || agreedUtilityAdvance === ''
    || !Number.isFinite(Number(agreedUtilityAdvance))
    || Number(agreedUtilityAdvance) < 0
  ) ? null : cents(agreedUtilityAdvance);
  const advanceAgreementKnown = normalizedAgreement !== null;
  const zeroAdvanceAgreed = normalizedAgreement === 0;
  const positiveAdvanceAgreed = Number(normalizedAgreement) > 0;
  const missingAdvanceRule = positiveAdvanceAgreed && expectedKeys.size === 0;
  const unexpectedAdvanceActivity = zeroAdvanceAgreed && (
    expectedKeys.size > 0 || utilityEntries.length > 0 || advanceDebit !== 0
  );
  const advanceScheduleComplete = zeroAdvanceAgreed
    ? !unexpectedAdvanceActivity
    : positiveAdvanceAgreed && expectedKeys.size > 0 && missingKeys.length === 0;
  const result = cents(costs - advanceDebit);
  const occurrenceKey = settlementOccurrenceKey(tenancyId, periodStart, periodEnd);
  return {
    tenancyId,
    periodStart,
    periodEnd,
    allocatableCosts: costs,
    ownerCosts,
    agreedUtilityAdvance: normalizedAgreement,
    agreedAdvanceDebit: advanceDebit,
    result,
    resultSide: result >= 0 ? 'debit' : 'credit',
    currentAccountBalance: cents(accountBalance(accountEntries, tenancyId)),
    expectedAdvanceEntries: expectedKeys.size,
    actualAdvanceEntries: existingKeys.size,
    missingOccurrenceKeys: missingKeys,
    advanceAgreementKnown,
    zeroAdvanceAgreed,
    missingAdvanceRule,
    unexpectedAdvanceActivity,
    complete: advanceAgreementKnown && advanceScheduleComplete,
    occurrenceKey,
    alreadyPosted: asArray(accountEntries).some((entry) => entry.occurrenceKey === occurrenceKey),
  };
}

export function buildSettlementAccountEntry(preview, bookingDate) {
  if (!preview?.complete || preview.alreadyPosted || !preview.result) return null;
  return {
    id: `account-${preview.occurrenceKey}`,
    tenancyId: preview.tenancyId,
    entryType: 'settlement',
    component: 'utilitySettlement',
    side: preview.resultSide,
    amount: Math.abs(preview.result),
    bookingDate,
    dueDate: bookingDate,
    servicePeriodStart: preview.periodStart,
    servicePeriodEnd: preview.periodEnd,
    description: preview.result > 0
      ? 'Betriebskostenabrechnung · Nachforderung'
      : 'Betriebskostenabrechnung · Guthaben',
    sourceType: 'annualSettlement',
    sourceId: preview.occurrenceKey,
    occurrenceKey: preview.occurrenceKey,
  };
}
