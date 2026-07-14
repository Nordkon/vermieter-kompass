import test from 'node:test';
import assert from 'node:assert/strict';

import {
  activeContractSummary,
  propertyAddressLine,
  propertyAddressToContactForm,
  unitPlanSummary,
} from './propertyModel.js';

test('Objektadresse bleibt strukturiert und kopierbar', () => {
  const property = { address: 'Sternweg 12', postalCode: '04109', city: 'Leipzig', country: 'Deutschland' };
  assert.equal(propertyAddressLine(property), 'Sternweg 12, 04109 Leipzig');
  assert.deepEqual(propertyAddressToContactForm(property), {
    street: 'Sternweg 12', postalCode: '04109', city: 'Leipzig', country: 'Deutschland',
  });
});

test('Planaggregat unterscheidet null und 0 und meldet Vollständigkeit', () => {
  const result = unitPlanSummary([
    { id: 'u1', unitKind: 'primary', targetColdRent: 1050, targetUtilityAdvance: 300 },
    { id: 'u2', unitKind: 'primary', targetColdRent: 820, targetUtilityAdvance: 0 },
    { id: 'u3', unitKind: 'primary', targetColdRent: null, targetUtilityAdvance: null },
  ]);
  assert.equal(result.coldRent, 1870);
  assert.equal(result.utilityAdvance, 300);
  assert.equal(result.configuredCold, 2);
  assert.equal(result.configuredUtility, 2);
  assert.equal(result.configuredWarm, 2);
  assert.equal(result.totalUnits, 3);
  assert.equal(result.coldComplete, false);
  assert.equal(result.utilityComplete, false);
  assert.equal(result.warmComplete, false);
});

test('Ungepflegt bleibt von bewusst 0 Euro unterscheidbar', () => {
  const missing = unitPlanSummary([
    { id: 'u1', unitKind: 'primary', targetColdRent: null, targetUtilityAdvance: null },
  ]);
  assert.equal(missing.coldRent, 0);
  assert.equal(missing.configuredCold, 0);
  assert.equal(missing.configuredUtility, 0);
  assert.equal(missing.configuredWarm, 0);

  const zero = unitPlanSummary([
    { id: 'u1', unitKind: 'primary', targetColdRent: 0, targetUtilityAdvance: 0 },
  ]);
  assert.equal(zero.coldRent, 0);
  assert.equal(zero.utilityAdvance, 0);
  assert.equal(zero.configuredCold, 1);
  assert.equal(zero.configuredUtility, 1);
  assert.equal(zero.configuredWarm, 1);
  assert.equal(zero.warmComplete, true);
});

test('Ungepflegte Nebeneinheit bleibt im Vollständigkeitsstatus sichtbar', () => {
  const result = unitPlanSummary([
    { id: 'u1', unitKind: 'primary', targetColdRent: 750, targetUtilityAdvance: 180 },
    { id: 'u2', unitKind: 'ancillary', targetColdRent: null, targetUtilityAdvance: null },
  ]);
  assert.equal(result.totalUnits, 2);
  assert.equal(result.configuredWarm, 1);
  assert.equal(result.warmComplete, false);
});

test('Aktive Vertragssummen bleiben von Planwerten getrennt', () => {
  const result = activeContractSummary({
    propertyUnits: [{ id: 'u1' }, { id: 'u2' }],
    tenancies: [
      { id: 't1', unitId: 'u1', coldRent: 950, utilityAdvance: 300, contractStart: '2020-01-01' },
      { id: 't2', unitId: 'u2', coldRent: 760, utilityAdvance: 180, contractStart: '2020-01-01', status: 'ended' },
    ],
    tenancyUnits: [],
  });
  assert.deepEqual(result, { coldRent: 950, utilityAdvance: 300, warmRent: 1250, tenancyCount: 1 });
});
