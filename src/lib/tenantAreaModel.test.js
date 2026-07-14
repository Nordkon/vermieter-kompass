import test from 'node:test';
import assert from 'node:assert/strict';

import {
  accountSummary,
  buildContactPayload,
  buildManualAccountEntryPayload,
  buildPaymentPayload,
  buildTenancyPayload,
  filterContacts,
  validateTenancyForm,
} from './tenantAreaModel.js';

test('Kontaktpayload trennt Person, Adresse und Kommunikation', () => {
  const payload = buildContactPayload({
    kind: 'person', firstName: '  Mika ', lastName: 'Muster ', birthDate: '1985-04-03',
    companyName: 'wird entfernt', street: ' Uferweg 7 ', postalCode: '10115', city: ' Berlin ',
    country: '', email: 'mika@example.de ', phone: '', mobile: '0170 123', notes: ' nett ',
  }, 'contact-7');
  assert.deepEqual(payload.address, {
    street: 'Uferweg 7', postalCode: '10115', city: 'Berlin', country: 'Deutschland',
  });
  assert.deepEqual(payload.communication, {
    email: 'mika@example.de', phone: '', mobile: '0170 123',
  });
  assert.equal(payload.id, 'contact-7');
  assert.equal(payload.name, 'Mika Muster');
  assert.equal(payload.companyName, '');
  assert.equal(payload.phone, '0170 123');
});

test('Kontaktsuche berücksichtigt strukturierte Felder', () => {
  const contacts = [{
    id: 'c1', kind: 'company', companyName: 'Anime Haus GmbH',
    address: { city: 'Köln' }, communication: { email: 'office@example.de' },
  }];
  assert.equal(filterContacts(contacts, 'köln', 'all').length, 1);
  assert.equal(filterContacts(contacts, 'anime', 'person').length, 0);
});

test('Mietverhältnispayload erzeugt genau einen Hauptkontakt und zwei Einheitenrollen', () => {
  const payload = buildTenancyPayload({
    contactIds: ['c1', 'c2', 'c1'], primaryContactId: 'c2',
    primaryUnitId: 'u1', ancillaryUnitId: 'u2',
    contractStart: '2026-08-01', contractEnd: '', moveInDate: '2026-08-02', moveOutDate: '',
    coldRent: '900.129', utilityAdvance: '200', depositAgreed: '2700',
  });
  assert.equal(payload.tenancyParties.length, 2);
  assert.equal(payload.tenancyParties.filter((party) => party.isPrimaryContact).length, 1);
  assert.deepEqual(payload.tenancyUnits.map((relation) => relation.role), ['primary', 'ancillary']);
  assert.equal(payload.tenancy.coldRent, 900.13);
  assert.equal(payload.tenancy.startDate, payload.tenancy.contractStart);
});

test('Mietverhältnisvalidierung verhindert eine fremde Nebeneinheit', () => {
  const errors = validateTenancyForm({
    contactIds: ['c1'], primaryContactId: 'c1', primaryUnitId: 'u1', ancillaryUnitId: 'g2',
    contractStart: '2026-08-01', contractEnd: '', moveInDate: '', moveOutDate: '',
  }, [
    { id: 'u1', unitKind: 'primary' },
    { id: 'g2', unitKind: 'ancillary', parentUnitId: 'u9' },
  ]);
  assert.ok(errors.some((error) => error.includes('gehört nicht')));
});

test('Mieterkonto berechnet Soll, Haben und offenen Saldo', () => {
  assert.deepEqual(accountSummary([
    { tenancyId: 't1', side: 'debit', amount: 1000 },
    { tenancyId: 't1', side: 'credit', amount: 400 },
    { tenancyId: 't2', side: 'credit', amount: 20 },
  ], 't1'), { debit: 1000, credit: 400, balance: 600 });
});

test('Teilzahlung wird als manuelle Habenbuchung aufgebaut', () => {
  assert.deepEqual(buildPaymentPayload({
    tenancyId: 't1', amount: '250.50', bookingDate: '2026-07-14', description: '',
  }), {
    tenancyId: 't1', entryType: 'payment', side: 'credit', amount: 250.5,
    bookingDate: '2026-07-14', dueDate: null, servicePeriodStart: null,
    servicePeriodEnd: null, description: 'Teilzahlung', sourceType: 'manual', sourceId: null,
  });
});

test('Abrechnungsergebnis bewahrt Buchungsseite und Leistungszeitraum', () => {
  assert.deepEqual(buildManualAccountEntryPayload({
    tenancyId: 't1', entryType: 'settlement', side: 'credit', amount: '84.75',
    bookingDate: '2026-07-14', servicePeriodStart: '2025-01-01',
    servicePeriodEnd: '2025-12-31', description: '',
  }), {
    tenancyId: 't1', entryType: 'settlement', side: 'credit', amount: 84.75,
    bookingDate: '2026-07-14', dueDate: null, servicePeriodStart: '2025-01-01',
    servicePeriodEnd: '2025-12-31', description: 'Abrechnungsergebnis',
    sourceType: 'manual', sourceId: null,
  });
});
