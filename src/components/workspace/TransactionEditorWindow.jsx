import { CategorySelectOptions } from '../CategorySelectOptions.jsx';
import { Icon } from '../Icon.jsx';
import { readFile } from '../../lib/files.js';
import { moneyExact } from '../../lib/format.js';
import {
  activeTenancyForUnit,
  calculateAllocations,
} from '../../lib/rentalModel.js';
import { calculateServicePeriodAllocations } from '../../lib/schemaV3.js';
import { firstSelectableCategory } from '../../lib/viewHelpers.js';

const noOp = () => {};

export function TransactionEditorWindow({
  draft,
  file = null,
  manualAmounts = {},
  status = 'open',
  error = '',
  dirty = false,
  properties = [],
  categories = [],
  units = [],
  tenancies = [],
  tenancyUnits = [],
  contacts = [],
  onDraftChange = noOp,
  onFileChange = noOp,
  onManualAmountsChange = noOp,
  onStatusChange = noOp,
  onErrorChange = noOp,
  onDirtyChange = noOp,
  onSave = async () => ({ ok: false, error: 'Keine Speicherfunktion angebunden.' }),
  onRequestClose = noOp,
}) {
  if (!draft) return <div className="empty-state">Kein Buchungsentwurf geöffnet.</div>;

  const propertyUnits = units.filter((unit) => unit.propertyId === draft.propertyId);
  const selectedCategory = categories.find((category) => category.id === draft.categoryId);
  const hasServicePeriod = Boolean(draft.servicePeriodStart && draft.servicePeriodEnd);
  const allocations = draft.kind === 'expense' && draft.allocatable
    ? hasServicePeriod && draft.allocationMode !== 'manual'
      ? calculateServicePeriodAllocations({
        amount: draft.amount,
        propertyId: draft.propertyId,
        unitId: draft.unitId || null,
        mode: draft.allocationMode,
        units,
        tenancies,
        tenancyUnits,
        servicePeriodStart: draft.servicePeriodStart,
        servicePeriodEnd: draft.servicePeriodEnd,
      })
      : calculateAllocations({
        amount: draft.amount,
        propertyId: draft.propertyId,
        unitId: draft.unitId || null,
        mode: draft.allocationMode,
        units,
        tenancies,
        date: draft.date,
        manualAmounts,
      })
    : [];

  const markChanged = () => {
    onDirtyChange(true);
    onErrorChange('');
    if (status !== 'open') onStatusChange('open');
  };

  const reportValidationError = (message) => {
    onStatusChange('error');
    onErrorChange(message);
  };

  const update = (field, value) => {
    onDraftChange({ ...draft, [field]: value });
    markChanged();
  };

  const resetManualAmounts = () => onManualAmountsChange({});

  const changeKind = (kind) => {
    const category = firstSelectableCategory(categories, kind) || categories[0];
    if (!category) return;
    onDraftChange({
      ...draft,
      kind,
      categoryId: category.id,
      allocatable: kind === 'expense' && category.allocatableDefault === true,
      allocationMode: draft.unitId ? 'direct' : category.allocationModeDefault || 'area',
    });
    resetManualAmounts();
    markChanged();
  };

  const changeCategory = (categoryId) => {
    const category = categories.find((item) => item.id === categoryId);
    onDraftChange({
      ...draft,
      categoryId,
      allocatable: draft.kind === 'expense' && category?.allocatableDefault === true,
      allocationMode: draft.unitId ? 'direct' : category?.allocationModeDefault || 'area',
    });
    resetManualAmounts();
    markChanged();
  };

  const changeProperty = (propertyId) => {
    onDraftChange({
      ...draft,
      propertyId,
      unitId: '',
      allocationMode: selectedCategory?.allocationModeDefault || 'area',
    });
    resetManualAmounts();
    markChanged();
  };

  const changeUnit = (unitId) => {
    onDraftChange({
      ...draft,
      unitId,
      allocationMode: unitId ? 'direct' : selectedCategory?.allocationModeDefault || 'area',
    });
    resetManualAmounts();
    markChanged();
  };

  const changeManualAmount = (unitId, value) => {
    onManualAmountsChange({ ...manualAmounts, [unitId]: value });
    markChanged();
  };

  const selectFile = (event) => {
    const selected = event.target.files?.[0] || null;
    onFileChange(selected);
    markChanged();
    if (selected?.size > 250 * 1024) {
      reportValidationError('Der Beleg ist größer als 250 KB. Bitte die Datei verkleinern.');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    onErrorChange('');
    if (Boolean(draft.servicePeriodStart) !== Boolean(draft.servicePeriodEnd)) {
      reportValidationError('Bitte Beginn und Ende des Leistungszeitraums gemeinsam angeben.');
      return;
    }
    if (draft.servicePeriodStart && draft.servicePeriodEnd < draft.servicePeriodStart) {
      reportValidationError('Das Ende des Leistungszeitraums darf nicht vor dem Beginn liegen.');
      return;
    }
    if (draft.kind === 'expense' && draft.allocatable && draft.allocationMode === 'manual') {
      const distributed = allocations.reduce((total, allocation) => total + allocation.amount, 0);
      if (Math.abs(distributed - Number(draft.amount)) > 0.01) {
        reportValidationError('Die manuellen Anteile müssen zusammen genau dem Buchungsbetrag entsprechen.');
        return;
      }
    }
    if (file?.size > 250 * 1024) {
      reportValidationError('Der Beleg ist größer als 250 KB. Bitte die Datei verkleinern.');
      return;
    }

    const submittedAllocations = draft.kind === 'expense' && draft.allocatable
      ? hasServicePeriod && draft.allocationMode !== 'manual'
        ? calculateServicePeriodAllocations({
          amount: draft.amount,
          propertyId: draft.propertyId,
          unitId: draft.unitId || null,
          mode: draft.allocationMode,
          units,
          tenancies,
          tenancyUnits,
          servicePeriodStart: draft.servicePeriodStart,
          servicePeriodEnd: draft.servicePeriodEnd,
        })
        : allocations
      : [];

    onStatusChange('saving');
    try {
      const receiptDataUrl = file ? await readFile(file) : undefined;
      const result = await onSave({
        ...draft,
        id: draft.id || `tx-${Date.now()}`,
        amount: Number(draft.amount),
        servicePeriodStart: draft.servicePeriodStart || null,
        servicePeriodEnd: draft.servicePeriodEnd || null,
        unitId: draft.unitId || null,
        tenancyId: draft.unitId
          ? activeTenancyForUnit(tenancies, draft.unitId, draft.date, tenancyUnits)?.id || null
          : null,
        allocatable: draft.kind === 'expense' ? draft.allocatable : false,
        allocationMode: draft.kind === 'expense' && draft.allocatable ? draft.allocationMode : null,
        allocations: submittedAllocations,
        receiptName: file?.name,
        receiptDataUrl,
      });
      if (result?.ok) {
        onStatusChange('saved');
        onDirtyChange(false);
        return;
      }
      onStatusChange('error');
      onErrorChange(result?.error || 'Die Buchung konnte nicht gespeichert werden.');
    } catch (saveError) {
      onStatusChange('error');
      onErrorChange(saveError?.message || 'Die Buchung konnte nicht gespeichert werden.');
    }
  };

  const fileNote = file
    ? file.size > 250 * 1024
      ? 'Der Beleg ist größer als 250 KB. Bitte die Datei verkleinern.'
      : 'Die Datei wird lokal im Browser gespeichert.'
    : '';

  return (
    <form className="transaction-form workspace-transaction-editor" onSubmit={submit} noValidate={false}>
      <div className="kind-toggle" aria-label="Buchungsart">
        <button type="button" className={draft.kind === 'income' ? 'active' : ''} onClick={() => changeKind('income')}>Einnahme</button>
        <button type="button" className={draft.kind === 'expense' ? 'active' : ''} onClick={() => changeKind('expense')}>Ausgabe</button>
      </div>

      <div className="form-grid">
        <label>
          <span>Immobilie</span>
          <select value={draft.propertyId} onChange={(event) => changeProperty(event.target.value)} required autoFocus>
            {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </label>
        <label>
          <span>Geltungsbereich</span>
          <select value={draft.unitId || ''} onChange={(event) => changeUnit(event.target.value)}>
            <option value="">Gesamte Immobilie</option>
            {propertyUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · {unit.usageType}</option>)}
          </select>
        </label>
        <label><span>Datum</span><input type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} required /></label>
        <label>
          <span>Kategorie</span>
          <select value={draft.categoryId} onChange={(event) => changeCategory(event.target.value)} required>
            <CategorySelectOptions categories={categories} kind={draft.kind} />
          </select>
        </label>
        <label><span>Betrag in €</span><input type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => update('amount', event.target.value)} placeholder="0,00" required /></label>
        <label><span>Leistungszeitraum von</span><input type="date" value={draft.servicePeriodStart || ''} onChange={(event) => update('servicePeriodStart', event.target.value)} /></label>
        <label><span>Leistungszeitraum bis</span><input type="date" value={draft.servicePeriodEnd || ''} onChange={(event) => update('servicePeriodEnd', event.target.value)} /></label>
        <p className="form-help form-span">Jahreskosten wie Wasser, Grundsteuer oder Gebäudeversicherung werden einmalig mit ihrem vollständigen Leistungszeitraum erfasst.</p>

        {draft.kind === 'expense' && (
          <div className="allocation-box form-span">
            <div className="allocation-box__header">
              <div><strong>Kostenart & Mieteranteile</strong><span>Demo-Vorschlag – Umlagefähigkeit immer mit Mietvertrag prüfen.</span></div>
              <label className="switch-field">
                <input type="checkbox" checked={draft.allocatable === true} onChange={(event) => update('allocatable', event.target.checked)} />
                <span>{draft.allocatable ? 'Umlagefähig markiert' : 'Eigentümerkosten'}</span>
              </label>
            </div>
            {draft.allocatable ? (
              <>
                <label className="allocation-mode-select">
                  <span>Verteilerschlüssel</span>
                  <select value={draft.allocationMode} onChange={(event) => { update('allocationMode', event.target.value); resetManualAmounts(); }}>
                    <option value="area" disabled={Boolean(draft.unitId)}>Nach Wohn-/Nutzfläche</option>
                    <option value="equal" disabled={Boolean(draft.unitId)}>Gleichmäßig je Einheit</option>
                    <option value="direct" disabled={!draft.unitId}>Direkt auf ausgewählte Einheit</option>
                    <option value="manual">Manuell / externe Abrechnung</option>
                  </select>
                </label>
                <div className="allocation-preview">
                  <div className="allocation-preview__heading"><span>Einheit / Mietverhältnis</span><span>Anteil</span></div>
                  {(draft.unitId ? propertyUnits.filter((unit) => unit.id === draft.unitId) : propertyUnits).map((unit) => {
                    const tenancy = activeTenancyForUnit(tenancies, unit.id, draft.date, tenancyUnits);
                    const primary = contacts.find((contact) => contact.id === tenancy?.primaryContactId);
                    const unitAllocations = allocations.filter((row) => row.unitId === unit.id);
                    const allocationAmount = unitAllocations.reduce((total, row) => total + row.amount, 0);
                    return (
                      <div className="allocation-preview__row" key={unit.id}>
                        <span><strong>{unit.name}</strong><small>{hasServicePeriod && unitAllocations.length > 1 ? `${unitAllocations.length} zeitanteilige Mietabschnitte` : primary?.name || 'Leerstand / kein aktives Mietverhältnis'}</small></span>
                        {draft.allocationMode === 'manual' ? (
                          <label className="manual-amount"><input type="number" min="0" step="0.01" value={manualAmounts[unit.id] || ''} onChange={(event) => changeManualAmount(unit.id, event.target.value)} /><span>€</span></label>
                        ) : <strong>{moneyExact.format(allocationAmount)}</strong>}
                      </div>
                    );
                  })}
                </div>
                <p className="allocation-note">{hasServicePeriod ? 'Die Vorschau verteilt zeitanteilig nach Vertrags- beziehungsweise Einzugszeiträumen. Gespeichert wird der historische Schnappschuss.' : 'Gespeichert wird ein historischer Schnappschuss der Einheit und des am Buchungsdatum aktiven Mietverhältnisses.'}</p>
              </>
            ) : <p className="owner-cost-note">Diese Ausgabe bleibt vollständig beim Eigentümer und wird keinem Mietverhältnis zugeordnet.</p>}
          </div>
        )}

        <label className="form-span"><span>Beschreibung</span><input value={draft.description} onChange={(event) => update('description', event.target.value)} placeholder="z. B. Heizungswartung Juli" required /></label>
        <label className="upload-field form-span">
          <input type="file" accept=".pdf,image/*" onChange={selectFile} />
          <Icon name="upload" size={24} />
          <span><strong>{file?.name || 'Beleg auswählen'}</strong><small>PDF oder Bild, bis 250 KB vollständig lokal</small></span>
        </label>
        {fileNote && <p className="file-note form-span">{fileNote}</p>}
        {error && <p className="form-error form-span" role="alert">{error}</p>}
        {(status === 'saving' || status === 'saved') && !error && <p className="file-note form-span" role="status">{status === 'saving' ? 'Buchung wird gespeichert …' : 'Buchung wurde gespeichert.'}</p>}
      </div>

      <div className="modal__footer workspace-transaction-editor__footer">
        <p>Keine Cloud: Die Demo speichert ausschließlich in diesem Browser.</p>
        <div>
          <button type="button" className="button button--ghost" onClick={onRequestClose}>Abbrechen</button>
          <button type="submit" className="button button--primary" disabled={status === 'saving'}>{status === 'saving' ? 'Wird gespeichert …' : 'Buchung speichern'}</button>
        </div>
      </div>
      {dirty && <span className="tenant-area__accessible-label" aria-live="polite">Ungespeicherte Änderungen</span>}
    </form>
  );
}
