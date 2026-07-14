const asArray = (value) => (Array.isArray(value) ? value : []);

const clean = (value) => String(value ?? '').trim();

const moneyValue = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const EMPTY_CONTACT_FORM = Object.freeze({
  kind: 'person',
  firstName: '',
  lastName: '',
  birthDate: '',
  companyName: '',
  street: '',
  postalCode: '',
  city: '',
  country: 'Deutschland',
  email: '',
  phone: '',
  mobile: '',
  notes: '',
});

export const EMPTY_TENANCY_FORM = Object.freeze({
  contactIds: [],
  primaryContactId: '',
  primaryUnitId: '',
  ancillaryUnitId: '',
  contractStart: '',
  contractEnd: '',
  moveInDate: '',
  moveOutDate: '',
  coldRent: '',
  utilityAdvance: '',
  depositAgreed: '',
});

export function contactDisplayName(contact = {}) {
  if (contact.kind === 'company') {
    return clean(contact.companyName || contact.name) || 'Unbekannte Firma';
  }
  return clean([contact.firstName, contact.lastName].filter(Boolean).join(' '))
    || clean(contact.name)
    || 'Unbekannte Person';
}

export function contactFormFrom(contact = {}) {
  return {
    kind: contact.kind === 'company' ? 'company' : 'person',
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    birthDate: contact.birthDate || '',
    companyName: contact.companyName || '',
    street: contact.address?.street || '',
    postalCode: contact.address?.postalCode || '',
    city: contact.address?.city || '',
    country: contact.address?.country || 'Deutschland',
    email: contact.communication?.email || contact.email || '',
    phone: contact.communication?.phone || contact.phone || '',
    mobile: contact.communication?.mobile || '',
    notes: contact.notes || '',
  };
}

export function buildContactPayload(form, contactId) {
  const kind = form.kind === 'company' ? 'company' : 'person';
  const firstName = kind === 'person' ? clean(form.firstName) : '';
  const lastName = kind === 'person' ? clean(form.lastName) : '';
  const companyName = kind === 'company' ? clean(form.companyName) : '';
  const email = clean(form.email);
  const phone = clean(form.phone);
  const mobile = clean(form.mobile);
  const payload = {
    kind,
    firstName,
    lastName,
    birthDate: kind === 'person' ? clean(form.birthDate) : '',
    companyName,
    address: {
      street: clean(form.street),
      postalCode: clean(form.postalCode),
      city: clean(form.city),
      country: clean(form.country) || 'Deutschland',
    },
    communication: { email, phone, mobile },
    notes: clean(form.notes),
    name: kind === 'company' ? companyName : clean(`${firstName} ${lastName}`),
    email,
    phone: phone || mobile,
  };
  return contactId ? { id: contactId, ...payload } : payload;
}

export function validateContactForm(form) {
  const errors = [];
  if (form.kind === 'company') {
    if (!clean(form.companyName)) errors.push('Bitte einen Firmennamen angeben.');
  } else {
    if (!clean(form.firstName)) errors.push('Bitte einen Vornamen angeben.');
    if (!clean(form.lastName)) errors.push('Bitte einen Nachnamen angeben.');
  }
  return errors;
}

export function filterContacts(contacts, query = '', kind = 'all') {
  const needle = clean(query).toLocaleLowerCase('de-DE');
  return asArray(contacts).filter((contact) => {
    if (kind !== 'all' && contact.kind !== kind) return false;
    if (!needle) return true;
    const address = contact.address || {};
    const communication = contact.communication || {};
    return [
      contactDisplayName(contact),
      contact.firstName,
      contact.lastName,
      contact.companyName,
      address.street,
      address.postalCode,
      address.city,
      communication.email || contact.email,
      communication.phone || contact.phone,
      communication.mobile,
      contact.notes,
    ].some((value) => clean(value).toLocaleLowerCase('de-DE').includes(needle));
  });
}

export function tenancyContactIds(tenancy, tenancyParties) {
  const relationIds = asArray(tenancyParties)
    .filter((relation) => relation.tenancyId === tenancy.id)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((relation) => relation.contactId);
  return relationIds.length ? relationIds : asArray(tenancy.contactIds);
}

export function tenancyUnitIds(tenancy, tenancyUnits) {
  const relations = asArray(tenancyUnits)
    .filter((relation) => relation.tenancyId === tenancy.id)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  return relations.length ? relations.map((relation) => relation.unitId) : [tenancy.unitId].filter(Boolean);
}

export function tenancyStatus(tenancy, today = new Date().toISOString().slice(0, 10)) {
  const start = tenancy.contractStart || tenancy.startDate || '';
  const end = tenancy.contractEnd || tenancy.endDate || '';
  if (tenancy.status === 'ended' || (end && end < today)) return 'ended';
  if (start && start > today) return 'planned';
  return 'active';
}

export function tenancyStatusLabel(status) {
  return { active: 'Aktiv', planned: 'Geplant', ended: 'Beendet' }[status] || status;
}

export function unitDisplayName(unit, properties = []) {
  if (!unit) return 'Unbekannte Einheit';
  const property = asArray(properties).find((item) => item.id === unit.propertyId);
  return [property?.shortName || property?.name, unit.name].filter(Boolean).join(' · ');
}

export function tenancyDisplayName(tenancy, contacts, tenancyParties, units, tenancyUnits, properties) {
  const names = tenancyContactIds(tenancy, tenancyParties)
    .map((contactId) => asArray(contacts).find((contact) => contact.id === contactId))
    .filter(Boolean)
    .map(contactDisplayName);
  const firstUnit = asArray(units).find(
    (unit) => unit.id === tenancyUnitIds(tenancy, tenancyUnits)[0],
  );
  return [names.join(' & ') || 'Mietverhältnis', unitDisplayName(firstUnit, properties)]
    .filter(Boolean)
    .join(' — ');
}

export function filterTenancies({
  tenancies,
  contacts,
  tenancyParties,
  units,
  tenancyUnits,
  properties,
  query = '',
  status = 'all',
  propertyId = 'all',
  today,
}) {
  const needle = clean(query).toLocaleLowerCase('de-DE');
  return asArray(tenancies).filter((tenancy) => {
    if (status !== 'all' && tenancyStatus(tenancy, today) !== status) return false;
    const relatedUnits = tenancyUnitIds(tenancy, tenancyUnits)
      .map((unitId) => asArray(units).find((unit) => unit.id === unitId))
      .filter(Boolean);
    if (propertyId !== 'all' && !relatedUnits.some((unit) => unit.propertyId === propertyId)) {
      return false;
    }
    if (!needle) return true;
    const haystack = [
      tenancyDisplayName(tenancy, contacts, tenancyParties, units, tenancyUnits, properties),
      tenancy.contractStart,
      tenancy.contractEnd,
      tenancy.moveInDate,
      tenancy.moveOutDate,
    ].join(' ').toLocaleLowerCase('de-DE');
    return haystack.includes(needle);
  });
}

export function validateTenancyForm(form, units) {
  const errors = [];
  const contactIds = [...new Set(asArray(form.contactIds).filter(Boolean))];
  const primaryUnit = asArray(units).find((unit) => unit.id === form.primaryUnitId);
  const ancillaryUnit = asArray(units).find((unit) => unit.id === form.ancillaryUnitId);
  if (!contactIds.length) errors.push('Bitte mindestens eine Vertragspartei auswählen.');
  if (!form.primaryContactId || !contactIds.includes(form.primaryContactId)) {
    errors.push('Bitte exakt einen Hauptkontakt aus den Vertragsparteien bestimmen.');
  }
  if (!clean(form.contractStart)) errors.push('Bitte den Vertragsbeginn angeben.');
  if (form.contractEnd && form.contractStart && form.contractEnd < form.contractStart) {
    errors.push('Das Vertragsende darf nicht vor dem Vertragsbeginn liegen.');
  }
  if (form.moveOutDate && form.moveInDate && form.moveOutDate < form.moveInDate) {
    errors.push('Der Auszug darf nicht vor dem Einzug liegen.');
  }
  if (!primaryUnit) errors.push('Bitte eine Haupteinheit auswählen.');
  else if (primaryUnit.unitKind === 'ancillary') {
    errors.push('Die Haupteinheit darf keine Garage und kein Stellplatz sein.');
  }
  if (form.ancillaryUnitId) {
    if (!ancillaryUnit || ancillaryUnit.unitKind !== 'ancillary') {
      errors.push('Als Nebeneinheit ist nur eine Garage oder ein Stellplatz zulässig.');
    } else if (ancillaryUnit.parentUnitId && ancillaryUnit.parentUnitId !== form.primaryUnitId) {
      errors.push('Die Nebeneinheit gehört nicht zur ausgewählten Haupteinheit.');
    }
  }
  return errors;
}

export function buildTenancyPayload(form) {
  const contactIds = [...new Set(asArray(form.contactIds).filter(Boolean))];
  const unitIds = [form.primaryUnitId, form.ancillaryUnitId].filter(Boolean);
  const coldRent = moneyValue(form.coldRent);
  const utilityAdvance = moneyValue(form.utilityAdvance);
  const depositAgreed = moneyValue(form.depositAgreed);
  return {
    tenancy: {
      contractStart: clean(form.contractStart),
      contractEnd: clean(form.contractEnd),
      moveInDate: clean(form.moveInDate),
      moveOutDate: clean(form.moveOutDate),
      status: 'active',
      coldRent,
      utilityAdvance,
      depositAgreed,
      startDate: clean(form.contractStart),
      endDate: clean(form.contractEnd),
      deposit: depositAgreed,
      contactIds,
      primaryContactId: form.primaryContactId,
      unitId: form.primaryUnitId,
    },
    tenancyParties: contactIds.map((contactId, index) => ({
      contactId,
      relationshipType: 'tenant',
      isPrimaryContact: contactId === form.primaryContactId,
      sortOrder: index,
    })),
    tenancyUnits: unitIds.map((unitId, index) => ({
      unitId,
      role: index === 0 ? 'primary' : 'ancillary',
      sortOrder: index,
    })),
  };
}

export function accountSummary(entries, tenancyId = '') {
  return asArray(entries)
    .filter((entry) => !tenancyId || entry.tenancyId === tenancyId)
    .reduce((summary, entry) => {
      const amount = moneyValue(entry.amount);
      if (entry.side === 'credit') summary.credit += amount;
      else summary.debit += amount;
      summary.balance = Math.round((summary.debit - summary.credit) * 100) / 100;
      return summary;
    }, { debit: 0, credit: 0, balance: 0 });
}

export function filterAccountEntries(entries, tenancyId = '', side = 'all', query = '') {
  const needle = clean(query).toLocaleLowerCase('de-DE');
  return asArray(entries)
    .filter((entry) => !tenancyId || entry.tenancyId === tenancyId)
    .filter((entry) => side === 'all' || entry.side === side)
    .filter((entry) => !needle || [entry.description, entry.bookingDate, entry.dueDate]
      .some((value) => clean(value).toLocaleLowerCase('de-DE').includes(needle)))
    .sort((left, right) => clean(right.bookingDate || right.dueDate)
      .localeCompare(clean(left.bookingDate || left.dueDate)));
}

export function buildPaymentPayload(form) {
  return buildManualAccountEntryPayload({
    ...form,
    entryType: 'payment',
    side: 'credit',
    servicePeriodStart: null,
    servicePeriodEnd: null,
  });
}

export function buildManualAccountEntryPayload(form) {
  const entryType = ['payment', 'correction', 'settlement'].includes(form.entryType)
    ? form.entryType
    : 'correction';
  const defaultDescription = {
    payment: 'Teilzahlung',
    correction: 'Korrektur',
    settlement: 'Abrechnungsergebnis',
  }[entryType];
  return {
    tenancyId: form.tenancyId,
    entryType,
    side: form.side === 'debit' ? 'debit' : 'credit',
    amount: moneyValue(form.amount),
    bookingDate: clean(form.bookingDate),
    dueDate: null,
    servicePeriodStart: clean(form.servicePeriodStart) || null,
    servicePeriodEnd: clean(form.servicePeriodEnd) || null,
    description: clean(form.description) || defaultDescription,
    sourceType: 'manual',
    sourceId: null,
  };
}
