import { useMemo, useState } from 'react';

import { formatDate } from '../lib/format.js';
import { contextLabel } from '../lib/viewHelpers.js';
import { Icon } from './Icon.jsx';

export function DocumentsPage({ documents, properties, onOpen, onAdd }) {
  const [search, setSearch] = useState('');
  const [propertyId, setPropertyId] = useState('all');
  const [ownerType, setOwnerType] = useState('all');
  const filtered = useMemo(() => documents
    .filter((document) => propertyId === 'all' || document.propertyId === propertyId)
    .filter((document) => ownerType === 'all' || document.ownerType === ownerType)
    .filter((document) => `${document.name} ${document.documentType} ${document.note || ''}`
      .toLowerCase().includes(search.trim().toLowerCase()))
    .sort((left, right) => (right.date || '').localeCompare(left.date || '')),
  [documents, ownerType, propertyId, search]);

  return (
    <>
      <section className="page-intro">
        <div>
          <span className="section-kicker">Dokumentenablage</span>
          <h2>Verträge, Belege und Objektakten.</h2>
          <p className="muted">Alle lokal gespeicherten Dokumente mit ihrem fachlichen Bezug.</p>
        </div>
        <button type="button" className="button button--primary" onClick={onAdd} disabled={!properties.length} title={!properties.length ? 'Lege zuerst eine Immobilie an.' : undefined}>
          <Icon name="upload" size={18} /> Dokument ablegen
        </button>
      </section>
      <section className="card documents-page">
        <div className="filters">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Dokumente durchsuchen …"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select aria-label="Immobilie der Dokumente filtern" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
            <option value="all">Alle Immobilien</option>
            {properties.map((property) => <option key={property.id} value={property.id}>{property.shortName}</option>)}
          </select>
          <select aria-label="Ablagebereich filtern" value={ownerType} onChange={(event) => setOwnerType(event.target.value)}>
            <option value="all">Alle Ablagebereiche</option>
            <option value="property">Immobilien</option>
            <option value="unit">Einheiten</option>
            <option value="tenancy">Mietverhältnisse</option>
            <option value="contact">Mietparteien</option>
            <option value="transaction">Buchungen</option>
          </select>
        </div>
        <div className="table-summary"><span>{filtered.length} Dokumente</span></div>
        <div className="document-library">
          {filtered.map((document) => {
            const property = properties.find((item) => item.id === document.propertyId);
            return (
              <button type="button" className="document-library__row" key={document.id} onClick={() => onOpen(document)}>
                <span className="document-row__icon"><Icon name="file" size={18} /></span>
                <span><strong>{document.name}</strong><small>{document.documentType} · {document.date ? formatDate(document.date) : 'ohne Datum'}</small></span>
                <span><strong>{property?.shortName || 'Ohne Objekt'}</strong><small>{contextLabel(document.ownerType)}</small></span>
                <span className="document-row__action">Ansehen</span>
              </button>
            );
          })}
          {!filtered.length && <div className="document-empty"><Icon name="file" size={22} /><span>Keine passenden Dokumente gefunden.</span></div>}
        </div>
      </section>
    </>
  );
}
