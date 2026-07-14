import { useEffect, useMemo, useState } from 'react';

import { buildAnnualSettlementPreview, buildSettlementAccountEntry } from '../../lib/annualSettlement.js';
import { moneyExact } from '../../lib/format.js';
import { tenancyDisplayName } from '../../lib/tenantAreaModel.js';

function defaultPeriod(recurringRules, tenancyId) {
  const rule = recurringRules
    .filter((item) => item.tenancyId === tenancyId && item.component === 'utilityAdvance')
    .sort((left, right) => String(left.startDate).localeCompare(String(right.startDate)))[0];
  const start = rule?.startDate ? `${rule.startDate.slice(0, 7)}-01` : `${new Date().getFullYear()}-01-01`;
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { start, end: end.toISOString().slice(0, 10) };
}

export function AnnualSettlementPanel({
  contacts = [],
  tenancies = [],
  tenancyParties = [],
  tenancyUnits = [],
  units = [],
  properties = [],
  accountEntries = [],
  recurringRules = [],
  transactions = [],
  focusTenancyId = '',
  onPostSettlement,
}) {
  const firstTenancyId = focusTenancyId || tenancies[0]?.id || '';
  const initialPeriod = defaultPeriod(recurringRules, firstTenancyId);
  const [tenancyId, setTenancyId] = useState(firstTenancyId);
  const [periodStart, setPeriodStart] = useState(initialPeriod.start);
  const [periodEnd, setPeriodEnd] = useState(initialPeriod.end);
  const [bookingDate, setBookingDate] = useState(initialPeriod.end);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const nextTenancyId = focusTenancyId || tenancyId || tenancies[0]?.id || '';
    if (!nextTenancyId || nextTenancyId === tenancyId) return;
    setTenancyId(nextTenancyId);
    const period = defaultPeriod(recurringRules, nextTenancyId);
    setPeriodStart(period.start);
    setPeriodEnd(period.end);
    setBookingDate(period.end);
  }, [focusTenancyId, recurringRules, tenancies, tenancyId]);

  const scopedTransactions = useMemo(() => {
    const selectedTenancy = tenancies.find((tenancy) => tenancy.id === tenancyId);
    if (!selectedTenancy) return [];
    const selectedUnitIds = new Set([
      selectedTenancy.unitId,
      ...tenancyUnits
        .filter((relation) => relation.tenancyId === tenancyId)
        .map((relation) => relation.unitId),
    ].filter(Boolean));
    const selectedPropertyIds = new Set(
      units
        .filter((unit) => selectedUnitIds.has(unit.id))
        .map((unit) => unit.propertyId)
        .filter(Boolean),
    );
    return transactions.filter((transaction) => (
      transaction.tenancyId === tenancyId
      || selectedUnitIds.has(transaction.unitId)
      || selectedPropertyIds.has(transaction.propertyId)
    ));
  }, [tenancies, tenancyId, tenancyUnits, transactions, units]);

  const preview = useMemo(() => (
    tenancyId && periodStart && periodEnd && periodEnd >= periodStart
      ? buildAnnualSettlementPreview({
        tenancyId,
        periodStart,
        periodEnd,
        agreedUtilityAdvance: tenancies.find((tenancy) => tenancy.id === tenancyId)?.utilityAdvance,
        transactions: scopedTransactions,
        accountEntries,
        recurringRules,
      })
      : null
  ), [accountEntries, periodEnd, periodStart, recurringRules, scopedTransactions, tenancies, tenancyId]);

  const tenancyLabel = (tenancy) => tenancyDisplayName(
    tenancy,
    contacts,
    tenancyParties,
    units,
    tenancyUnits,
    properties,
  );

  const post = async () => {
    const entry = buildSettlementAccountEntry(preview, bookingDate);
    if (!entry) {
      setMessage(preview?.alreadyPosted
        ? 'Dieses Mietverhältnis und dieser Zeitraum wurden bereits abgeschlossen.'
        : 'Der Abschluss ist erst mit vollständigen Vorauszahlungs-Sollstellungen möglich.');
      return;
    }
    const saved = await onPostSettlement?.(entry);
    setMessage(saved === false ? 'Der Abschluss wurde nicht gespeichert.' : 'Abrechnungsergebnis wurde einmalig ins Mieterkonto gebucht.');
  };

  if (!tenancies.length) {
    return <section className="card annual-settlement"><div className="empty-state">Lege zuerst ein Mietverhältnis an, um eine Jahresabrechnung vorzubereiten.</div></section>;
  }

  return (
    <section className="card annual-settlement" aria-labelledby="annual-settlement-title">
      <div className="card-header">
        <div>
          <h3 id="annual-settlement-title">Jahresvorschau Betriebskosten</h3>
          <p>Kostenanteile, vereinbarte Vorauszahlungen und Ergebnis – Zahlungsrückstände bleiben separat.</p>
        </div>
      </div>

      <div className="annual-settlement__filters">
        <label><span>Mieterkonto</span><select value={tenancyId} onChange={(event) => {
          const nextId = event.target.value;
          const period = defaultPeriod(recurringRules, nextId);
          setTenancyId(nextId);
          setPeriodStart(period.start);
          setPeriodEnd(period.end);
          setBookingDate(period.end);
          setMessage('');
        }}>{tenancies.map((tenancy) => <option key={tenancy.id} value={tenancy.id}>{tenancyLabel(tenancy)}</option>)}</select></label>
        <label><span>Leistungszeitraum von</span><input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
        <label><span>Leistungszeitraum bis</span><input type="date" value={periodEnd} min={periodStart} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        <label><span>Buchungsdatum Abschluss</span><input type="date" value={bookingDate} min={periodEnd} onChange={(event) => setBookingDate(event.target.value)} /></label>
      </div>

      {preview && (
        <>
          <div className="annual-settlement__figures">
            <div><span>Umlagefähiger Kostenanteil</span><strong>{moneyExact.format(preview.allocatableCosts)}</strong></div>
            <div><span>Vereinbarte Vorauszahlungen (Soll)</span><strong>− {moneyExact.format(preview.agreedAdvanceDebit)}</strong></div>
            <div className="annual-settlement__result"><span>{preview.result >= 0 ? 'Nachforderung' : 'Guthaben'}</span><strong>{moneyExact.format(Math.abs(preview.result))}</strong></div>
            <div><span>Nicht umlagefähige Eigentümerkosten</span><strong>{moneyExact.format(preview.ownerCosts)}</strong></div>
          </div>
          <div className="annual-settlement__status">
            {preview.zeroAdvanceAgreed && !preview.unexpectedAdvanceActivity ? (
              <p>Keine Betriebskostenvorauszahlungen vereinbart: 0,00 € Soll. Der Abschluss ist ohne monatliche Vorauszahlungsregel möglich.</p>
            ) : (
              <p>
                Vorauszahlungs-Sollstellungen: {preview.actualAdvanceEntries} von {preview.expectedAdvanceEntries}.
                {preview.missingOccurrenceKeys.length > 0 && ` Es fehlen ${preview.missingOccurrenceKeys.length}.`}
                {preview.missingAdvanceRule && ' Es fehlt eine typisierte Vorauszahlungsregel für die positive Vertragsvereinbarung.'}
                {!preview.advanceAgreementKnown && ' Die vertragliche Vorauszahlung ist nicht eindeutig hinterlegt.'}
                {preview.unexpectedAdvanceActivity && ' Trotz 0,00 € Vertragsvereinbarung sind Vorauszahlungsregeln oder Sollstellungen vorhanden.'}
              </p>
            )}
            <p>Aktueller Mieterkonto-Saldo separat: <strong>{moneyExact.format(preview.currentAccountBalance)}</strong></p>
          </div>
          {message && <p className="info-banner" role="status">{message}</p>}
          <div className="tenant-form-actions">
            <button
              type="button"
              className="button button--primary"
              onClick={post}
              disabled={!preview.complete || preview.alreadyPosted || !preview.result || !bookingDate || bookingDate < periodEnd}
            >
              {preview.alreadyPosted ? 'Abschluss bereits gebucht' : 'Abrechnungsergebnis buchen'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
