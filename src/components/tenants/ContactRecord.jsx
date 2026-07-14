import { useEffect, useMemo, useState } from 'react';

import { formatDate } from '../../lib/format.js';
import { propertyAddressToContactForm } from '../../lib/propertyModel.js';
import {
  EMPTY_CONTACT_FORM,
  buildContactPayload,
  contactDisplayName,
  contactFormFrom,
  validateContactForm,
} from '../../lib/tenantAreaModel.js';

const detailValue = (value, fallback = '—') => String(value ?? '').trim() || fallback;

const sourceId = (source) => (typeof source === 'string' ? source : source?.id || '');

const propertyLabel = (property) => property?.shortName || property?.name || 'Unbekannte Immobilie';

function ContactRecordView({ contact }) {
  const address = contact.address || {};
  const communication = contact.communication || {};
  const isCompany = contact.kind === 'company';

  return (
    <div className="contact-record-view">
      <section className="contact-record-view__section">
        <h4>Stammdaten</h4>
        <dl className="contact-record-view__grid">
          <div><dt>Art der Mietpartei</dt><dd>{isCompany ? 'Firma' : 'Person'}</dd></div>
          <div><dt>{isCompany ? 'Firmenname' : 'Name'}</dt><dd>{detailValue(contactDisplayName(contact))}</dd></div>
          <div><dt>Geburtstag</dt><dd>{contact.birthDate ? formatDate(contact.birthDate) : 'Nicht hinterlegt'}</dd></div>
        </dl>
      </section>

      <section className="contact-record-view__section">
        <h4>Strukturierte Anschrift</h4>
        <dl className="contact-record-view__grid">
          <div className="contact-record-view__wide"><dt>Straße und Hausnummer</dt><dd>{detailValue(address.street)}</dd></div>
          <div><dt>Postleitzahl</dt><dd>{detailValue(address.postalCode)}</dd></div>
          <div><dt>Ort</dt><dd>{detailValue(address.city)}</dd></div>
          <div className="contact-record-view__wide"><dt>Land</dt><dd>{detailValue(address.country)}</dd></div>
        </dl>
      </section>

      <section className="contact-record-view__section">
        <h4>Kommunikation</h4>
        <dl className="contact-record-view__grid">
          <div className="contact-record-view__wide"><dt>E-Mail</dt><dd>{detailValue(communication.email || contact.email, 'Nicht hinterlegt')}</dd></div>
          <div><dt>Telefon</dt><dd>{detailValue(communication.phone || contact.phone, 'Nicht hinterlegt')}</dd></div>
          <div><dt>Mobil</dt><dd>{detailValue(communication.mobile, 'Nicht hinterlegt')}</dd></div>
        </dl>
      </section>

      <section className="contact-record-view__section">
        <h4>Notizen</h4>
        <p className={`contact-record-view__notes${contact.notes ? '' : ' contact-record-view__notes--empty'}`}>
          {detailValue(contact.notes, 'Nicht hinterlegt')}
        </p>
      </section>
    </div>
  );
}

function ContactForm({
  contact,
  creating,
  sourceProperties,
  focusId,
  dirty,
  onDirtyChange,
  onCancel,
  onSubmit,
}) {
  const [form, setForm] = useState(() => (
    contact ? contactFormFrom(contact) : { ...EMPTY_CONTACT_FORM }
  ));
  const [errors, setErrors] = useState([]);
  const [addressSourceId, setAddressSourceId] = useState(sourceProperties[0]?.id || '');
  const [lastCopiedSourceId, setLastCopiedSourceId] = useState('');

  useEffect(() => {
    setForm(contact ? contactFormFrom(contact) : { ...EMPTY_CONTACT_FORM });
    setErrors([]);
    setLastCopiedSourceId('');
    onDirtyChange(false);
  }, [contact, creating]);

  useEffect(() => {
    if (!sourceProperties.some((property) => property.id === addressSourceId)) {
      setAddressSourceId(sourceProperties[0]?.id || '');
    }
  }, [addressSourceId, sourceProperties]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    onDirtyChange(true);
  };

  const copyAddress = () => {
    const property = sourceProperties.find((item) => item.id === addressSourceId);
    if (!property) return;
    const hasAddress = Boolean(
      form.street || form.postalCode || form.city || (form.country && form.country !== 'Deutschland'),
    );
    if (hasAddress && !window.confirm('Die bereits eingetragene Kontaktadresse mit der Adresse des Mietobjekts überschreiben?')) {
      return;
    }
    setForm((current) => ({ ...current, ...propertyAddressToContactForm(property) }));
    setLastCopiedSourceId(property.id);
    onDirtyChange(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    const submitted = { ...form };
    const formData = new FormData(event.currentTarget);
    Object.keys(EMPTY_CONTACT_FORM).forEach((field) => {
      if (formData.has(field)) submitted[field] = String(formData.get(field) ?? '');
    });
    const nextErrors = validateContactForm(submitted);
    setErrors(nextErrors);
    if (nextErrors.length) return;
    await onSubmit(buildContactPayload(submitted, creating ? undefined : contact?.id));
  };

  return (
    <form className="transaction-form tenant-contact-form" onSubmit={submit} noValidate>
      <div className="form-grid tenant-contact-form__grid">
        <label>
          <span>Art der Mietpartei</span>
          <select id={focusId} name="kind" value={form.kind} onChange={(event) => update('kind', event.target.value)} aria-label="Art der Mietpartei">
            <option value="person">Person</option>
            <option value="company">Firma</option>
          </select>
        </label>

        {form.kind === 'person' ? (
          <>
            <label><span>Vorname *</span><input name="firstName" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} autoComplete="given-name" required /></label>
            <label><span>Nachname *</span><input name="lastName" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} autoComplete="family-name" required /></label>
            <label><span>Geburtstag</span><input name="birthDate" type="date" value={form.birthDate} onChange={(event) => update('birthDate', event.target.value)} autoComplete="bday" /></label>
          </>
        ) : (
          <label className="form-span"><span>Firmenname *</span><input name="companyName" value={form.companyName} onChange={(event) => update('companyName', event.target.value)} autoComplete="organization" required /></label>
        )}

        <fieldset className="form-span tenant-form-group">
          <legend>Strukturierte Anschrift</legend>
          {sourceProperties.length > 0 && (
            <div className="contact-address-copy">
              <label>
                <span>Adresse aus Mietobjekt</span>
                <select value={addressSourceId} onChange={(event) => setAddressSourceId(event.target.value)}>
                  {sourceProperties.map((property) => <option key={property.id} value={property.id}>{propertyLabel(property)}</option>)}
                </select>
              </label>
              <button type="button" className="button button--ghost button--small" onClick={copyAddress} disabled={!addressSourceId}>
                Adresse einmalig übernehmen
              </button>
              {lastCopiedSourceId && <small role="status">Adresse wurde als Kopie übernommen und bleibt unabhängig vom Objekt.</small>}
            </div>
          )}
          <div className="form-grid">
            <label className="form-span"><span>Straße und Hausnummer</span><input name="street" value={form.street} onChange={(event) => update('street', event.target.value)} autoComplete="street-address" /></label>
            <label><span>Postleitzahl</span><input name="postalCode" value={form.postalCode} onChange={(event) => update('postalCode', event.target.value)} autoComplete="postal-code" inputMode="numeric" /></label>
            <label><span>Ort</span><input name="city" value={form.city} onChange={(event) => update('city', event.target.value)} autoComplete="address-level2" /></label>
            <label className="form-span"><span>Land</span><input name="country" value={form.country} onChange={(event) => update('country', event.target.value)} autoComplete="country-name" /></label>
          </div>
        </fieldset>

        <fieldset className="form-span tenant-form-group">
          <legend>Kommunikation</legend>
          <div className="form-grid">
            <label className="form-span"><span>E-Mail</span><input name="email" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} autoComplete="email" /></label>
            <label><span>Telefon</span><input name="phone" type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} autoComplete="tel" /></label>
            <label><span>Mobil</span><input name="mobile" type="tel" value={form.mobile} onChange={(event) => update('mobile', event.target.value)} autoComplete="tel-national" /></label>
          </div>
        </fieldset>

        <label className="form-span"><span>Notizen</span><textarea name="notes" value={form.notes} onChange={(event) => update('notes', event.target.value)} rows="5" /></label>
      </div>

      {errors.length > 0 && <div className="form-error" role="alert" aria-live="assertive">{errors.map((error) => <div key={error}>{error}</div>)}</div>}
      <div className="tenant-form-actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>Abbrechen</button>
        <button type="submit" className="button button--primary">{creating ? 'Mietpartei anlegen' : 'Kontaktakte speichern'}</button>
      </div>
      {dirty && <span className="tenant-area__accessible-label" aria-live="polite">Ungespeicherte Änderungen</span>}
    </form>
  );
}

export function ContactRecord({
  contact = null,
  creating = false,
  properties = [],
  addressSources = [],
  onSave,
  onCancel,
  onSaved,
  dirty: controlledDirty,
  onDirtyChange,
  writeBlocked = false,
  onWriteBlocked,
  onWriterStateChange,
}) {
  const [editing, setEditing] = useState(false);
  const [internalDirty, setInternalDirty] = useState(false);
  const dirty = controlledDirty ?? internalDirty;
  const writerId = creating ? 'contact-create' : `contact-edit-${contact?.id || 'unknown'}`;
  const writerFocusId = `contact-form-focus-${writerId}`;
  const setDirty = (value) => {
    setInternalDirty(value);
    onDirtyChange?.(value);
  };
  const sourceProperties = useMemo(() => {
    if (!addressSources.length) return properties;
    const preferredIds = new Set(addressSources.map(sourceId).filter(Boolean));
    const inlineSources = addressSources.filter((source) => typeof source === 'object' && source?.id);
    const available = properties.filter((property) => preferredIds.has(property.id));
    inlineSources.forEach((property) => {
      if (!available.some((item) => item.id === property.id)) available.push(property);
    });
    properties.forEach((property) => {
      if (!available.some((item) => item.id === property.id)) available.push(property);
    });
    return available;
  }, [addressSources, properties]);

  useEffect(() => {
    setEditing(false);
    setDirty(false);
  }, [contact?.id, creating]);

  useEffect(() => {
    onWriterStateChange?.({
      id: writerId,
      label: creating ? 'Neue Mietpartei' : 'Kontaktakte bearbeiten',
      focusId: writerFocusId,
      active: creating || editing,
      dirty,
    });
  }, [creating, dirty, editing, writerId]);

  useEffect(() => () => {
    onWriterStateChange?.({ id: writerId, active: false });
  }, [writerId]);

  const save = async (payload) => {
    const saved = await onSave?.(payload);
    if (saved === false) return;
    setDirty(false);
    if (creating) onSaved?.(payload);
    else setEditing(false);
  };

  const cancel = () => {
    setDirty(false);
    if (creating) onCancel?.();
    else setEditing(false);
  };

  const startEditing = () => {
    if (writeBlocked) {
      onWriteBlocked?.();
      return;
    }
    setEditing(true);
  };

  if (!creating && !contact) return <div className="empty-state">Lege zuerst eine Mietpartei an.</div>;

  return (
    <>
      <div className="card-header">
        <div>
          <h3>{creating ? 'Neue Kontaktakte' : editing ? 'Kontaktakte bearbeiten' : 'Kontaktakte'}</h3>
          <p>Personendaten bleiben vom Mietverhältnis getrennt.</p>
        </div>
        {!creating && !editing && (
          <button id="contact-record-editor-trigger" type="button" className="button button--primary button--small" onClick={startEditing} aria-disabled={writeBlocked}>Bearbeiten</button>
        )}
      </div>
      {(creating || editing) ? (
        <ContactForm
          key={creating ? 'new-contact' : contact.id}
          contact={creating ? null : contact}
          creating={creating}
          sourceProperties={sourceProperties}
          focusId={writerFocusId}
          dirty={dirty}
          onDirtyChange={setDirty}
          onCancel={cancel}
          onSubmit={save}
        />
      ) : (
        <ContactRecordView contact={contact} />
      )}
    </>
  );
}
