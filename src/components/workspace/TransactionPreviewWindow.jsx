import { Icon } from '../Icon.jsx';
import { formatDate, moneyExact } from '../../lib/format.js';
import { allocationLabel } from '../../lib/rentalModel.js';

const noOp = () => {};

export function TransactionPreviewWindow({
  transaction,
  property,
  unit,
  units = [],
  tenancies = [],
  contacts = [],
  category,
  parentCategory,
  readOnly = false,
  deleteArmed = false,
  onDeleteArmedChange = noOp,
  onAddDocument = noOp,
  onDelete = noOp,
  onRequestClose = noOp,
}) {
  if (!transaction) return <div className="empty-state">Keine Buchung ausgewählt.</div>;

  const categoryName = parentCategory
    ? `${parentCategory.name} › ${category?.name || 'Ohne Kategorie'}`
    : category?.name || 'Ohne Kategorie';
  const isImage = transaction.receiptDataUrl?.startsWith('data:image');
  const lockedTitle = readOnly ? 'In der schreibgeschützten Vorschau nicht verfügbar.' : undefined;

  return (
    <div className="workspace-transaction-preview">
      <div className={'receipt-amount receipt-amount--' + transaction.kind}>
        <span>{transaction.description}</span>
        <strong>{transaction.kind === 'expense' ? '− ' : '+ '}{moneyExact.format(transaction.amount)}</strong>
      </div>

      <dl className="transaction-detail-list">
        <div><dt>Immobilie</dt><dd>{property?.name || 'Unbekannt'}</dd></div>
        <div><dt>Datum</dt><dd>{formatDate(transaction.date)}</dd></div>
        <div><dt>Kategorie</dt><dd>{categoryName}</dd></div>
        <div><dt>Buchungsart</dt><dd>{transaction.kind === 'income' ? 'Einnahme' : 'Ausgabe'}</dd></div>
        <div><dt>Geltungsbereich</dt><dd>{unit?.name || 'Gesamte Immobilie'}</dd></div>
        {transaction.servicePeriodStart && transaction.servicePeriodEnd && <div><dt>Leistungszeitraum</dt><dd>{formatDate(transaction.servicePeriodStart)}–{formatDate(transaction.servicePeriodEnd)}</dd></div>}
        {transaction.kind === 'expense' && <div><dt>Kostenstatus</dt><dd>{transaction.allocatable ? 'Umlagefähig markiert' : 'Eigentümerkosten'}</dd></div>}
      </dl>

      {transaction.kind === 'expense' && transaction.allocatable && (
        <div className="detail-allocations">
          <div className="receipt-preview__header">
            <div><span>Kostenverteilung</span><strong>{allocationLabel(transaction.allocationMode)}</strong></div>
            <span className="receipt-status">Historischer Schnappschuss</span>
          </div>
          {transaction.allocations?.length ? transaction.allocations.map((allocation) => {
            const allocationUnit = units.find((item) => item.id === allocation.unitId);
            const allocationTenancy = tenancies.find((item) => item.id === allocation.tenancyId);
            const primary = contacts.find((item) => item.id === allocationTenancy?.primaryContactId);
            return (
              <div className="detail-allocation-row" key={`${allocation.unitId}-${allocation.tenancyId || 'vacant'}-${allocation.servicePeriodStart || 'snapshot'}`}>
                <span>
                  <strong>{allocationUnit?.name || 'Unbekannte Einheit'}</strong>
                  <small>{primary?.name || 'Leerstand / kein Mietverhältnis'}{allocation.servicePeriodStart && allocation.servicePeriodEnd ? ` · ${formatDate(allocation.servicePeriodStart)}–${formatDate(allocation.servicePeriodEnd)}` : ''}</small>
                </span>
                <strong>{moneyExact.format(allocation.amount)}</strong>
              </div>
            );
          }) : <p className="allocation-note">Manuelle oder externe Abrechnung – noch keine Anteile hinterlegt.</p>}
        </div>
      )}

      {transaction.receiptName ? (
        <div className="receipt-preview">
          <div className="receipt-preview__header">
            <div><span>Beleg</span><strong>{transaction.receiptName}</strong></div>
            <span className="receipt-status">{transaction.receiptDataUrl ? 'Lokal gespeichert' : 'Demo-Beleg'}</span>
          </div>
          {transaction.receiptDataUrl ? (
            isImage
              ? <img src={transaction.receiptDataUrl} alt="Belegvorschau" />
              : <iframe src={transaction.receiptDataUrl} title="Belegvorschau" />
          ) : (
            <div className="demo-invoice">
              <div className="demo-invoice__brand"><Icon name="file" size={25} /><div><strong>RECHNUNG / BELEG</strong><span>Vorführansicht ohne Originaldatei</span></div></div>
              <div className="demo-invoice__lines"><span /><span /><span /></div>
              <div className="demo-invoice__total"><span>Gesamtbetrag</span><strong>{moneyExact.format(transaction.amount)}</strong></div>
            </div>
          )}
        </div>
      ) : (
        <div className="no-document">
          <Icon name="file" size={24} />
          <div><strong>Kein Beleg hinterlegt</strong><span>Die Buchungsdetails sind trotzdem vollständig einsehbar.</span></div>
        </div>
      )}

      <div className="modal__footer receipt-modal__footer workspace-transaction-preview__footer">
        <p>{readOnly ? 'Schreibgeschützte Vorschau.' : 'Demo-Ansicht – keine revisionssichere Belegablage.'}</p>
        <div>
          <button
            type="button"
            className="button button--ghost"
            disabled={readOnly}
            title={lockedTitle}
            onClick={() => deleteArmed ? onDelete() : onDeleteArmedChange(true)}
          >
            {deleteArmed ? 'Löschen bestätigen' : 'Buchung löschen'}
          </button>
          <button type="button" className="button button--ghost" disabled={readOnly} title={lockedTitle} onClick={onAddDocument}>Dokument anhängen</button>
          {transaction.receiptDataUrl && <a className="button button--ghost" href={transaction.receiptDataUrl} target="_blank" rel="noreferrer">Original öffnen</a>}
          <button type="button" className="button button--primary" onClick={onRequestClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}
