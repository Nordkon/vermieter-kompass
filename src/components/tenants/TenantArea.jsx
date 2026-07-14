import { useEffect, useState } from 'react';

import { TenantAccountPanel } from './TenantAccountPanel.jsx';
import { AnnualSettlementPanel } from './AnnualSettlementPanel.jsx';
import { TenantContactPanel } from './TenantContactPanel.jsx';
import { TenancyPanel } from './TenancyPanel.jsx';

const TABS = [
  { id: 'contacts', label: 'Mietparteien' },
  { id: 'tenancies', label: 'Mietverhältnisse' },
  { id: 'accounts', label: 'Mieterkonten' },
];

export function TenantArea({
  contacts = [],
  tenancies = [],
  tenancyParties = [],
  tenancyUnits = [],
  units = [],
  properties = [],
  accountEntries = [],
  recurringRules = [],
  transactions = [],
  onSaveContact,
  onCreateContact,
  onCreateTenancy,
  onAddAccountEntry,
  onVoidPayment,
  onGenerateEntries,
  onPostSettlement,
  target = null,
  onBackToOrigin = null,
}) {
  const [activeTab, setActiveTab] = useState('contacts');

  useEffect(() => {
    if (target?.tab && TABS.some((tab) => tab.id === target.tab)) {
      setActiveTab(target.tab);
    }
  }, [target]);

  return (
    <div className="tenant-area">
      <section className="page-intro">
        <div>
          <span className="section-kicker">Mieter</span>
          <h2>Menschen, Verträge und Konten sauber getrennt.</h2>
          <p className="muted">
            Kontaktakten, Mietverhältnisse und Soll-/Ist-Buchungen an einem Ort.
          </p>
        </div>
      </section>

      {target?.origin && onBackToOrigin && (
        <div className="info-banner tenant-origin-banner">
          <div>
            <strong>Direkt aus der Objektakte geöffnet</strong>
            <span>{target.origin.label}</span>
          </div>
          <button type="button" className="button button--ghost button--small" onClick={onBackToOrigin}>
            Zurück zu {target.origin.label}
          </button>
        </div>
      )}

      <div className="filter-pills tenant-area__tabs" role="tablist" aria-label="Mieterbereich">
        {TABS.map((tab) => (
          <button
            type="button"
            role="tab"
            id={`tenant-tab-${tab.id}`}
            aria-controls={`tenant-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section
        role="tabpanel"
        id={`tenant-panel-${activeTab}`}
        aria-labelledby={`tenant-tab-${activeTab}`}
        tabIndex="0"
        className="tenant-area__panel"
      >
        {activeTab === 'contacts' && (
          <TenantContactPanel
            contacts={contacts}
            properties={properties}
            tenancies={tenancies}
            tenancyParties={tenancyParties}
            tenancyUnits={tenancyUnits}
            units={units}
            onSaveContact={onSaveContact}
            onCreateContact={onCreateContact}
            focusContactId={target?.contactId || ''}
          />
        )}
        {activeTab === 'tenancies' && (
          <TenancyPanel
            contacts={contacts}
            tenancies={tenancies}
            tenancyParties={tenancyParties}
            tenancyUnits={tenancyUnits}
            units={units}
            properties={properties}
            onCreateTenancy={onCreateTenancy}
            focusTenancyId={target?.tenancyId || ''}
            initialUnitId={target?.unitId || ''}
          />
        )}
        {activeTab === 'accounts' && (
          <>
            <TenantAccountPanel
              contacts={contacts}
              tenancies={tenancies}
              tenancyParties={tenancyParties}
              tenancyUnits={tenancyUnits}
              units={units}
              properties={properties}
              accountEntries={accountEntries}
              recurringRules={recurringRules}
              onAddAccountEntry={onAddAccountEntry}
              onVoidPayment={onVoidPayment}
              onGenerateEntries={onGenerateEntries}
              focusTenancyId={target?.tenancyId || ''}
            />
            <AnnualSettlementPanel
              contacts={contacts}
              tenancies={tenancies}
              tenancyParties={tenancyParties}
              tenancyUnits={tenancyUnits}
              units={units}
              properties={properties}
              accountEntries={accountEntries}
              recurringRules={recurringRules}
              transactions={transactions}
              onPostSettlement={onPostSettlement}
              focusTenancyId={target?.tenancyId || ''}
            />
          </>
        )}
      </section>
    </div>
  );
}
