import { tenancyUnitIds } from './rentalModel.js';

const asArray = (value) => (Array.isArray(value) ? value : []);

export function validateTransactionWorkspaceSave(transaction, {
  properties = [],
  units = [],
  categories = [],
  tenancies = [],
  tenancyUnits = [],
} = {}) {
  const property = properties.find((item) => item.id === transaction?.propertyId);
  const unit = transaction?.unitId
    ? units.find((item) => item.id === transaction.unitId)
    : null;
  const category = categories.find((item) => item.id === transaction?.categoryId);
  const amount = Number(transaction?.amount);
  const allocations = asArray(transaction?.allocations);

  if (!property) return { ok: false, error: 'Die ausgewählte Immobilie ist nicht mehr vorhanden.' };
  if (transaction.unitId && (!unit || unit.propertyId !== property.id)) {
    return { ok: false, error: 'Die ausgewählte Einheit gehört nicht mehr zu dieser Immobilie.' };
  }
  if (!category || category.kind !== transaction.kind) {
    return { ok: false, error: 'Die ausgewählte Kategorie passt nicht mehr zur Buchungsart.' };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Bitte einen gültigen Betrag größer als 0 Euro eingeben.' };
  }
  if (Boolean(transaction.servicePeriodStart) !== Boolean(transaction.servicePeriodEnd)
    || (transaction.servicePeriodStart && transaction.servicePeriodEnd < transaction.servicePeriodStart)) {
    return { ok: false, error: 'Der Leistungszeitraum ist nicht vollständig oder liegt in der falschen Reihenfolge.' };
  }
  if (transaction.tenancyId) {
    const tenancy = tenancies.find((item) => item.id === transaction.tenancyId);
    if (!tenancy || !transaction.unitId || !tenancyUnitIds(tenancy, tenancyUnits).includes(transaction.unitId)) {
      return { ok: false, error: 'Das zugeordnete Mietverhältnis ist nicht mehr gültig.' };
    }
  }
  if (transaction.kind === 'expense' && transaction.allocatable) {
    const invalidAllocation = allocations.some((allocation) => {
      const allocationUnit = units.find((item) => item.id === allocation.unitId);
      const allocationTenancy = allocation.tenancyId
        ? tenancies.find((item) => item.id === allocation.tenancyId)
        : null;
      const allocationAmount = Number(allocation.amount);
      return !Number.isFinite(allocationAmount)
        || allocationAmount < 0
        || !allocationUnit
        || allocationUnit.propertyId !== property.id
        || (allocation.tenancyId && (!allocationTenancy
          || !tenancyUnitIds(allocationTenancy, tenancyUnits).includes(allocation.unitId)));
    });
    const allocatedTotal = allocations.reduce(
      (total, allocation) => total + Number(allocation.amount || 0),
      0,
    );
    if (invalidAllocation || Math.abs(allocatedTotal - amount) > 0.01) {
      return { ok: false, error: 'Die Kostenverteilung ist nicht mehr gültig. Bitte Verteilung und Mietverhältnisse prüfen.' };
    }
  }

  return { ok: true, value: { ...transaction, amount } };
}
