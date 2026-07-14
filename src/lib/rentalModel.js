export function isTenancyActive(tenancy, date = new Date().toISOString().slice(0, 10)) {
  if (!tenancy || tenancy.status === 'ended') return false;
  const startDate = tenancy.contractStart || tenancy.startDate;
  const endDate = tenancy.contractEnd || tenancy.endDate;
  if (startDate && startDate > date) return false;
  return !endDate || endDate >= date;
}

export function tenancyUnitIds(tenancy, tenancyUnits = []) {
  const relatedIds = tenancyUnits
    .filter((relation) => relation.tenancyId === tenancy?.id)
    .map((relation) => relation.unitId);
  return relatedIds.length ? relatedIds : [tenancy?.unitId].filter(Boolean);
}

export function activeTenancyForUnit(tenancies, unitId, date, tenancyUnits = []) {
  return tenancies.find(
    (tenancy) => tenancyUnitIds(tenancy, tenancyUnits).includes(unitId) && isTenancyActive(tenancy, date),
  );
}

export function tenancyHasIntervalConflict({
  tenancies,
  tenancyUnits = [],
  unitIds,
  contractStart,
  contractEnd = '',
  excludeTenancyId,
}) {
  const candidateEnd = contractEnd || '9999-12-31';
  return tenancies.some((tenancy) => {
    if (tenancy.id === excludeTenancyId) return false;
    const sharesUnit = tenancyUnitIds(tenancy, tenancyUnits).some((unitId) => unitIds.includes(unitId));
    if (!sharesUnit) return false;
    const existingStart = tenancy.contractStart || tenancy.startDate || '0000-01-01';
    const existingEnd = tenancy.contractEnd || tenancy.endDate || '9999-12-31';
    return contractStart <= existingEnd && existingStart <= candidateEnd;
  });
}

export function generateUnitsForProperty(property, count = property.units || 1) {
  const unitCount = Math.max(1, Number(count) || 1);
  const area = Math.max(1, Number(property.area) || unitCount);
  const baseArea = Math.floor((area / unitCount) * 100) / 100;
  const defaultUsageType = property.type === 'Gewerbe' ? 'Gewerbe' : 'Wohnen';

  return Array.from({ length: unitCount }, (_, index) => ({
    id: 'unit-' + property.id + '-' + (index + 1),
    propertyId: property.id,
    name: unitCount === 1 ? 'Gesamtobjekt' : 'Einheit ' + (index + 1),
    usageType: property.type === 'Gemischt' && index === 0
      ? 'Gewerbe'
      : defaultUsageType,
    floor: unitCount === 1 ? 'Gesamtobjekt' : '',
    area: index === unitCount - 1
      ? Math.round((area - baseArea * (unitCount - 1)) * 100) / 100
      : baseArea,
    unitKind: 'primary',
    ancillaryType: null,
    parentUnitId: null,
    targetColdRent: unitCount === 1 && index === 0
      ? optionalPlanMoney(property.targetColdRent ?? property.monthlyRent)
      : null,
    targetUtilityAdvance: unitCount === 1 && index === 0
      ? optionalPlanMoney(property.targetUtilityAdvance ?? property.monthlyUtilityAdvance)
      : null,
  }));
}

function optionalPlanMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.max(0, number) * 100) / 100 : null;
}

export function validateUnitStructure(property, units, candidate) {
  if (!property) return { valid: false, message: 'Die Immobilie der Einheit wurde nicht gefunden.' };
  const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
  const resulting = candidate.id && propertyUnits.some((unit) => unit.id === candidate.id)
    ? propertyUnits.map((unit) => unit.id === candidate.id ? candidate : unit)
    : [...propertyUnits, candidate];
  const primary = resulting.filter((unit) => unit.unitKind !== 'ancillary');
  const ancillary = resulting.filter((unit) => unit.unitKind === 'ancillary');
  if (candidate.unitKind === 'ancillary') {
    const parent = resulting.find((unit) => unit.id === candidate.parentUnitId);
    if (!['garage', 'parking'].includes(candidate.ancillaryType)) {
      return { valid: false, message: 'Als Nebeneinheit ist nur Garage oder Stellplatz zulässig.' };
    }
    if (!parent || parent.unitKind === 'ancillary' || parent.propertyId !== candidate.propertyId) {
      return { valid: false, message: 'Die Nebeneinheit muss einer Haupteinheit derselben Immobilie zugeordnet sein.' };
    }
  }
  if (property.buildingType !== 'singleFamily') return { valid: true, message: '' };
  if (primary.length !== 1) {
    return { valid: false, message: 'Ein Einfamilienhaus benötigt genau eine Haupteinheit.' };
  }
  if (ancillary.length > 1) {
    return { valid: false, message: 'Beim Einfamilienhaus ist höchstens eine Garage oder ein Stellplatz zulässig.' };
  }
  if (ancillary.some((unit) => !['garage', 'parking'].includes(unit.ancillaryType))) {
    return { valid: false, message: 'Als Nebeneinheit ist nur Garage oder Stellplatz zulässig.' };
  }
  if (ancillary.some((unit) => unit.parentUnitId !== primary[0].id)) {
    return { valid: false, message: 'Die Nebeneinheit muss der Haupteinheit dieses Objekts zugeordnet sein.' };
  }
  return { valid: true, message: '' };
}

export function allocationLabel(mode) {
  return {
    area: 'Nach Wohn-/Nutzfläche',
    equal: 'Gleichmäßig je Einheit',
    direct: 'Direktzuordnung',
    manual: 'Manuell / externe Abrechnung',
  }[mode] || 'Keine Verteilung';
}

export function calculateAllocations({
  amount,
  propertyId,
  unitId,
  mode,
  units,
  tenancies,
  date,
  manualAmounts = {},
}) {
  const propertyUnits = units.filter((unit) => unit.propertyId === propertyId);
  const targets = unitId
    ? propertyUnits.filter((unit) => unit.id === unitId)
    : propertyUnits;
  const numericAmount = Math.max(0, Number(amount) || 0);
  if (!targets.length || !numericAmount) return [];

  let rawShares;
  if (mode === 'manual') {
    rawShares = targets.map((unit) => ({
      unit,
      amount: Math.max(0, Number(manualAmounts[unit.id]) || 0),
    }));
  } else if (mode === 'direct' || unitId) {
    rawShares = targets.map((unit, index) => ({ unit, amount: index === 0 ? numericAmount : 0 }));
  } else if (mode === 'equal') {
    rawShares = targets.map((unit) => ({ unit, weight: 1 }));
  } else {
    rawShares = targets.map((unit) => ({ unit, weight: Math.max(0, Number(unit.area) || 0) }));
  }

  if (mode !== 'manual' && mode !== 'direct' && !unitId) {
    const totalWeight = rawShares.reduce((sum, row) => sum + row.weight, 0) || rawShares.length;
    rawShares = rawShares.map((row) => ({
      ...row,
      amount: numericAmount * ((row.weight || 1) / totalWeight),
    }));
  }

  const rounded = rawShares.map((row) => ({
    unitId: row.unit.id,
    tenancyId: activeTenancyForUnit(tenancies, row.unit.id, date)?.id || null,
    amount: Math.round(row.amount * 100) / 100,
  }));

  if (mode !== 'manual' && rounded.length) {
    const difference = Math.round(
      (numericAmount - rounded.reduce((sum, row) => sum + row.amount, 0)) * 100,
    ) / 100;
    rounded[rounded.length - 1].amount += difference;
  }

  return rounded.filter((row) => row.amount > 0);
}

export function transactionMatchesUnit(transaction, unitId) {
  if (!unitId || unitId === 'all') return true;
  return transaction.unitId === unitId || transaction.allocations?.some(
    (allocation) => allocation.unitId === unitId,
  );
}

export function transactionMatchesTenancy(transaction, tenancyId) {
  if (!tenancyId || tenancyId === 'all') return true;
  return transaction.tenancyId === tenancyId || transaction.allocations?.some(
    (allocation) => allocation.tenancyId === tenancyId,
  );
}

export function documentsForContext(documents, context, units, tenancies, contacts) {
  if (context.type !== 'property') {
    return documents.filter(
      (document) => document.ownerType === context.type && document.ownerId === context.id,
    );
  }

  const unitIds = units.filter((unit) => unit.propertyId === context.id).map((unit) => unit.id);
  const tenancyIds = tenancies
    .filter((tenancy) => unitIds.includes(tenancy.unitId))
    .map((tenancy) => tenancy.id);
  const contactIds = contacts
    .filter((contact) => tenancies.some(
      (tenancy) => tenancyIds.includes(tenancy.id) && tenancy.contactIds.includes(contact.id),
    ))
    .map((contact) => contact.id);

  return documents.filter((document) =>
    document.propertyId === context.id ||
    (document.ownerType === 'unit' && unitIds.includes(document.ownerId)) ||
    (document.ownerType === 'tenancy' && tenancyIds.includes(document.ownerId)) ||
    (document.ownerType === 'contact' && contactIds.includes(document.ownerId)),
  );
}
