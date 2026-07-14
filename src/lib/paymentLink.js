const money = (value) => Math.round(Number(value || 0) * 100) / 100;

export function buildLinkedTenantPayment({ entry, tenancy, unit, token }) {
  if (entry?.entryType !== 'payment' || !entry.tenancyId || !tenancy || !(money(entry.amount) > 0) || !entry.bookingDate || !token) {
    throw new Error('Mietzahlung benötigt Konto, Betrag, Datum und eine eindeutige ID.');
  }
  const accountEntryId = `account-${token}`;
  const transactionId = `transaction-tenant-payment-${token}`;
  const occurrenceKey = `tenant-payment:${token}`;
  const accountEntry = {
    ...entry,
    id: accountEntryId,
    entryType: 'payment',
    component: 'payment',
    side: 'credit',
    amount: money(entry.amount),
    sourceType: 'tenantPayment',
    sourceId: transactionId,
    transactionId,
    occurrenceKey,
  };
  const transaction = {
    id: transactionId,
    propertyId: unit?.propertyId || '',
    unitId: unit?.id || tenancy.unitId || '',
    tenancyId: tenancy.id,
    date: entry.bookingDate,
    kind: 'income',
    categoryId: 'rent',
    description: entry.description || 'Mietzahlung',
    amount: money(entry.amount),
    servicePeriodStart: entry.servicePeriodStart || null,
    servicePeriodEnd: entry.servicePeriodEnd || null,
    sourceType: 'tenantPayment',
    sourceId: accountEntryId,
    accountEntryId,
    occurrenceKey,
    allocations: [],
  };
  return { accountEntry, transaction };
}

export function linkedTenantPaymentIsConsistent(accountEntry, transaction) {
  return Boolean(
    accountEntry
    && transaction
    && accountEntry.entryType === 'payment'
    && accountEntry.transactionId === transaction.id
    && transaction.accountEntryId === accountEntry.id
    && accountEntry.tenancyId === transaction.tenancyId
    && accountEntry.bookingDate === transaction.date
    && money(accountEntry.amount) === money(transaction.amount)
    && accountEntry.occurrenceKey === transaction.occurrenceKey,
  );
}

export function voidLinkedTenantPayment({ accountEntry, accountEntries = [], transactions = [] }) {
  const transaction = transactions.find((item) => item.id === accountEntry?.transactionId);
  if (!linkedTenantPaymentIsConsistent(accountEntry, transaction)) {
    throw new Error('Die verknüpfte Mietzahlung ist unvollständig oder widersprüchlich und wurde nicht storniert.');
  }
  return {
    accountEntries: accountEntries.filter((item) => item.id !== accountEntry.id),
    transactions: transactions.filter((item) => item.id !== transaction.id),
    removedAccountEntry: accountEntry,
    removedTransaction: transaction,
  };
}

export function isLinkedTenantPaymentTransaction(transaction) {
  return Boolean(transaction?.accountEntryId || transaction?.sourceType === 'tenantPayment');
}
