import { useEffect, useMemo, useState } from 'react';

import { Icon } from '../Icon.jsx';
import { contactDisplayName, filterContacts } from '../../lib/tenantAreaModel.js';
import { ContactRecord } from './ContactRecord.jsx';

export function TenantContactPanel({
  contacts = [],
  properties = [],
  addressSources = [],
  tenancies = [],
  tenancyParties = [],
  tenancyUnits = [],
  units = [],
  onSaveContact,
  onCreateContact,
  focusContactId = '',
}) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [selectedId, setSelectedId] = useState(contacts[0]?.id || '');
  const [creating, setCreating] = useState(false);
  const [recordDirty, setRecordDirty] = useState(false);

  const filtered = useMemo(() => filterContacts(contacts, query, kind), [contacts, query, kind]);
  const selected = contacts.find((contact) => contact.id === selectedId) || null;
  const selectedAddressSources = useMemo(() => {
    if (!selected) return addressSources;
    const tenancyIds = new Set([
      ...tenancyParties.filter((party) => party.contactId === selected.id).map((party) => party.tenancyId),
      ...tenancies.filter((tenancy) => (tenancy.contactIds || []).includes(selected.id)).map((tenancy) => tenancy.id),
    ]);
    const unitIds = new Set([
      ...tenancyUnits.filter((relation) => tenancyIds.has(relation.tenancyId)).map((relation) => relation.unitId),
      ...tenancies.filter((tenancy) => tenancyIds.has(tenancy.id)).map((tenancy) => tenancy.unitId).filter(Boolean),
    ]);
    const linkedPropertyIds = units
      .filter((unit) => unitIds.has(unit.id))
      .map((unit) => unit.propertyId);
    return [...new Set([...addressSources.map((source) => typeof source === 'string' ? source : source?.id), ...linkedPropertyIds].filter(Boolean))];
  }, [addressSources, selected, tenancies, tenancyParties, tenancyUnits, units]);

  useEffect(() => {
    if (!creating && (!selectedId || !contacts.some((contact) => contact.id === selectedId))) {
      setSelectedId(contacts[0]?.id || '');
      setRecordDirty(false);
    }
  }, [contacts, creating, selectedId]);

  useEffect(() => {
    if (!focusContactId || !contacts.some((contact) => contact.id === focusContactId)) return;
    setSelectedId(focusContactId);
    setCreating(false);
    setRecordDirty(false);
    setQuery('');
    setKind('all');
  }, [contacts, focusContactId]);

  const mayDiscardDraft = () => (
    !recordDirty || window.confirm('Ungespeicherte Änderungen verwerfen?')
  );

  const chooseContact = (contactId) => {
    if (contactId === selectedId && !creating) return;
    if (!mayDiscardDraft()) return;
    setSelectedId(contactId);
    setCreating(false);
    setRecordDirty(false);
  };

  const startCreating = () => {
    if (!mayDiscardDraft()) return;
    setCreating(true);
    setRecordDirty(false);
  };

  const saveRecord = (payload) => (
    creating ? onCreateContact?.(payload) : onSaveContact?.(payload)
  );

  return (
    <div className="tenant-area__split">
      <section className="card tenant-directory" aria-labelledby="tenant-directory-title">
        <div className="card-header">
          <div>
            <h3 id="tenant-directory-title">Mietparteien</h3>
            <p>{contacts.length} vollständige Kontaktakten</p>
          </div>
          <button type="button" className="button button--primary button--small" onClick={startCreating}>
            Neue Mietpartei
          </button>
        </div>

        <div className="filters tenant-directory__filters">
          <label className="search-field">
            <Icon name="search" size={16} />
            <span className="tenant-area__accessible-label">Mietparteien durchsuchen</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, Ort, E-Mail …" />
          </label>
          <label className="compact-select">
            <span>Art</span>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="all">Alle</option>
              <option value="person">Personen</option>
              <option value="company">Firmen</option>
            </select>
          </label>
        </div>

        <div className="tenant-directory__list" aria-label="Gefundene Mietparteien">
          {filtered.map((contact) => {
            const communication = contact.communication || {};
            const address = contact.address || {};
            return (
              <button
                type="button"
                key={contact.id}
                className={`tenant-directory__row${selectedId === contact.id && !creating ? ' active' : ''}`}
                aria-pressed={selectedId === contact.id && !creating}
                onClick={() => chooseContact(contact.id)}
              >
                <span className="tenant-avatar">{contactDisplayName(contact).slice(0, 2).toUpperCase()}</span>
                <span className="tenant-directory__identity">
                  <strong>{contactDisplayName(contact)}</strong>
                  <small>{[address.city, communication.email || contact.email].filter(Boolean).join(' · ') || 'Keine Kontaktdaten'}</small>
                </span>
                <span className="status-badge">{contact.kind === 'company' ? 'Firma' : 'Person'}</span>
              </button>
            );
          })}
          {!filtered.length && <div className="empty-state">Keine passende Mietpartei gefunden.</div>}
        </div>
      </section>

      <section className="card tenant-record" aria-label="Kontaktakte">
        <ContactRecord
          contact={selected}
          creating={creating}
          properties={properties}
          addressSources={selectedAddressSources}
          onSave={saveRecord}
          onCancel={() => {
            setCreating(false);
            setRecordDirty(false);
          }}
          onSaved={() => {
            setCreating(false);
            setRecordDirty(false);
          }}
          dirty={recordDirty}
          onDirtyChange={setRecordDirty}
        />
      </section>
    </div>
  );
}
