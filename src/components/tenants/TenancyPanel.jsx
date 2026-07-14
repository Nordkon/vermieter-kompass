import { useEffect, useMemo, useState } from 'react';

import { Icon } from '../Icon.jsx';
import { formatDate, moneyExact } from '../../lib/format.js';
import { unitRentDefaults } from '../../lib/propertyModel.js';
import {
  EMPTY_TENANCY_FORM,
  buildTenancyPayload,
  contactDisplayName,
  filterContacts,
  filterTenancies,
  tenancyContactIds,
  tenancyStatus,
  tenancyStatusLabel,
  tenancyUnitIds,
  unitDisplayName,
  validateTenancyForm,
} from '../../lib/tenantAreaModel.js';

const dateLabel = (value) => (value ? formatDate(value) : 'offen');

const formValue = (value) => (value === null || value === undefined ? '' : String(value));

const plannedValues = (unit) => {
  const defaults = unitRentDefaults(unit);
  return {
    coldRent: formValue(defaults.coldRent),
    utilityAdvance: formValue(defaults.utilityAdvance),
  };
};

const initialTenancyForm = (units, initialUnitId) => {
  const initialUnit = units.find((unit) => unit.id === initialUnitId && unit.unitKind !== 'ancillary');
  return {
    ...EMPTY_TENANCY_FORM,
    contactIds: [],
    primaryUnitId: initialUnit?.id || '',
    ...(initialUnit ? plannedValues(initialUnit) : {}),
  };
};

function TenancyForm({ contacts, units, properties, initialUnitId = '', onCancel, onSubmit }) {
  const [form, setForm] = useState(() => initialTenancyForm(units, initialUnitId));
  const [errors, setErrors] = useState([]);
  const [partyQuery, setPartyQuery] = useState('');
  const [partyKind, setPartyKind] = useState('all');
  const [rentDirty, setRentDirty] = useState({ coldRent: false, utilityAdvance: false });

  const primaryUnits = units.filter((unit) => unit.unitKind !== 'ancillary');
  const selectedPrimaryUnit = units.find((unit) => unit.id === form.primaryUnitId);
  const ancillaryUnits = units.filter((unit) => (
    unit.unitKind === 'ancillary'
    && selectedPrimaryUnit
    && unit.propertyId === selectedPrimaryUnit.propertyId
    && (!unit.parentUnitId || unit.parentUnitId === selectedPrimaryUnit.id)
  ));
  const filteredContacts = useMemo(
    () => filterContacts(contacts, partyQuery, partyKind),
    [contacts, partyKind, partyQuery],
  );
  const selectedContacts = form.contactIds
    .map((contactId) => contacts.find((contact) => contact.id === contactId))
    .filter(Boolean);

  useEffect(() => {
    const initialUnit = units.find((unit) => unit.id === initialUnitId && unit.unitKind !== 'ancillary');
    if (!initialUnit) return;
    const plan = plannedValues(initialUnit);
    setForm((current) => ({
      ...current,
      primaryUnitId: initialUnit.id,
      ancillaryUnitId: '',
      coldRent: rentDirty.coldRent ? current.coldRent : plan.coldRent,
      utilityAdvance: rentDirty.utilityAdvance ? current.utilityAdvance : plan.utilityAdvance,
    }));
  }, [initialUnitId]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const toggleContact = (contactId, checked) => {
    setForm((current) => {
      const contactIds = checked
        ? [...new Set([...current.contactIds, contactId])]
        : current.contactIds.filter((id) => id !== contactId);
      const primaryContactId = contactIds.includes(current.primaryContactId)
        ? current.primaryContactId
        : contactIds[0] || '';
      return { ...current, contactIds, primaryContactId };
    });
  };

  const choosePrimaryUnit = (unitId) => {
    const unit = units.find((item) => item.id === unitId);
    const plan = plannedValues(unit);
    setForm((current) => {
      const ancillary = units.find((item) => item.id === current.ancillaryUnitId);
      const ancillaryStillFits = ancillary
        && unit
        && ancillary.propertyId === unit.propertyId
        && (!ancillary.parentUnitId || ancillary.parentUnitId === unit.id);
      return {
        ...current,
        primaryUnitId: unitId,
        ancillaryUnitId: ancillaryStillFits ? current.ancillaryUnitId : '',
        coldRent: rentDirty.coldRent ? current.coldRent : plan.coldRent,
        utilityAdvance: rentDirty.utilityAdvance ? current.utilityAdvance : plan.utilityAdvance,
      };
    });
  };

  const updateRent = (field, value) => {
    setRentDirty((current) => ({ ...current, [field]: true }));
    update(field, value);
  };

  const submit = async (event) => {
    event.preventDefault();
    const submitted = { ...form };
    const formData = new FormData(event.currentTarget);
    Object.keys(EMPTY_TENANCY_FORM).forEach((field) => {
      if (field !== 'contactIds' && formData.has(field)) {
        submitted[field] = String(formData.get(field) ?? '');
      }
    });
    setForm(submitted);
    const nextErrors = validateTenancyForm(submitted, units);
    setErrors(nextErrors);
    if (nextErrors.length) return;
    const created = await onSubmit(buildTenancyPayload(submitted));
    if (!created) {
      setErrors(['Mindestens eine Einheit ist im gewählten Vertragszeitraum bereits vermietet. Bitte Zeitraum oder Einheit korrigieren.']);
      return;
    }
    setForm({ ...EMPTY_TENANCY_FORM, contactIds: [] });
    setRentDirty({ coldRent: false, utilityAdvance: false });
    setPartyQuery('');
    setPartyKind('all');
  };

  return (
    <form className="transaction-form tenancy-editor" onSubmit={submit} noValidate>
      <fieldset className="tenant-form-group tenancy-editor__parties">
        <legend>Vertragsparteien und Hauptkontakt</legend>
        <p className="form-help">
          Mehrere Partner sind möglich. Der markierte Hauptkontakt erhält die führende Korrespondenz.
        </p>
        <div className="tenancy-party-picker__tools">
          <label className="search-field">
            <Icon name="search" size={15} />
            <span className="tenant-area__accessible-label">Vertragsparteien durchsuchen</span>
            <input type="search" value={partyQuery} onChange={(event) => setPartyQuery(event.target.value)} placeholder="Name, Ort oder E-Mail …" />
          </label>
          <label className="compact-select">
            <span>Art</span>
            <select value={partyKind} onChange={(event) => setPartyKind(event.target.value)}>
              <option value="all">Alle</option>
              <option value="person">Personen</option>
              <option value="company">Firmen</option>
            </select>
          </label>
        </div>
        {selectedContacts.length > 0 && (
          <div className="tenancy-party-picker__chips" aria-label="Ausgewählte Vertragsparteien">
            {selectedContacts.map((contact) => (
              <span className="tenancy-party-picker__chip" key={contact.id}>
                <span>{contactDisplayName(contact)}</span>
                {selectedContacts.length === 1 && <small>Hauptkontakt</small>}
                <button type="button" onClick={() => toggleContact(contact.id, false)} aria-label={`${contactDisplayName(contact)} entfernen`}><Icon name="close" size={12} /></button>
              </span>
            ))}
          </div>
        )}
        {selectedContacts.length >= 2 && (
          <fieldset className="tenancy-party-picker__primary-options">
            <legend>Hauptkontakt bestimmen</legend>
            {selectedContacts.map((contact) => (
              <label key={contact.id}>
                <input type="radio" name="primary-contact" value={contact.id} checked={form.primaryContactId === contact.id} onChange={() => update('primaryContactId', contact.id)} />
                <span>{contactDisplayName(contact)}</span>
              </label>
            ))}
          </fieldset>
        )}
        <div className="tenancy-party-picker">
          {filteredContacts.map((contact) => {
            const selected = form.contactIds.includes(contact.id);
            const communication = contact.communication || {};
            const address = contact.address || {};
            return (
              <div className="tenancy-party-picker__row" key={contact.id}>
                <label className="tenancy-party-picker__choice">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => toggleContact(contact.id, event.target.checked)}
                  />
                  <span>
                    <strong>{contactDisplayName(contact)}</strong>
                    <small>{[address.city, communication.email || contact.email].filter(Boolean).join(' · ') || (contact.kind === 'company' ? 'Firma' : 'Person')}</small>
                  </span>
                </label>
                {selected && form.contactIds.length === 1 && <span className="tenancy-party-picker__primary-hint">Hauptkontakt</span>}
              </div>
            );
          })}
          {!contacts.length && <div className="tenant-empty">Vor dem Vertrag muss eine Mietpartei angelegt werden.</div>}
          {contacts.length > 0 && !filteredContacts.length && <div className="tenant-empty">Keine passende Mietpartei gefunden.</div>}
        </div>
      </fieldset>

      <fieldset className="tenant-form-group">
        <legend>Mietobjekte</legend>
        <div className="form-grid">
          <label>
            <span>Haupteinheit *</span>
            <select
              name="primaryUnitId"
              value={form.primaryUnitId}
              onChange={(event) => choosePrimaryUnit(event.target.value)}
              required
            >
              <option value="">Bitte auswählen</option>
              {primaryUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>{unitDisplayName(unit, properties)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Nebeneinheit</span>
            <select
              name="ancillaryUnitId"
              value={form.ancillaryUnitId}
              onChange={(event) => update('ancillaryUnitId', event.target.value)}
              disabled={!form.primaryUnitId || !ancillaryUnits.length}
            >
              <option value="">Keine Garage / kein Stellplatz</option>
              {ancillaryUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>{unitDisplayName(unit, properties)}</option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="tenant-form-group">
        <legend>Vertrag und tatsächliche Nutzung</legend>
        <div className="form-grid">
          <label>
            <span>Vertragsbeginn *</span>
            <input
              name="contractStart"
              type="date"
              value={form.contractStart}
              onChange={(event) => update('contractStart', event.target.value)}
              required
            />
          </label>
          <label>
            <span>Vertragsende</span>
            <input
              name="contractEnd"
              type="date"
              value={form.contractEnd}
              min={form.contractStart || undefined}
              onChange={(event) => update('contractEnd', event.target.value)}
            />
          </label>
          <label>
            <span>Einzug</span>
            <input
              name="moveInDate"
              type="date"
              value={form.moveInDate}
              onChange={(event) => update('moveInDate', event.target.value)}
            />
          </label>
          <label>
            <span>Auszug</span>
            <input
              name="moveOutDate"
              type="date"
              value={form.moveOutDate}
              min={form.moveInDate || undefined}
              onChange={(event) => update('moveOutDate', event.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="tenant-form-group">
        <legend>Monatliche Vereinbarung</legend>
        <div className="form-grid">
          <label>
            <span>Kaltmiete</span>
            <input
              name="coldRent"
              type="number"
              min="0"
              step="0.01"
              value={form.coldRent}
              onChange={(event) => updateRent('coldRent', event.target.value)}
              inputMode="decimal"
            />
            {!rentDirty.coldRent && selectedPrimaryUnit?.targetColdRent !== undefined && (
              <small className="form-help">Planwert der ausgewählten Einheit</small>
            )}
          </label>
          <label>
            <span>Nebenkostenvorauszahlung</span>
            <input
              name="utilityAdvance"
              type="number"
              min="0"
              step="0.01"
              value={form.utilityAdvance}
              onChange={(event) => updateRent('utilityAdvance', event.target.value)}
              inputMode="decimal"
            />
            {!rentDirty.utilityAdvance && selectedPrimaryUnit?.targetUtilityAdvance !== undefined && (
              <small className="form-help">Planwert der ausgewählten Einheit</small>
            )}
          </label>
          <label>
            <span>Vereinbarte Kaution</span>
            <input
              name="depositAgreed"
              type="number"
              min="0"
              step="0.01"
              value={form.depositAgreed}
              onChange={(event) => update('depositAgreed', event.target.value)}
              inputMode="decimal"
            />
          </label>
        </div>
      </fieldset>

      {errors.length > 0 && (
        <div className="form-error" role="alert" aria-live="assertive">
          {errors.map((error) => <div key={error}>{error}</div>)}
        </div>
      )}

      <div className="tenant-form-actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>Abbrechen</button>
        <button type="submit" className="button button--primary">Mietverhältnis anlegen</button>
      </div>
    </form>
  );
}

export function TenancyPanel({
  contacts = [],
  tenancies = [],
  tenancyParties = [],
  tenancyUnits = [],
  units = [],
  properties = [],
  onCreateTenancy,
  focusTenancyId = '',
  initialUnitId = '',
  writeBlocked = false,
  onWriteBlocked,
  onWriterStateChange,
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [propertyId, setPropertyId] = useState('all');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    onWriterStateChange?.({
      id: 'tenancy-create',
      label: 'Neues Mietverhältnis',
      focusId: 'tenancy-editor-trigger',
      active: showForm,
      dirty: showForm,
    });
  }, [showForm]);

  useEffect(() => () => {
    onWriterStateChange?.({ id: 'tenancy-create', active: false });
  }, []);

  useEffect(() => {
    if (!writeBlocked && initialUnitId && units.some((unit) => unit.id === initialUnitId && unit.unitKind !== 'ancillary')) {
      setShowForm(true);
    }
  }, [initialUnitId, writeBlocked]);

  useEffect(() => {
    if (!focusTenancyId || !tenancies.some((tenancy) => tenancy.id === focusTenancyId)) return;
    setQuery('');
    setStatus('all');
    setPropertyId('all');
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`tenancy-row-${focusTenancyId}`)?.scrollIntoView({ block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusTenancyId, tenancies]);

  const filtered = useMemo(() => filterTenancies({
    tenancies,
    contacts,
    tenancyParties,
    units,
    tenancyUnits,
    properties,
    query,
    status,
    propertyId,
  }), [
    contacts,
    properties,
    propertyId,
    query,
    status,
    tenancies,
    tenancyParties,
    tenancyUnits,
    units,
  ]);

  const createTenancy = async (payload) => {
    const created = await onCreateTenancy?.(payload);
    if (created) setShowForm(false);
    return created === true;
  };

  return (
    <div className="tenancy-area">
      <section className="card tenancy-register" aria-labelledby="tenancy-register-title">
        <div className="card-header">
          <div>
            <h3 id="tenancy-register-title">Mietverhältnisse</h3>
            <p>Vertrag, Belegung und Mietparteien als getrennte Beziehungen.</p>
          </div>
          <button
            id="tenancy-editor-trigger"
            type="button"
            className="button button--primary button--small"
            onClick={() => {
              if (!showForm && writeBlocked) {
                onWriteBlocked?.();
                return;
              }
              setShowForm((current) => !current);
            }}
            aria-disabled={!showForm && writeBlocked}
          >
            {showForm ? 'Formular schließen' : 'Neues Mietverhältnis'}
          </button>
        </div>

        <div className="filters tenancy-register__filters">
          <label className="search-field">
            <Icon name="search" size={16} />
            <span className="tenant-area__accessible-label">Mietverhältnisse durchsuchen</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Mietpartei oder Einheit …"
            />
          </label>
          <label>
            <span className="tenant-area__filter-label">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Alle Status</option>
              <option value="active">Aktiv</option>
              <option value="planned">Geplant</option>
              <option value="ended">Beendet</option>
            </select>
          </label>
          <label>
            <span className="tenant-area__filter-label">Immobilie</span>
            <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
              <option value="all">Alle Immobilien</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>{property.shortName || property.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <caption className="tenant-area__accessible-label">Gefilterte Mietverhältnisse</caption>
            <thead>
              <tr>
                <th scope="col">Mietparteien</th>
                <th scope="col">Mietobjekte</th>
                <th scope="col">Vertrag</th>
                <th scope="col" className="align-right">Monatlich</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tenancy) => {
                const relatedContacts = tenancyContactIds(tenancy, tenancyParties)
                  .map((contactId) => contacts.find((contact) => contact.id === contactId))
                  .filter(Boolean);
                const relatedUnits = tenancyUnitIds(tenancy, tenancyUnits)
                  .map((unitId) => units.find((unit) => unit.id === unitId))
                  .filter(Boolean);
                const primaryParty = tenancyParties.find((party) => (
                  party.tenancyId === tenancy.id && party.isPrimaryContact
                ));
                const primaryContact = contacts.find((contact) => (
                  contact.id === (primaryParty?.contactId || tenancy.primaryContactId)
                ));
                const currentStatus = tenancyStatus(tenancy);
                return (
                  <tr
                    key={tenancy.id}
                    id={`tenancy-row-${tenancy.id}`}
                    className={focusTenancyId === tenancy.id ? 'tenant-target-row' : ''}
                    aria-selected={focusTenancyId === tenancy.id}
                  >
                    <td>
                      <strong>{relatedContacts.map(contactDisplayName).join(' & ') || 'Ohne Mietpartei'}</strong>
                      <small className="table-scope">
                        {relatedContacts.length} {relatedContacts.length === 1 ? 'Partei' : 'Parteien'}
                        {primaryContact ? ` · Hauptkontakt ${contactDisplayName(primaryContact)}` : ''}
                      </small>
                    </td>
                    <td>{relatedUnits.map((unit) => unitDisplayName(unit, properties)).join(', ')}</td>
                    <td>
                      <span>{dateLabel(tenancy.contractStart || tenancy.startDate)}</span>
                      <small className="table-scope">bis {dateLabel(tenancy.contractEnd || tenancy.endDate)}</small>
                      <small className="table-scope">
                        Einzug {dateLabel(tenancy.moveInDate)} · Auszug {dateLabel(tenancy.moveOutDate)}
                      </small>
                    </td>
                    <td className="align-right">
                      <strong>{moneyExact.format(Number(tenancy.coldRent || 0) + Number(tenancy.utilityAdvance || 0))}</strong>
                    </td>
                    <td><span className="status-badge">{tenancyStatusLabel(currentStatus)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <div className="empty-state">Keine passenden Mietverhältnisse gefunden.</div>}
        </div>
        <div className="table-summary"><span>{filtered.length} Einträge</span></div>
      </section>

      {showForm && (
        <section className="card tenancy-editor-card" aria-labelledby="tenancy-editor-title">
          <div className="card-header">
            <div>
              <h3 id="tenancy-editor-title">Neues Mietverhältnis</h3>
              <p>Bestehende Kontakte verbinden, nicht neu erfinden.</p>
            </div>
          </div>
          <TenancyForm
            key={initialUnitId || 'new-tenancy'}
            contacts={contacts}
            units={units}
            properties={properties}
            initialUnitId={initialUnitId}
            onCancel={() => setShowForm(false)}
            onSubmit={createTenancy}
          />
        </section>
      )}
    </div>
  );
}
