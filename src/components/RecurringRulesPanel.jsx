import { useState } from 'react';

import { moneyExact } from '../lib/format.js';
import { contactDisplayName, firstDueDateOnOrAfter } from '../lib/schemaV3.js';
import { Icon } from './Icon.jsx';

const frequencyLabel = {
  monthly: 'Monatlich',
  quarterly: 'Quartalsweise',
  yearly: 'Jährlich',
};

export function RecurringRulesPanel({ rules, tenancies, contacts, onCreate, onGenerate }) {
  const today = new Date().toISOString().slice(0, 10);
  const availableTenancies = tenancies.filter((tenancy) => {
    const endDate = tenancy.contractEnd || tenancy.endDate || '';
    return tenancy.status !== 'ended' && (!endDate || endDate >= today);
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tenancyId: availableTenancies[0]?.id || '',
    description: '',
    component: 'other',
    frequency: 'monthly',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    dueDay: 3,
    amount: '',
  });
  const [error, setError] = useState('');
  const selectedTenancy = availableTenancies.find((tenancy) => tenancy.id === form.tenancyId);
  const selectedTenancyStart = selectedTenancy?.contractStart || selectedTenancy?.startDate || '';
  const selectedTenancyEnd = selectedTenancy?.contractEnd || selectedTenancy?.endDate || '';
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const openForm = () => {
    setForm((current) => ({
      ...current,
      tenancyId: availableTenancies.some((tenancy) => tenancy.id === current.tenancyId)
        ? current.tenancyId
        : availableTenancies[0]?.id || '',
    }));
    setError('');
    setOpen(true);
  };
  const submit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submitted = {
      ...form,
      startDate: String(formData.get('startDate') || form.startDate || ''),
      endDate: String(formData.get('endDate') || form.endDate || ''),
      amount: Number(form.amount),
      dueDay: Number(form.dueDay),
    };
    const tenancy = availableTenancies.find((item) => item.id === submitted.tenancyId);
    const tenancyEnd = tenancy?.contractEnd || tenancy?.endDate || '';
    if (!tenancy) return setError('Bitte ein laufendes oder geplantes Mietverhältnis auswählen.');
    if (!submitted.startDate) return setError('Bitte einen Gültigkeitsbeginn angeben.');
    const tenancyStart = tenancy.contractStart || tenancy.startDate || '';
    if (tenancyStart && submitted.startDate < tenancyStart) {
      return setError('Der Gültigkeitsbeginn darf nicht vor dem Vertragsbeginn liegen.');
    }
    if (submitted.endDate && submitted.endDate < submitted.startDate) {
      return setError('Das Regelende darf nicht vor dem Gültigkeitsbeginn liegen.');
    }
    if (tenancyEnd && submitted.endDate && submitted.endDate > tenancyEnd) {
      return setError('Das Regelende darf das Vertragsende nicht überschreiten.');
    }
    const firstDueDate = firstDueDateOnOrAfter(submitted.startDate, submitted.dueDay);
    const effectiveEnd = submitted.endDate || tenancyEnd;
    if (effectiveEnd && firstDueDate > effectiveEnd) {
      return setError('Im zulässigen Vertragszeitraum liegt keine Fälligkeit mehr.');
    }
    const created = await onCreate(submitted);
    if (!created) return setError('Die Regel konnte für dieses Mietverhältnis nicht angelegt werden.');
    setError('');
    setForm((current) => ({ ...current, description: '', amount: '' }));
    setOpen(false);
  };

  return (
    <section className="card recurring-rules-card">
      <div className="card-header">
        <div><h3>Wiederkehrende Sollstellungen</h3><p>Monatlich, quartalsweise oder jährlich – mit deterministischem Vorkommnisschlüssel.</p></div>
        <div className="card-header__action rules-actions">
          <button type="button" className="button button--ghost button--small" onClick={onGenerate}>Bis heute erzeugen</button>
          <button type="button" className="button button--primary button--small" onClick={openForm} disabled={!availableTenancies.length}><Icon name="plus" size={15} /> Regel</button>
        </div>
      </div>
      <div className="rules-list">
        {rules.length > 0 && (
          <div className="rules-list__header" aria-hidden="true">
            <span>Regel / Mietpartei</span>
            <span>Rhythmus / Beginn</span>
            <span>Betrag</span>
            <span>Status</span>
          </div>
        )}
        {rules.map((rule) => {
          const tenancy = tenancies.find((item) => item.id === rule.tenancyId);
          const contact = contacts.find((item) => item.id === tenancy?.primaryContactId);
          return (
            <article className="rule-row" key={rule.id}>
              <span className="rule-row__description" data-label="Regel / Mietpartei"><strong>{rule.description}</strong><small>{contact ? contactDisplayName(contact) : 'Ohne Hauptkontakt'}</small></span>
              <span className="rule-row__frequency" data-label="Rhythmus / Beginn"><strong>{frequencyLabel[rule.frequency] || rule.frequency}</strong><small>ab {rule.startDate}</small></span>
              <span className="rule-row__amount" data-label="Betrag"><strong>{moneyExact.format(rule.amount)}</strong></span>
              <span className="rule-row__status" data-label="Status"><span className={'tenant-status ' + (rule.status === 'active' ? '' : 'tenant-status--ended')}>{rule.status === 'active' ? 'Aktiv' : 'Beendet'}</span></span>
            </article>
          );
        })}
        {!rules.length && <div className="tenant-empty"><Icon name="calendar" size={22} /><span>Noch keine Wiederholungsregeln vorhanden.</span></div>}
      </div>

      {open && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="rule-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal__header"><div><span className="section-kicker">Finanzen</span><h2 id="rule-title">Wiederholungsregel anlegen</h2></div><button type="button" className="icon-button" aria-label="Dialog schließen" onClick={() => setOpen(false)}><Icon name="close" /></button></div>
            <form className="transaction-form" onSubmit={submit} noValidate>
              <div className="form-grid">
                <label className="form-span"><span>Mietverhältnis</span><select value={form.tenancyId} onChange={(event) => update('tenancyId', event.target.value)} required>{availableTenancies.map((tenancy) => { const contact = contacts.find((item) => item.id === tenancy.primaryContactId); return <option key={tenancy.id} value={tenancy.id}>{contact ? contactDisplayName(contact) : tenancy.id}</option>; })}</select></label>
                <label className="form-span"><span>Bezeichnung</span><input value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="z. B. Garagenmiete" required /></label>
                <label><span>Rhythmus</span><select value={form.frequency} onChange={(event) => update('frequency', event.target.value)}><option value="monthly">Monatlich</option><option value="quarterly">Quartalsweise</option><option value="yearly">Jährlich</option></select></label>
                <label><span>Komponente</span><select value={form.component} onChange={(event) => update('component', event.target.value)}><option value="coldRent">Kaltmiete</option><option value="utilityAdvance">Nebenkostenvorauszahlung</option><option value="other">Sonstige Forderung</option></select></label>
                <label><span>Gültig ab</span><input name="startDate" type="date" min={selectedTenancyStart || undefined} value={form.startDate} onChange={(event) => update('startDate', event.target.value)} required /></label>
                <label><span>Ende optional</span><input name="endDate" type="date" value={form.endDate} min={form.startDate || undefined} max={selectedTenancyEnd || undefined} onChange={(event) => update('endDate', event.target.value)} /></label>
                <label><span>Fälligkeitstag</span><input type="number" min="1" max="28" value={form.dueDay} onChange={(event) => update('dueDay', event.target.value)} required /></label>
                <label><span>Betrag in €</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => update('amount', event.target.value)} required /></label>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="modal__footer"><p>Bereits erzeugte Kontoeinträge bleiben bei späteren Regeländerungen unverändert.</p><div><button type="button" className="button button--ghost" onClick={() => setOpen(false)}>Abbrechen</button><button type="submit" className="button button--primary">Regel speichern</button></div></div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
