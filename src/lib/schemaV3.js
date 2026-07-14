export const RENTAL_SCHEMA_VERSION = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asMoney(value) {
  return Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
}

function isoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function plusDays(date, days) {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function monthStart(date) {
  return date.slice(0, 7) + '-01';
}

function nextMonthStart(date) {
  const value = new Date(monthStart(date) + 'T00:00:00Z');
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString().slice(0, 10);
}

function daysBetweenInclusive(start, end) {
  return Math.floor((Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / DAY_MS) + 1;
}

function splitPersonName(displayName) {
  const source = String(displayName || '').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return { firstName: '', lastName: source, nameParseUncertain: Boolean(source) };
  }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1),
    nameParseUncertain: /[&/+]|\b(und|u\.)\b/i.test(source),
  };
}

function buildingTypeFor(property) {
  if (property.buildingType) return property.buildingType;
  return {
    Einfamilienhaus: 'singleFamily',
    Eigentumswohnung: 'condominium',
    Mehrfamilienhaus: 'multiFamily',
    Doppelhaus: 'duplex',
    Gewerbeeinheit: 'commercial',
    'Wohn- und Geschäftshaus': 'mixed',
  }[property.objectType] || 'unknown';
}

export function contactDisplayName(contact) {
  if (contact.kind === 'company') return contact.companyName || contact.name || 'Unbekannte Firma';
  return [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || 'Unbekannte Person';
}

function normalizeContact(contact) {
  const kind = contact.kind === 'company' ? 'company' : 'person';
  const legacyDisplayName = contact.legacyDisplayName || contact.name || '';
  const parsed = kind === 'person' ? splitPersonName(legacyDisplayName) : {};
  const address = contact.address && typeof contact.address === 'object' ? contact.address : {};
  const communication = contact.communication && typeof contact.communication === 'object'
    ? contact.communication
    : {};
  const normalized = {
    ...contact,
    kind,
    firstName: kind === 'person' ? contact.firstName ?? parsed.firstName : '',
    lastName: kind === 'person' ? contact.lastName ?? parsed.lastName : '',
    birthDate: kind === 'person' ? isoDate(contact.birthDate) : '',
    companyName: kind === 'company' ? contact.companyName || legacyDisplayName : '',
    address: {
      ...address,
      street: address.street || contact.street || '',
      postalCode: address.postalCode || contact.postalCode || '',
      city: address.city || contact.city || '',
      country: address.country || contact.country || 'Deutschland',
    },
    communication: {
      ...communication,
      email: communication.email || contact.email || '',
      phone: communication.phone || contact.phone || '',
      mobile: communication.mobile || contact.mobile || '',
    },
    notes: contact.notes || '',
    legacyDisplayName,
    nameParseUncertain: kind === 'person'
      ? contact.nameParseUncertain ?? parsed.nameParseUncertain
      : false,
  };
  normalized.name = contactDisplayName(normalized);
  normalized.email = normalized.communication.email;
  normalized.phone = normalized.communication.phone || normalized.communication.mobile;
  return normalized;
}

function missingContact(tenancyId, position) {
  return normalizeContact({
    id: `contact-missing-${tenancyId}-${position}`,
    kind: 'person',
    name: 'Unvollständiger Altkontakt',
    notes: 'Bei der Migration fehlte die referenzierte Kontaktakte.',
    migrationPlaceholder: true,
  });
}

function missingUnit(tenancyId, propertyId) {
  return {
    id: `unit-missing-${tenancyId}`,
    propertyId,
    name: 'Unvollständige Alteinheit',
    usageType: 'Unbekannt',
    floor: '',
    area: 0,
    unitKind: 'primary',
    ancillaryType: null,
    parentUnitId: null,
    migrationPlaceholder: true,
  };
}

function firstRuleDueDate(tenancy, migratedDate, dueDay = 3) {
  let candidateMonth = nextMonthStart(migratedDate);
  const contractStart = isoDate(tenancy.contractStart);
  if (contractStart && contractStart > candidateMonth) candidateMonth = monthStart(contractStart);
  let dueDate = candidateMonth.slice(0, 8) + String(dueDay).padStart(2, '0');
  if (contractStart && dueDate < contractStart) {
    dueDate = nextMonthStart(candidateMonth).slice(0, 8) + String(dueDay).padStart(2, '0');
  }
  return dueDate;
}

function makeRule(tenancy, component, amount, migratedDate) {
  const dueDay = 3;
  const startDate = firstRuleDueDate(tenancy, migratedDate, dueDay);
  const contractEnd = isoDate(tenancy.contractEnd);
  if (!amount || tenancy.status === 'ended' || (contractEnd && contractEnd < startDate)) return null;
  return {
    id: `rule-migrated-${tenancy.id}-${component}`,
    tenancyId: tenancy.id,
    frequency: 'monthly',
    interval: 1,
    dueDay,
    amount: asMoney(amount),
    component,
    description: component === 'coldRent' ? 'Kaltmiete' : 'Nebenkostenvorauszahlung',
    startDate,
    endDate: contractEnd,
    status: 'active',
    source: 'v2-migration',
    occurrenceKeyTemplate: '{ruleId}:{dueDate}',
  };
}

export function tenancyIntervalsOverlap(left, right) {
  const leftStart = isoDate(left.contractStart || left.startDate) || '0000-01-01';
  const rightStart = isoDate(right.contractStart || right.startDate) || '0000-01-01';
  const leftEnd = isoDate(left.contractEnd || left.endDate) || '9999-12-31';
  const rightEnd = isoDate(right.contractEnd || right.endDate) || '9999-12-31';
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

export function findTenancyOverlaps(tenancies, tenancyUnits) {
  const unitIdsByTenancy = new Map();
  for (const relation of asArray(tenancyUnits)) {
    const ids = unitIdsByTenancy.get(relation.tenancyId) || [];
    ids.push(relation.unitId);
    unitIdsByTenancy.set(relation.tenancyId, ids);
  }
  const overlaps = [];
  const rows = asArray(tenancies);
  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const left = rows[leftIndex];
      const right = rows[rightIndex];
      const shared = (unitIdsByTenancy.get(left.id) || []).filter((unitId) =>
        (unitIdsByTenancy.get(right.id) || []).includes(unitId));
      if (shared.length && tenancyIntervalsOverlap(left, right)) {
        overlaps.push({ tenancyIds: [left.id, right.id], unitIds: shared });
      }
    }
  }
  return overlaps;
}

export function migrateV2ToV3(input, migratedAt) {
  if (!migratedAt || Number.isNaN(Date.parse(migratedAt))) {
    throw new Error('migratedAt muss als festes ISO-Datum übergeben werden.');
  }
  if (Number(input?.schemaVersion || 0) >= RENTAL_SCHEMA_VERSION) return clone(input);

  const migratedDate = migratedAt.slice(0, 10);
  const properties = asArray(input.properties).map((property) => ({
    ...clone(property),
    buildingType: buildingTypeFor(property),
  }));
  if (!properties.length) {
    properties.push({
      id: 'property-missing-migration',
      name: 'Unvollständiges Altobjekt',
      shortName: 'Altobjekt',
      buildingType: 'unknown',
      migrationPlaceholder: true,
    });
  }
  const fallbackPropertyId = properties[0].id;

  const contacts = asArray(input.contacts).map((contact) => normalizeContact(clone(contact)));
  const contactIds = new Set(contacts.map((contact) => contact.id));
  const units = asArray(input.units).map((unit) => ({
    ...clone(unit),
    unitKind: unit.unitKind || (unit.usageType === 'Garage / Stellplatz' ? 'ancillary' : 'primary'),
    ancillaryType: unit.unitKind === 'ancillary' || unit.usageType === 'Garage / Stellplatz'
      ? unit.ancillaryType || 'parking'
      : null,
    parentUnitId: unit.parentUnitId || null,
  }));
  const unitIds = new Set(units.map((unit) => unit.id));

  const tenancies = asArray(input.tenancies).map((tenancy) => {
    const normalized = {
      ...clone(tenancy),
      contractStart: isoDate(tenancy.contractStart || tenancy.startDate),
      contractEnd: isoDate(tenancy.contractEnd || tenancy.endDate),
      moveInDate: isoDate(tenancy.moveInDate),
      moveOutDate: isoDate(tenancy.moveOutDate),
      depositAgreed: asMoney(tenancy.depositAgreed ?? tenancy.deposit),
    };
    normalized.startDate = normalized.contractStart;
    normalized.endDate = normalized.contractEnd;
    normalized.deposit = normalized.depositAgreed;
    return normalized;
  });

  const tenancyParties = [];
  const tenancyUnits = [];
  for (const tenancy of tenancies) {
    let relatedContactIds = [...new Set(asArray(tenancy.contactIds).filter(Boolean))];
    if (!relatedContactIds.length && tenancy.primaryContactId) relatedContactIds = [tenancy.primaryContactId];
    if (!relatedContactIds.length) {
      const placeholder = missingContact(tenancy.id, 0);
      contacts.push(placeholder);
      contactIds.add(placeholder.id);
      relatedContactIds = [placeholder.id];
    }
    relatedContactIds = relatedContactIds.map((contactId, index) => {
      if (contactIds.has(contactId)) return contactId;
      const placeholder = missingContact(tenancy.id, index);
      placeholder.missingReferenceId = contactId;
      contacts.push(placeholder);
      contactIds.add(placeholder.id);
      return placeholder.id;
    });
    const primaryContactId = relatedContactIds.includes(tenancy.primaryContactId)
      ? tenancy.primaryContactId
      : relatedContactIds[0];
    tenancy.contactIds = relatedContactIds;
    tenancy.primaryContactId = primaryContactId;
    relatedContactIds.forEach((contactId, index) => tenancyParties.push({
      id: `tenancy-party-${tenancy.id}-${index}`,
      tenancyId: tenancy.id,
      contactId,
      relationshipType: 'tenant',
      isPrimaryContact: contactId === primaryContactId,
      sortOrder: index,
    }));

    let unitId = tenancy.unitId;
    if (!unitId || !unitIds.has(unitId)) {
      const placeholder = missingUnit(tenancy.id, fallbackPropertyId);
      if (unitId) placeholder.missingReferenceId = unitId;
      units.push(placeholder);
      unitIds.add(placeholder.id);
      unitId = placeholder.id;
      tenancy.unitId = unitId;
    }
    tenancyUnits.push({
      id: `tenancy-unit-${tenancy.id}-0`,
      tenancyId: tenancy.id,
      unitId,
      role: 'primary',
      sortOrder: 0,
    });
  }

  const transactions = asArray(input.transactions).map((transaction) => ({
    ...clone(transaction),
    servicePeriodStart: isoDate(transaction.servicePeriodStart) || null,
    servicePeriodEnd: isoDate(transaction.servicePeriodEnd) || null,
  }));
  const recurringRules = tenancies.flatMap((tenancy) => [
    makeRule(tenancy, 'coldRent', tenancy.coldRent, migratedDate),
    makeRule(tenancy, 'utilityAdvance', tenancy.utilityAdvance, migratedDate),
  ].filter(Boolean));

  const result = {
    ...clone(input),
    schemaVersion: RENTAL_SCHEMA_VERSION,
    migratedAt,
    properties,
    units,
    contacts,
    tenancies,
    tenancyParties,
    tenancyUnits,
    recurringRules,
    accountEntries: [],
    transactions,
    categories: clone(asArray(input.categories)),
    documents: clone(asArray(input.documents)),
  };
  result.migrationIssues = findTenancyOverlaps(tenancies, tenancyUnits).map((overlap) => ({
    type: 'legacy-tenancy-overlap',
    ...overlap,
  }));
  validateV3State(result);
  return result;
}

function uniqueIds(rows, label, errors) {
  const ids = new Set();
  for (const row of asArray(rows)) {
    if (!row?.id) errors.push(`${label}: Datensatz ohne ID.`);
    else if (ids.has(row.id)) errors.push(`${label}: doppelte ID ${row.id}.`);
    else ids.add(row.id);
  }
  return ids;
}

export function validateV3State(state) {
  const errors = [];
  if (Number(state?.schemaVersion) !== RENTAL_SCHEMA_VERSION) errors.push('Schema-Version ist nicht 3.');
  const contactIds = uniqueIds(state.contacts, 'Kontakte', errors);
  const unitIds = uniqueIds(state.units, 'Einheiten', errors);
  const tenancyIds = uniqueIds(state.tenancies, 'Mietverhältnisse', errors);
  uniqueIds(state.tenancyParties, 'Mietparteien-Zuordnungen', errors);
  uniqueIds(state.tenancyUnits, 'Mietobjekt-Zuordnungen', errors);
  uniqueIds(state.recurringRules, 'Wiederholungsregeln', errors);
  uniqueIds(state.accountEntries, 'Mieterkonto', errors);

  for (const tenancy of asArray(state.tenancies)) {
    const parties = asArray(state.tenancyParties).filter((party) => party.tenancyId === tenancy.id);
    if (!parties.length) errors.push(`${tenancy.id}: keine Vertragspartei.`);
    if (parties.filter((party) => party.isPrimaryContact).length !== 1) {
      errors.push(`${tenancy.id}: Hauptkontakt ist nicht eindeutig.`);
    }
    const markedPrimary = parties.find((party) => party.isPrimaryContact)?.contactId;
    if (markedPrimary !== tenancy.primaryContactId) {
      errors.push(`${tenancy.id}: Hauptkontakt stimmt nicht mit der Parteien-Zuordnung überein.`);
    }
    if (new Set(parties.map((party) => party.contactId)).size !== parties.length) {
      errors.push(`${tenancy.id}: Kontakt doppelt zugeordnet.`);
    }
    for (const party of parties) if (!contactIds.has(party.contactId)) errors.push(`${party.id}: Kontakt fehlt.`);
    const relations = asArray(state.tenancyUnits).filter((relation) => relation.tenancyId === tenancy.id);
    if (!relations.length) errors.push(`${tenancy.id}: keine Einheit zugeordnet.`);
    if (new Set(relations.map((relation) => relation.unitId)).size !== relations.length) {
      errors.push(`${tenancy.id}: Einheit doppelt zugeordnet.`);
    }
    for (const relation of relations) if (!unitIds.has(relation.unitId)) errors.push(`${relation.id}: Einheit fehlt.`);
    if (tenancy.contractStart && tenancy.contractEnd && tenancy.contractEnd < tenancy.contractStart) {
      errors.push(`${tenancy.id}: Vertragsende liegt vor Vertragsbeginn.`);
    }
    if (tenancy.moveInDate && tenancy.moveOutDate && tenancy.moveOutDate < tenancy.moveInDate) {
      errors.push(`${tenancy.id}: Auszug liegt vor Einzug.`);
    }
  }
  for (const party of asArray(state.tenancyParties)) {
    if (!tenancyIds.has(party.tenancyId)) errors.push(`${party.id}: Mietverhältnis fehlt.`);
  }
  for (const relation of asArray(state.tenancyUnits)) {
    if (!tenancyIds.has(relation.tenancyId)) errors.push(`${relation.id}: Mietverhältnis fehlt.`);
  }
  for (const rule of asArray(state.recurringRules)) {
    if (!tenancyIds.has(rule.tenancyId)) errors.push(`${rule.id}: Mietverhältnis der Regel fehlt.`);
  }
  for (const transaction of asArray(state.transactions)) {
    const bothSet = Boolean(transaction.servicePeriodStart) === Boolean(transaction.servicePeriodEnd);
    if (!bothSet || (transaction.servicePeriodStart && transaction.servicePeriodEnd < transaction.servicePeriodStart)) {
      errors.push(`${transaction.id}: ungültiger Leistungszeitraum.`);
    }
  }
  if (errors.length) throw new Error('v3-Validierung fehlgeschlagen:\n' + errors.join('\n'));
  return true;
}

export function calculateServicePeriodAllocations({
  amount,
  propertyId,
  unitId,
  mode,
  units,
  tenancies,
  tenancyUnits,
  servicePeriodStart,
  servicePeriodEnd,
}) {
  if (!isoDate(servicePeriodStart) || !isoDate(servicePeriodEnd) || servicePeriodEnd < servicePeriodStart) return [];
  const propertyUnits = asArray(units).filter((unit) =>
    unit.propertyId === propertyId && (!unitId || unit.id === unitId));
  const numericAmount = asMoney(amount);
  if (!numericAmount || !propertyUnits.length) return [];
  const weights = propertyUnits.map((unit) => ({
    unit,
    weight: mode === 'equal' ? 1 : Math.max(0, Number(unit.area) || 0),
  }));
  const totalWeight = weights.reduce((total, row) => total + row.weight, 0) || weights.length;
  const rows = [];
  for (const [unitIndex, weighted] of weights.entries()) {
    const unitAmount = unitId || mode === 'direct'
      ? numericAmount
      : numericAmount * ((weighted.weight || 1) / totalWeight);
    const tenancyIds = asArray(tenancyUnits)
      .filter((relation) => relation.unitId === weighted.unit.id)
      .map((relation) => relation.tenancyId);
    const segments = asArray(tenancies).filter((tenancy) => tenancyIds.includes(tenancy.id)).map((tenancy) => {
      const start = [servicePeriodStart, tenancy.moveInDate || tenancy.contractStart || tenancy.startDate || servicePeriodStart]
        .sort().at(-1);
      const end = [servicePeriodEnd, tenancy.moveOutDate || tenancy.contractEnd || tenancy.endDate || servicePeriodEnd]
        .sort()[0];
      return start <= end ? { tenancy, start, end, days: daysBetweenInclusive(start, end) } : null;
    }).filter(Boolean).sort((left, right) => left.start.localeCompare(right.start));
    const timeline = [];
    let cursor = servicePeriodStart;
    for (const segment of segments) {
      if (segment.end < cursor) continue;
      if (segment.start > cursor) {
        const vacantEnd = plusDays(segment.start, -1);
        timeline.push({ tenancy: null, start: cursor, end: vacantEnd, days: daysBetweenInclusive(cursor, vacantEnd) });
      }
      const effectiveStart = segment.start > cursor ? segment.start : cursor;
      if (effectiveStart <= segment.end) {
        timeline.push({
          tenancy: segment.tenancy,
          start: effectiveStart,
          end: segment.end,
          days: daysBetweenInclusive(effectiveStart, segment.end),
        });
        cursor = plusDays(segment.end, 1);
      }
      if (cursor > servicePeriodEnd) break;
    }
    if (cursor <= servicePeriodEnd) {
      timeline.push({
        tenancy: null,
        start: cursor,
        end: servicePeriodEnd,
        days: daysBetweenInclusive(cursor, servicePeriodEnd),
      });
    }
    const totalDays = daysBetweenInclusive(servicePeriodStart, servicePeriodEnd);
    for (const segment of timeline) {
      rows.push({
        unitId: weighted.unit.id,
        tenancyId: segment.tenancy?.id || null,
        amount: Math.round(unitAmount * (segment.days / totalDays) * 100) / 100,
        servicePeriodStart: segment.start,
        servicePeriodEnd: segment.end,
        occupiedDays: segment.tenancy ? segment.days : 0,
        vacantDays: segment.tenancy ? 0 : segment.days,
      });
    }
    if (unitIndex === weights.length - 1 && rows.length) {
      const difference = Math.round((numericAmount - rows.reduce((total, row) => total + row.amount, 0)) * 100) / 100;
      rows.at(-1).amount += difference;
    }
  }
  return rows;
}

export function nextDateForFrequency(date, frequency) {
  const value = new Date(date + 'T00:00:00Z');
  if (frequency === 'quarterly') value.setUTCMonth(value.getUTCMonth() + 3);
  else if (frequency === 'yearly') value.setUTCFullYear(value.getUTCFullYear() + 1);
  else value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString().slice(0, 10);
}

export function firstDueDateOnOrAfter(startDate, dueDay = 1) {
  if (!isoDate(startDate)) return '';
  const normalizedDay = Math.min(28, Math.max(1, Number(dueDay) || 1));
  let dueDate = `${startDate.slice(0, 8)}${String(normalizedDay).padStart(2, '0')}`;
  if (dueDate < startDate) dueDate = nextDateForFrequency(dueDate, 'monthly');
  return dueDate;
}

export function normalizeRecurringRuleForTenancy(rule, tenancy, today) {
  const tenancyStart = tenancy?.contractStart || tenancy?.startDate || '';
  const tenancyEnd = tenancy?.contractEnd || tenancy?.endDate || '';
  if (!tenancy || tenancy.status === 'ended' || (tenancyEnd && tenancyEnd < today)) {
    return { valid: false, message: 'Für ein beendetes Mietverhältnis kann keine aktive Regel angelegt werden.' };
  }
  if (!isoDate(rule.startDate) || (rule.endDate && rule.endDate < rule.startDate)) {
    return { valid: false, message: 'Das Regelende darf nicht vor dem Gültigkeitsbeginn liegen.' };
  }
  if (tenancyStart && rule.startDate < tenancyStart) {
    return { valid: false, message: 'Der Gültigkeitsbeginn darf nicht vor dem Vertragsbeginn liegen.' };
  }
  const dueDay = Math.min(28, Math.max(1, Number(rule.dueDay) || 1));
  const startDate = firstDueDateOnOrAfter(rule.startDate, dueDay);
  const endDate = [rule.endDate || '', tenancyEnd].filter(Boolean).sort()[0] || '';
  if (endDate && startDate > endDate) {
    return { valid: false, message: 'Im zulässigen Vertragszeitraum liegt keine Fälligkeit mehr.' };
  }
  return { valid: true, value: { ...rule, startDate, endDate, dueDay } };
}

export function materializeRecurringEntries(rules, existingEntries, throughDate) {
  const entries = clone(asArray(existingEntries));
  const keys = new Set(entries.map((entry) => entry.occurrenceKey).filter(Boolean));
  for (const rule of asArray(rules)) {
    if (rule.status !== 'active') continue;
    let dueDate = rule.dueDay
      ? firstDueDateOnOrAfter(rule.startDate, rule.dueDay)
      : rule.startDate;
    while (dueDate && dueDate <= throughDate && (!rule.endDate || dueDate <= rule.endDate)) {
      const occurrenceKey = `${rule.id}:${dueDate}`;
      if (!keys.has(occurrenceKey)) {
        const nextPeriodDate = nextDateForFrequency(dueDate, rule.frequency);
        entries.push({
          id: `account-${rule.id}-${dueDate}`,
          tenancyId: rule.tenancyId,
          entryType: 'charge',
          side: 'debit',
          amount: asMoney(rule.amount),
          dueDate,
          bookingDate: dueDate,
          servicePeriodStart: monthStart(dueDate),
          servicePeriodEnd: plusDays(monthStart(nextPeriodDate), -1),
          description: rule.description,
          component: rule.component || 'other',
          sourceType: 'recurringRule',
          sourceId: rule.id,
          occurrenceKey,
        });
        keys.add(occurrenceKey);
      }
      dueDate = nextDateForFrequency(dueDate, rule.frequency);
    }
  }
  return entries;
}

export function accountBalance(entries, tenancyId) {
  return asArray(entries)
    .filter((entry) => !tenancyId || entry.tenancyId === tenancyId)
    .reduce((balance, entry) => balance + (entry.side === 'credit' ? -1 : 1) * asMoney(entry.amount), 0);
}
