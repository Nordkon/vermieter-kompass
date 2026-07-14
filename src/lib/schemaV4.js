import { migrateV2ToV3, validateV3State } from './schemaV3.js';

export const RENTAL_SCHEMA_VERSION = 4;

const clone = (value) => JSON.parse(JSON.stringify(value));
const asArray = (value) => (Array.isArray(value) ? value : []);

function optionalMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

export function splitLegacyPostalCity(postalCode, city) {
  const explicitPostalCode = String(postalCode ?? '').trim();
  const explicitCity = String(city ?? '').trim();
  if (explicitPostalCode) {
    return { postalCode: explicitPostalCode, city: explicitCity };
  }
  const match = explicitCity.match(/^(\d{5})\s+(.+)$/);
  return match
    ? { postalCode: match[1], city: match[2].trim() }
    : { postalCode: '', city: explicitCity };
}

function normalizeProperty(property) {
  const location = splitLegacyPostalCity(property.postalCode, property.city);
  return {
    ...property,
    address: String(property.address ?? property.street ?? '').trim(),
    postalCode: location.postalCode,
    city: location.city,
    country: String(property.country ?? '').trim() || 'Deutschland',
  };
}

function normalizeUnit(unit, property, primaryCount) {
  const hasTargetColdRent = Object.prototype.hasOwnProperty.call(unit, 'targetColdRent');
  const hasTargetUtilityAdvance = Object.prototype.hasOwnProperty.call(unit, 'targetUtilityAdvance');
  const canUseLegacyPropertyValue = unit.unitKind !== 'ancillary' && primaryCount === 1;
  return {
    ...unit,
    targetColdRent: hasTargetColdRent
      ? optionalMoney(unit.targetColdRent)
      : canUseLegacyPropertyValue
        ? optionalMoney(property?.monthlyRent)
        : null,
    targetUtilityAdvance: hasTargetUtilityAdvance
      ? optionalMoney(unit.targetUtilityAdvance)
      : canUseLegacyPropertyValue
        ? optionalMoney(property?.monthlyUtilityAdvance)
        : null,
  };
}

export function migrateV3ToV4(input, migratedAt = new Date().toISOString()) {
  if (Number(input?.schemaVersion || 0) >= RENTAL_SCHEMA_VERSION) return clone(input);
  const state = clone(input || {});
  let properties = asArray(state.properties).map(normalizeProperty);
  const primaryCounts = new Map();
  for (const unit of asArray(state.units)) {
    if (unit.unitKind === 'ancillary') continue;
    primaryCounts.set(unit.propertyId, (primaryCounts.get(unit.propertyId) || 0) + 1);
  }
  properties = properties.map((property) => {
    const primaryCount = primaryCounts.get(property.id) || 0;
    const existingLegacy = optionalMoney(property.legacyTargetColdRentTotal);
    return {
      ...property,
      legacyTargetColdRentTotal: existingLegacy ?? (
        primaryCount === 1 ? null : optionalMoney(property.monthlyRent)
      ),
      legacyTargetColdRentSource: existingLegacy !== null || (
        primaryCount !== 1 && optionalMoney(property.monthlyRent) !== null
      ) ? property.legacyTargetColdRentSource || 'migration-v3' : null,
    };
  });
  const propertyMap = new Map(properties.map((property) => [property.id, property]));
  const units = asArray(state.units).map((unit) => normalizeUnit(
    unit,
    propertyMap.get(unit.propertyId),
    primaryCounts.get(unit.propertyId) || 0,
  ));
  const ruleMap = new Map(asArray(state.recurringRules).map((rule) => [rule.id, rule]));
  const accountEntries = asArray(state.accountEntries).map((entry) => {
    const sourceRule = entry.sourceType === 'recurringRule' ? ruleMap.get(entry.sourceId) : null;
    return {
      ...entry,
      component: entry.component || sourceRule?.component || null,
      legacyPaymentUnlinked: entry.entryType === 'payment' && !entry.transactionId
        ? true
        : entry.legacyPaymentUnlinked || false,
    };
  });
  return {
    ...state,
    schemaVersion: RENTAL_SCHEMA_VERSION,
    migratedAtV4: migratedAt,
    properties,
    units,
    accountEntries,
  };
}

export function migrateRentalStateToV4(input, migratedAt = new Date().toISOString()) {
  const version = Number(input?.schemaVersion || 0);
  const v3 = version < 3 ? migrateV2ToV3(input, migratedAt) : clone(input);
  return migrateV3ToV4(v3, migratedAt);
}

export function validateV4State(state) {
  const v3Compatible = { ...clone(state), schemaVersion: 3 };
  validateV3State(v3Compatible);
  const errors = [];
  for (const property of asArray(state?.properties)) {
    if (typeof property.postalCode !== 'string') errors.push(`${property.id}: PLZ muss Text sein.`);
    if (typeof property.city !== 'string') errors.push(`${property.id}: Ort muss Text sein.`);
    if (typeof property.country !== 'string') errors.push(`${property.id}: Land muss Text sein.`);
  }
  for (const unit of asArray(state?.units)) {
    for (const field of ['targetColdRent', 'targetUtilityAdvance']) {
      if (unit[field] !== null && (!Number.isFinite(unit[field]) || unit[field] < 0)) {
        errors.push(`${unit.id}: ${field} muss null oder eine nichtnegative Zahl sein.`);
      }
    }
  }
  if (Number(state?.schemaVersion) !== RENTAL_SCHEMA_VERSION) {
    errors.push('Schema-Version ist nicht 4.');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return true;
}
