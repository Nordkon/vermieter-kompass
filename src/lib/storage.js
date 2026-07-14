import { useEffect, useState } from 'react';
import { migrateV2ToV3 } from './schemaV3.js';
import {
  migrateV3ToV4,
  RENTAL_SCHEMA_VERSION,
  validateV4State,
} from './schemaV4.js';

export const RENTAL_STORAGE_KEYS = Object.freeze({
  properties: 'vermieter-demo-properties',
  transactions: 'vermieter-demo-transactions',
  categories: 'vermieter-demo-categories',
  units: 'vermieter-demo-units',
  contacts: 'vermieter-demo-contacts',
  tenancies: 'vermieter-demo-tenancies',
  documents: 'vermieter-demo-documents',
  tenancyParties: 'vermieter-demo-tenancy-parties',
  tenancyUnits: 'vermieter-demo-tenancy-units',
  recurringRules: 'vermieter-demo-recurring-rules',
  accountEntries: 'vermieter-demo-account-entries',
  migrationIssues: 'vermieter-demo-migration-issues',
  tutorialProgress: 'vermieter-demo-tutorial-progress',
});

export const OPERATIONAL_STORAGE_NAMES = Object.freeze([
  'properties', 'transactions', 'units', 'contacts', 'tenancies', 'documents',
  'tenancyParties', 'tenancyUnits', 'recurringRules', 'accountEntries',
  'migrationIssues', 'tutorialProgress',
]);

function reportStorageError(key, error) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent('vermieter-storage-error', {
    detail: { key, message: error?.message || 'Lokales Speichern fehlgeschlagen.' },
  }));
}

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Lokales Speichern fehlgeschlagen:', error);
      reportStorageError(key, error);
    }
  }, [key, value]);

  return [value, setValue];
}

export function clearDemoStorage() {
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith('vermieter-demo-'))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function readRentalStorageSnapshot() {
  const snapshot = { schemaVersion: Number(window.localStorage.getItem('vermieter-demo-schema-version') || 0) };
  for (const [name, key] of Object.entries(RENTAL_STORAGE_KEYS)) {
    const fallback = name === 'tutorialProgress' ? null : [];
    snapshot[name] = readStored(key, fallback);
  }
  return snapshot;
}

export function writeRentalSlicesAtomically(slices) {
  const entries = Object.entries(slices).map(([name, value]) => {
    const key = RENTAL_STORAGE_KEYS[name] || name;
    return { key, value };
  });
  const previous = new Map(entries.map(({ key }) => [key, window.localStorage.getItem(key)]));
  try {
    for (const { key, value } of entries) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
    return true;
  } catch (error) {
    for (const { key } of entries) {
      const prior = previous.get(key);
      try {
        if (prior === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, prior);
      } catch {
        // Der ursprüngliche Fehler wird gemeldet; der Wiederherstellungsversuch bleibt best effort.
      }
    }
    reportStorageError(entries.map(({ key }) => key).join(', '), error);
    throw error;
  }
}

function readStored(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredStrictArray(key) {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Migration abgebrochen: ${key} enthält ungültiges JSON.`, { cause: error });
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Migration abgebrochen: ${key} enthält keine Liste.`);
  }
  return parsed;
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || Date.now();
}

function ensureV2Schema(defaults) {
  if (typeof window === 'undefined') return;
  const versionKey = 'vermieter-demo-schema-version';
  if (Number(window.localStorage.getItem(versionKey) || 0) >= 2) return;

  const properties = readStored('vermieter-demo-properties', defaults.properties || []);
  const transactions = readStored('vermieter-demo-transactions', defaults.transactions || []);
  const categories = readStored('vermieter-demo-categories', defaults.categories || []);
  const legacyTenants = readStored('vermieter-demo-tenants', []);
  const propertyIds = new Set(properties.map((property) => property.id));

  let units = readStored('vermieter-demo-units', null);
  if (!units) {
    units = (defaults.units || []).filter((unit) => propertyIds.has(unit.propertyId));
    for (const property of properties) {
      if (units.some((unit) => unit.propertyId === property.id)) continue;
      units.push(...(defaults.generateUnitsForProperty?.(property, property.units) || []));
    }
  }

  let contacts = readStored('vermieter-demo-contacts', null);
  let tenancies = readStored('vermieter-demo-tenancies', null);
  if (!contacts || !tenancies) {
    contacts = (defaults.contacts || []).filter((contact) =>
      (defaults.tenancies || []).some((tenancy) =>
        tenancy.contactIds.includes(contact.id) && units.some((unit) => unit.id === tenancy.unitId),
      ),
    );
    tenancies = (defaults.tenancies || []).filter((tenancy) =>
      units.some((unit) => unit.id === tenancy.unitId),
    );

    for (const legacy of legacyTenants) {
      const existingContact = contacts.find((contact) => contact.name === legacy.name);
      if (existingContact) {
        Object.assign(existingContact, {
          email: legacy.email || existingContact.email,
          phone: legacy.phone || existingContact.phone,
        });
        continue;
      }

      const propertyUnits = units.filter((unit) => unit.propertyId === legacy.propertyId);
      const occupiedUnitIds = new Set(tenancies.map((tenancy) => tenancy.unitId));
      const unit = propertyUnits.find(
        (candidate) => candidate.name === legacy.unit || candidate.legacyLabel === legacy.unit,
      ) || propertyUnits.find((candidate) => !occupiedUnitIds.has(candidate.id)) || propertyUnits[0];
      if (!unit) continue;

      const suffix = slug(legacy.id || legacy.name);
      const contactId = 'contact-migrated-' + suffix;
      contacts.push({
        id: contactId,
        kind: legacy.propertyId === 'hafenloft' ? 'company' : 'person',
        name: legacy.name,
        email: legacy.email || '',
        phone: legacy.phone || '',
      });
      tenancies.push({
        id: 'tenancy-migrated-' + suffix,
        unitId: unit.id,
        contactIds: [contactId],
        primaryContactId: contactId,
        startDate: legacy.leaseStart || '',
        endDate: '',
        coldRent: Number(legacy.monthlyRent) || 0,
        utilityAdvance: 0,
        deposit: Number(legacy.deposit) || 0,
        status: legacy.status === 'ended' ? 'ended' : 'active',
      });
    }
  }

  let documents = readStored('vermieter-demo-documents', null);
  if (!documents) {
    documents = (defaults.documents || []).filter((document) => propertyIds.has(document.propertyId));
    const existingTransactionDocuments = new Set(
      documents.filter((document) => document.ownerType === 'transaction').map((document) => document.ownerId),
    );
    for (const transaction of transactions) {
      if (!transaction.receiptName || existingTransactionDocuments.has(transaction.id)) continue;
      documents.push({
        id: 'doc-migrated-' + transaction.id,
        ownerType: 'transaction',
        ownerId: transaction.id,
        propertyId: transaction.propertyId,
        documentType: 'Rechnung / Beleg',
        name: transaction.receiptName,
        date: transaction.date,
        note: 'Aus der bisherigen Belegablage übernommen.',
        dataUrl: transaction.receiptDataUrl,
      });
    }
  }

  window.localStorage.setItem('vermieter-demo-properties', JSON.stringify(properties));
  window.localStorage.setItem('vermieter-demo-transactions', JSON.stringify(transactions));
  window.localStorage.setItem('vermieter-demo-categories', JSON.stringify(categories));
  window.localStorage.setItem('vermieter-demo-units', JSON.stringify(units));
  window.localStorage.setItem('vermieter-demo-contacts', JSON.stringify(contacts));
  window.localStorage.setItem('vermieter-demo-tenancies', JSON.stringify(tenancies));
  window.localStorage.setItem('vermieter-demo-documents', JSON.stringify(documents));
  window.localStorage.setItem(versionKey, '2');
}

export function ensureRentalSchema(defaults, migratedAt = new Date().toISOString()) {
  if (typeof window === 'undefined') return;
  ensureV2Schema(defaults);

  const versionKey = 'vermieter-demo-schema-version';
  const currentVersion = Number(window.localStorage.getItem(versionKey) || 0);
  if (currentVersion >= RENTAL_SCHEMA_VERSION) return;

  const baseState = {
    schemaVersion: currentVersion,
    properties: readStoredStrictArray(RENTAL_STORAGE_KEYS.properties),
    transactions: readStoredStrictArray(RENTAL_STORAGE_KEYS.transactions),
    categories: readStoredStrictArray(RENTAL_STORAGE_KEYS.categories),
    units: readStoredStrictArray(RENTAL_STORAGE_KEYS.units),
    contacts: readStoredStrictArray(RENTAL_STORAGE_KEYS.contacts),
    tenancies: readStoredStrictArray(RENTAL_STORAGE_KEYS.tenancies),
    documents: readStoredStrictArray(RENTAL_STORAGE_KEYS.documents),
  };
  const operationallyEmpty = [
    baseState.properties,
    baseState.transactions,
    baseState.units,
    baseState.contacts,
    baseState.tenancies,
    baseState.documents,
  ].every((rows) => rows.length === 0);
  const v3State = currentVersion < 3
    ? operationallyEmpty
      ? {
        ...baseState,
        schemaVersion: 3,
        tenancyParties: [],
        tenancyUnits: [],
        recurringRules: [],
        accountEntries: [],
        migrationIssues: [],
        migratedAt,
      }
      : migrateV2ToV3(baseState, migratedAt)
    : {
      ...baseState,
      tenancyParties: readStoredStrictArray(RENTAL_STORAGE_KEYS.tenancyParties),
      tenancyUnits: readStoredStrictArray(RENTAL_STORAGE_KEYS.tenancyUnits),
      recurringRules: readStoredStrictArray(RENTAL_STORAGE_KEYS.recurringRules),
      accountEntries: readStoredStrictArray(RENTAL_STORAGE_KEYS.accountEntries),
      migrationIssues: readStoredStrictArray(RENTAL_STORAGE_KEYS.migrationIssues),
      migratedAt: window.localStorage.getItem('vermieter-demo-migrated-at') || migratedAt,
    };
  const migrated = migrateV3ToV4(v3State, migratedAt);
  validateV4State(migrated);

  const backupKey = `vermieter-demo-v${currentVersion}-backup`;
  if (!window.localStorage.getItem(backupKey)) {
    window.localStorage.setItem(backupKey, JSON.stringify(currentVersion < 3 ? baseState : v3State));
  }

  const writes = {};
  for (const name of Object.keys(RENTAL_STORAGE_KEYS)) {
    if (name === 'tutorialProgress') continue;
    writes[name] = migrated[name] || [];
  }
  writeRentalSlicesAtomically(writes);
  window.localStorage.setItem('vermieter-demo-migrated-at-v4', migrated.migratedAtV4);
  window.localStorage.setItem(versionKey, String(RENTAL_SCHEMA_VERSION));
}
