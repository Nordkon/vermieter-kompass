import { isTenancyActive, tenancyUnitIds } from './rentalModel.js';

const asArray = (value) => (Array.isArray(value) ? value : []);
const moneyOrNull = (value) => (
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? null
    : Math.round(Number(value) * 100) / 100
);

export function propertyAddressLine(property = {}) {
  return [property.address, [property.postalCode, property.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

export function propertyAddressToContactForm(property = {}) {
  return {
    street: String(property.address || '').trim(),
    postalCode: String(property.postalCode || '').trim(),
    city: String(property.city || '').trim(),
    country: String(property.country || '').trim() || 'Deutschland',
  };
}

export function unitPlanSummary(units = []) {
  const rentableUnits = asArray(units);
  const coldValues = rentableUnits.map((unit) => moneyOrNull(unit.targetColdRent));
  const utilityValues = rentableUnits.map((unit) => moneyOrNull(unit.targetUtilityAdvance));
  const coldConfigured = coldValues.filter((value) => value !== null);
  const utilityConfigured = utilityValues.filter((value) => value !== null);
  const warmConfigured = coldValues.filter((coldValue, index) => (
    coldValue !== null && utilityValues[index] !== null
  ));
  const coldRent = coldConfigured.reduce((sum, value) => sum + value, 0);
  const utilityAdvance = utilityConfigured.reduce((sum, value) => sum + value, 0);
  return {
    coldRent: Math.round(coldRent * 100) / 100,
    utilityAdvance: Math.round(utilityAdvance * 100) / 100,
    warmRent: Math.round((coldRent + utilityAdvance) * 100) / 100,
    configuredCold: coldConfigured.length,
    configuredUtility: utilityConfigured.length,
    configuredWarm: warmConfigured.length,
    totalUnits: rentableUnits.length,
    coldComplete: rentableUnits.length > 0 && coldConfigured.length === rentableUnits.length,
    utilityComplete: rentableUnits.length > 0 && utilityConfigured.length === rentableUnits.length,
    warmComplete: rentableUnits.length > 0 && warmConfigured.length === rentableUnits.length,
  };
}

export function activeContractSummary({ propertyUnits = [], tenancies = [], tenancyUnits = [] }) {
  const unitIds = new Set(asArray(propertyUnits).map((unit) => unit.id));
  const active = asArray(tenancies).filter((tenancy) => (
    isTenancyActive(tenancy)
    && tenancyUnitIds(tenancy, tenancyUnits).some((unitId) => unitIds.has(unitId))
  ));
  const coldRent = active.reduce((sum, tenancy) => sum + Number(tenancy.coldRent || 0), 0);
  const utilityAdvance = active.reduce((sum, tenancy) => sum + Number(tenancy.utilityAdvance || 0), 0);
  return {
    coldRent: Math.round(coldRent * 100) / 100,
    utilityAdvance: Math.round(utilityAdvance * 100) / 100,
    warmRent: Math.round((coldRent + utilityAdvance) * 100) / 100,
    tenancyCount: active.length,
  };
}

export function unitRentDefaults(unit) {
  return {
    coldRent: moneyOrNull(unit?.targetColdRent),
    utilityAdvance: moneyOrNull(unit?.targetUtilityAdvance),
  };
}
