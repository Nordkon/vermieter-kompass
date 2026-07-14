import { useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from '../Icon.jsx';
import { formatDate, moneyExact } from '../../lib/format.js';
import {
  accountSummary,
  buildManualAccountEntryPayload,
  filterAccountEntries,
  tenancyDisplayName,
} from '../../lib/tenantAreaModel.js';

const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value) => (value ? formatDate(value) : '—');

const entryDefaults = {
  payment: { side: 'credit', description: 'Teilzahlung' },
  correction: { side: 'debit', description: 'Korrektur' },
  settlement: { side: 'debit', description: 'Betriebskostenabrechnung' },
};

function AccountEntryForm({ defaultTenancyId, tenancies, tenancyLabel, onSubmit, onWriterStateChange }) {
  const [form, setForm] = useState({
    tenancyId: defaultTenancyId || '',
    entryType: 'payment',
    side: 'credit',
    amount: '',
    bookingDate: today(),
    servicePeriodStart: '',
    servicePeriodEnd: '',
    description: 'Teilzahlung',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    onWriterStateChange?.({
      id: 'tenant-account-entry',
      label: 'Kontobuchung erfassen',
      focusId: 'tenant-account-entry-form',
      active: dirty,
      dirty,
    });
  }, [dirty]);

  useEffect(() => () => {
    onWriterStateChange?.({ id: 'tenant-account-entry', active: false });
  }, []);

  useEffect(() => {
    if (defaultTenancyId) {
      setForm((current) => ({ ...current, tenancyId: defaultTenancyId }));
    }
  }, [defaultTenancyId]);

  const update = (field, value) => {
    setDirty(true);
    setForm((current) => {
      if (field === 'entryType') return { ...current, entryType: value, ...entryDefaults[value] };
      return { ...current, [field]: value };
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    const bookingDate = event.currentTarget.elements.bookingDate?.value || form.bookingDate;
    const servicePeriodStart = event.currentTarget.elements.servicePeriodStart?.value || '';
    const servicePeriodEnd = event.currentTarget.elements.servicePeriodEnd?.value || '';
    if (!form.tenancyId) {
      setError('Bitte ein Mieterkonto auswählen.');
      return;
    }
    if (!(Number(form.amount) > 0)) {
      setError('Bitte einen Zahlungsbetrag größer als 0 angeben.');
      return;
    }
    if (!bookingDate) {
      setError('Bitte ein Buchungsdatum angeben.');
      return;
    }
    const hasStart = Boolean(servicePeriodStart);
    const hasEnd = Boolean(servicePeriodEnd);
    if (hasStart !== hasEnd) {
      setError('Bitte den Leistungszeitraum vollständig angeben.');
      return;
    }
    if (servicePeriodStart && servicePeriodEnd < servicePeriodStart) {
      setError('Das Ende des Leistungszeitraums darf nicht vor dem Beginn liegen.');
      return;
    }
    if (form.entryType === 'settlement' && !hasStart) {
      setError('Ein Abrechnungsergebnis benötigt einen vollständigen Leistungszeitraum.');
      return;
    }
    setError('');
    if (submitting) return;
    setSubmitting(true);
    const saved = await onSubmit(buildManualAccountEntryPayload({
      ...form,
      bookingDate,
      servicePeriodStart,
      servicePeriodEnd,
    }));
    setSubmitting(false);
    if (saved !== false) {
      setForm((current) => ({ ...current, amount: '' }));
      setDirty(false);
    }
  };

  return (
    <form id="tenant-account-entry-form" className="transaction-form tenant-payment-form" onSubmit={submit} noValidate tabIndex={-1}>
      <div className="form-grid tenant-payment-form__grid">
        <label className="tenant-payment-form__account">
          <span>Mieterkonto *</span>
          <select
            value={form.tenancyId}
            onChange={(event) => update('tenancyId', event.target.value)}
            required
          >
            <option value="">Bitte auswählen</option>
            {tenancies.map((tenancy) => (
              <option key={tenancy.id} value={tenancy.id}>{tenancyLabel(tenancy)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Buchungsart *</span>
          <select value={form.entryType} onChange={(event) => update('entryType', event.target.value)}>
            <option value="payment">Zahlung</option>
            <option value="correction">Korrektur</option>
            <option value="settlement">Abrechnungsergebnis</option>
          </select>
        </label>
        <label>
          <span>Buchungsseite *</span>
          <select
            value={form.side}
            onChange={(event) => update('side', event.target.value)}
            disabled={form.entryType === 'payment'}
          >
            <option value="debit">Soll / Forderung</option>
            <option value="credit">Haben / Zahlung oder Guthaben</option>
          </select>
        </label>
        <label>
          <span>Betrag *</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(event) => update('amount', event.target.value)}
            inputMode="decimal"
            required
          />
        </label>
        <label>
          <span>Buchungsdatum *</span>
          <input
            name="bookingDate"
            type="date"
            value={form.bookingDate}
            onChange={(event) => update('bookingDate', event.target.value)}
            required
          />
        </label>
        <label>
          <span>Leistungszeitraum von{form.entryType === 'settlement' ? ' *' : ''}</span>
          <input
            name="servicePeriodStart"
            type="date"
            value={form.servicePeriodStart}
            onChange={(event) => update('servicePeriodStart', event.target.value)}
          />
        </label>
        <label>
          <span>Leistungszeitraum bis{form.entryType === 'settlement' ? ' *' : ''}</span>
          <input
            name="servicePeriodEnd"
            type="date"
            value={form.servicePeriodEnd}
            onChange={(event) => update('servicePeriodEnd', event.target.value)}
          />
        </label>
        <label className="tenant-payment-form__description">
          <span>Verwendungszweck</span>
          <input
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
          />
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="tenant-form-actions">
        <button type="submit" className="button button--primary" disabled={submitting}>{submitting ? 'Wird gespeichert …' : 'Kontobuchung erfassen'}</button>
      </div>
    </form>
  );
}

export function TenantAccountPanel({
  contacts = [],
  tenancies = [],
  tenancyParties = [],
  tenancyUnits = [],
  units = [],
  properties = [],
  accountEntries = [],
  recurringRules = [],
  onAddAccountEntry,
  onGenerateEntries,
  onVoidPayment,
  focusTenancyId = '',
  writeBlocked = false,
  onWriteBlocked,
  onWriterStateChange,
}) {
  const [tenancyId, setTenancyId] = useState('');
  const [side, setSide] = useState('all');
  const [query, setQuery] = useState('');
  const [throughDate, setThroughDate] = useState(today());
  const [voidingPaymentKey, setVoidingPaymentKey] = useState('');
  const [voidPaymentError, setVoidPaymentError] = useState('');
  const throughDateInputRef = useRef(null);

  useEffect(() => {
    if (focusTenancyId && tenancies.some((tenancy) => tenancy.id === focusTenancyId)) {
      setTenancyId(focusTenancyId);
      setSide('all');
      setQuery('');
    }
  }, [focusTenancyId, tenancies]);

  const tenancyLabel = (tenancy) => tenancyDisplayName(
    tenancy,
    contacts,
    tenancyParties,
    units,
    tenancyUnits,
    properties,
  );

  const summary = useMemo(
    () => accountSummary(accountEntries, tenancyId),
    [accountEntries, tenancyId],
  );
  const entries = useMemo(
    () => filterAccountEntries(accountEntries, tenancyId, side, query),
    [accountEntries, query, side, tenancyId],
  );
  const activeRuleCount = recurringRules.filter((rule) => (
    rule.status === 'active' && (!tenancyId || rule.tenancyId === tenancyId)
  )).length;

  const generateEntries = () => {
    if (writeBlocked) {
      onWriteBlocked?.();
      return;
    }
    const requestedThroughDate = throughDateInputRef.current?.value || throughDate;
    if (!requestedThroughDate) return;
    setThroughDate(requestedThroughDate);
    onGenerateEntries?.({ throughDate: requestedThroughDate, tenancyId: tenancyId || null });
  };

  const voidPayment = async (entry) => {
    if (writeBlocked) {
      onWriteBlocked?.();
      return;
    }
    if (typeof onVoidPayment !== 'function' || voidingPaymentKey) return;
    const confirmed = window.confirm(
      'Diese Zahlung wird gemeinsam aus Mieterkonto und Finanzen entfernt. Möchtest du die Mietzahlung wirklich stornieren?',
    );
    if (!confirmed) return;

    const paymentKey = entry.id || entry.transactionId;
    setVoidPaymentError('');
    setVoidingPaymentKey(paymentKey);
    try {
      const removed = await onVoidPayment(entry);
      if (removed === false) {
        setVoidPaymentError('Die Mietzahlung konnte nicht storniert werden. Bitte prüfe die Buchung und versuche es erneut.');
      }
    } catch {
      setVoidPaymentError('Beim Stornieren ist ein Fehler aufgetreten. Die Mietzahlung wurde nicht entfernt.');
    } finally {
      setVoidingPaymentKey('');
    }
  };

  return (
    <div className="tenant-account-area">
      <section className="metric-grid metric-grid--three" aria-label="Mieterkonto-Summen">
        <article className="metric-card metric-card--orange">
          <div className="metric-card__top"><span>Soll</span><span className="metric-card__dot" /></div>
          <strong>{moneyExact.format(summary.debit)}</strong>
          <div className="metric-card__bottom"><span>Forderungen</span><em>Belastungen</em></div>
        </article>
        <article className="metric-card metric-card--green">
          <div className="metric-card__top"><span>Haben</span><span className="metric-card__dot" /></div>
          <strong>{moneyExact.format(summary.credit)}</strong>
          <div className="metric-card__bottom"><span>Zahlungen</span><em>Gutschriften</em></div>
        </article>
        <article className="metric-card metric-card--dark">
          <div className="metric-card__top"><span>Saldo</span><span className="metric-card__dot" /></div>
          <strong>{moneyExact.format(summary.balance)}</strong>
          <div className="metric-card__bottom">
            <span>{summary.balance > 0 ? 'Offene Forderung' : summary.balance < 0 ? 'Guthaben' : 'Ausgeglichen'}</span>
            <em>Soll − Haben</em>
          </div>
        </article>
      </section>

      <section className="card tenant-account-ledger" aria-labelledby="tenant-account-title">
        <div className="card-header">
          <div>
            <h3 id="tenant-account-title">Mieterkonten</h3>
            <p>Sollstellungen, Zahlungen, Korrekturen und Abrechnungsergebnisse.</p>
          </div>
          <div className="tenant-account-ledger__generate">
            <label>
              <span>Regeln erzeugen bis</span>
              <input
                ref={throughDateInputRef}
                type="date"
                value={throughDate}
                onChange={(event) => setThroughDate(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={generateEntries}
              disabled={!throughDate || !activeRuleCount}
              aria-disabled={writeBlocked}
            >
              Sollstellungen erzeugen ({activeRuleCount})
            </button>
          </div>
        </div>

        <div className="filters tenant-account-ledger__filters">
          <label className="search-field">
            <Icon name="search" size={16} />
            <span className="tenant-area__accessible-label">Kontobuchungen durchsuchen</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Text oder Datum …"
            />
          </label>
          <label>
            <span className="tenant-area__filter-label">Mieterkonto</span>
            <select value={tenancyId} onChange={(event) => setTenancyId(event.target.value)}>
              <option value="">Alle Mieterkonten</option>
              {tenancies.map((tenancy) => (
                <option key={tenancy.id} value={tenancy.id}>{tenancyLabel(tenancy)}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="tenant-area__filter-label">Buchungsseite</span>
            <select value={side} onChange={(event) => setSide(event.target.value)}>
              <option value="all">Soll und Haben</option>
              <option value="debit">Nur Soll</option>
              <option value="credit">Nur Haben</option>
            </select>
          </label>
        </div>

        <div className="table-scroll tenant-account-ledger__table-scroll">
          <table className="data-table tenant-account-ledger__table">
            <colgroup>
              <col className="tenant-account-ledger__date-column" />
              <col className="tenant-account-ledger__account-column" />
              <col className="tenant-account-ledger__description-column" />
              <col className="tenant-account-ledger__amount-column" />
              <col className="tenant-account-ledger__amount-column" />
            </colgroup>
            <caption className="tenant-area__accessible-label">Buchungen im Mieterkonto</caption>
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">Mieterkonto</th>
                <th scope="col">Beschreibung</th>
                <th scope="col" className="align-right">Soll</th>
                <th scope="col" className="align-right">Haben</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const tenancy = tenancies.find((item) => item.id === entry.tenancyId);
                const paymentKey = entry.id || entry.transactionId;
                const canVoidPayment = (
                  entry.entryType === 'payment'
                  && Boolean(entry.transactionId)
                  && typeof onVoidPayment === 'function'
                );
                const isVoidingPayment = voidingPaymentKey === paymentKey;
                return (
                  <tr key={entry.id || `${entry.tenancyId}-${entry.bookingDate}-${entry.description}`}>
                    <td>{dateLabel(entry.bookingDate || entry.dueDate)}</td>
                    <td
                      className="tenant-account-ledger__account-cell"
                      title={tenancy ? tenancyLabel(tenancy) : 'Unbekanntes Mieterkonto'}
                    >
                      {tenancy ? tenancyLabel(tenancy) : 'Unbekanntes Mieterkonto'}
                    </td>
                    <td className="tenant-account-ledger__description-cell">
                      <strong>{entry.description || 'Kontobuchung'}</strong>
                      <small className="table-scope">
                        {entry.entryType || 'Eintrag'}
                        {entry.servicePeriodStart && entry.servicePeriodEnd
                          ? ` · ${dateLabel(entry.servicePeriodStart)}–${dateLabel(entry.servicePeriodEnd)}`
                          : ''}
                      </small>
                      {canVoidPayment && (
                        <button
                          type="button"
                          className="tenant-account-ledger__void-button"
                          onClick={() => voidPayment(entry)}
                          disabled={Boolean(voidingPaymentKey)}
                          aria-disabled={writeBlocked}
                          aria-label={`Mietzahlung ${entry.description || dateLabel(entry.bookingDate || entry.dueDate)} stornieren`}
                        >
                          {isVoidingPayment ? 'Wird storniert …' : 'Mietzahlung stornieren'}
                        </button>
                      )}
                    </td>
                    <td className="align-right amount amount--expense">
                      {entry.side === 'debit' ? moneyExact.format(Number(entry.amount || 0)) : '—'}
                    </td>
                    <td className="align-right amount amount--income">
                      {entry.side === 'credit' ? moneyExact.format(Number(entry.amount || 0)) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {voidPaymentError && (
          <p className="form-error tenant-account-ledger__void-error" role="alert">{voidPaymentError}</p>
        )}
        {!entries.length && (
          <div className="empty-state tenant-account-ledger__empty" role="status">
            <Icon name="wallet" size={22} />
            <div>
              <strong>{accountEntries.length ? 'Keine passenden Kontobuchungen' : 'Das Mieterkonto ist noch leer'}</strong>
              <span>
                {accountEntries.length
                  ? 'Passe Suche oder Filter an, um weitere Buchungen zu sehen.'
                  : 'Neue Sollstellungen, Zahlungen und Korrekturen erscheinen anschließend genau hier.'}
              </span>
            </div>
          </div>
        )}
        <div className="table-summary">
          <span>{entries.length} Buchungen</span>
          <span>Soll: <strong>{moneyExact.format(summary.debit)}</strong></span>
          <span>Haben: <strong>{moneyExact.format(summary.credit)}</strong></span>
          <span>Saldo: <strong>{moneyExact.format(summary.balance)}</strong></span>
        </div>
      </section>

      <section className="card tenant-payment-card" aria-labelledby="tenant-payment-title">
        <div className="card-header">
          <div>
            <h3 id="tenant-payment-title">Kontobuchung erfassen</h3>
            <p>Zahlungen, Korrekturen und nur das Ergebnis einer Abrechnung werden dem Mietverhältnis zugeordnet.</p>
          </div>
        </div>
        {writeBlocked ? (
          <div className="info-banner">
            <div><strong>Buchungsentwurf ist geöffnet</strong><span>Speichere oder verwirf ihn, bevor du das Mieterkonto bearbeitest.</span></div>
            <button type="button" className="button button--ghost button--small" onClick={onWriteBlocked}>Entwurf anzeigen</button>
          </div>
        ) : tenancies.length ? (
          <AccountEntryForm
            defaultTenancyId={tenancyId}
            tenancies={tenancies}
            tenancyLabel={tenancyLabel}
            onSubmit={(payload) => onAddAccountEntry?.(payload)}
            onWriterStateChange={onWriterStateChange}
          />
        ) : (
          <div className="empty-state">Für eine Zahlung wird zuerst ein Mietverhältnis benötigt.</div>
        )}
      </section>
    </div>
  );
}
