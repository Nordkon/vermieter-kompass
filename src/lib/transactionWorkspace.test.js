import assert from 'node:assert/strict';
import test from 'node:test';

import { validateTransactionWorkspaceSave } from './transactionWorkspace.js';

const data = {
  properties: [{ id: 'property-1' }],
  units: [{ id: 'unit-1', propertyId: 'property-1' }, { id: 'unit-2', propertyId: 'property-2' }],
  categories: [{ id: 'expense-water', kind: 'expense' }, { id: 'income-rent', kind: 'income' }],
  tenancies: [{ id: 'tenancy-1', unitId: 'unit-1' }],
  tenancyUnits: [{ tenancyId: 'tenancy-1', unitId: 'unit-1', sortOrder: 0 }],
};

const validExpense = {
  id: 'transaction-1',
  propertyId: 'property-1',
  unitId: 'unit-1',
  tenancyId: 'tenancy-1',
  categoryId: 'expense-water',
  kind: 'expense',
  amount: '120.00',
  servicePeriodStart: '2026-01-01',
  servicePeriodEnd: '2026-12-31',
  allocatable: true,
  allocations: [{ unitId: 'unit-1', tenancyId: 'tenancy-1', amount: 120 }],
};

test('Speicherprüfung akzeptiert gültige Referenzen und normalisiert den Betrag', () => {
  const result = validateTransactionWorkspaceSave(validExpense, data);
  assert.equal(result.ok, true);
  assert.equal(result.value.amount, 120);
});

test('Speicherprüfung verwirft inzwischen entfernte oder fremde Referenzen', () => {
  assert.equal(validateTransactionWorkspaceSave({ ...validExpense, propertyId: 'missing' }, data).ok, false);
  assert.equal(validateTransactionWorkspaceSave({ ...validExpense, unitId: 'unit-2' }, data).ok, false);
  assert.equal(validateTransactionWorkspaceSave({ ...validExpense, tenancyId: 'missing' }, data).ok, false);
  assert.equal(validateTransactionWorkspaceSave({ ...validExpense, categoryId: 'income-rent' }, data).ok, false);
});

test('Speicherprüfung verhindert veraltete und betragsfalsche Kostenverteilungen', () => {
  const wrongTotal = validateTransactionWorkspaceSave({
    ...validExpense,
    allocations: [{ unitId: 'unit-1', tenancyId: 'tenancy-1', amount: 119 }],
  }, data);
  const removedUnit = validateTransactionWorkspaceSave({
    ...validExpense,
    allocations: [{ unitId: 'missing', tenancyId: null, amount: 120 }],
  }, data);
  const nonFiniteAmount = validateTransactionWorkspaceSave({
    ...validExpense,
    allocations: [{ unitId: 'unit-1', tenancyId: 'tenancy-1', amount: Number.NaN }],
  }, data);
  const negativeAmount = validateTransactionWorkspaceSave({
    ...validExpense,
    allocations: [
      { unitId: 'unit-1', tenancyId: 'tenancy-1', amount: -10 },
      { unitId: 'unit-1', tenancyId: 'tenancy-1', amount: 130 },
    ],
  }, data);
  assert.equal(wrongTotal.ok, false);
  assert.equal(removedUnit.ok, false);
  assert.equal(nonFiniteAmount.ok, false);
  assert.equal(negativeAmount.ok, false);
});

test('Leistungszeitraum wird unmittelbar vor dem Speichern erneut geprüft', () => {
  assert.equal(validateTransactionWorkspaceSave({
    ...validExpense,
    servicePeriodEnd: '',
  }, data).ok, false);
  assert.equal(validateTransactionWorkspaceSave({
    ...validExpense,
    servicePeriodStart: '2026-12-31',
    servicePeriodEnd: '2026-01-01',
  }, data).ok, false);
});
