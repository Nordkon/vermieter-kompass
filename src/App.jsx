import { useEffect, useMemo, useState } from 'react';
import { CategoryFilterOptions } from './components/CategoryFilterOptions.jsx';
import { CategorySelectOptions } from './components/CategorySelectOptions.jsx';
import { CardHeader, ContextFact, Legend, MetricCard } from './components/CommonUi.jsx';
import { DocumentList } from './components/DocumentList.jsx';
import { DocumentsPage } from './components/DocumentsPage.jsx';
import { Icon } from './components/Icon.jsx';
import { RecurringRulesPanel } from './components/RecurringRulesPanel.jsx';
import { ContactRecord } from './components/tenants/ContactRecord.jsx';
import { TenantArea } from './components/tenants/TenantArea.jsx';
import { TutorialCoach, TutorialSettingsCard } from './components/TutorialCoach.jsx';
import {
  DEMO_YEAR,
  demoCategories,
  demoAccountEntries,
  demoContacts,
  demoDocuments,
  demoProperties,
  demoRecurringRules,
  demoTasks,
  demoTenancyParties,
  demoTenancies,
  demoTenancyUnits,
  demoTransactions,
  demoUnits,
} from './data/demoData.js';
import { categoryMatchesFilter, categoryPathNames } from './lib/categoryFilter.js';
import { formatDate, money, moneyExact, number, shortMonth } from './lib/format.js';
import { readFile } from './lib/files.js';
import { matchesGermanSearch } from './lib/germanSearch.js';
import {
  activeTenancyForUnit,
  allocationLabel,
  calculateAllocations,
  documentsForContext,
  generateUnitsForProperty,
  isTenancyActive,
  tenancyHasIntervalConflict,
  tenancyUnitIds,
  transactionMatchesTenancy,
  transactionMatchesUnit,
  validateUnitStructure,
} from './lib/rentalModel.js';
import {
  activeContractSummary,
  propertyAddressLine,
  unitPlanSummary,
} from './lib/propertyModel.js';
import {
  buildLinkedTenantPayment,
  isLinkedTenantPaymentTransaction,
  voidLinkedTenantPayment,
} from './lib/paymentLink.js';
import {
  calculateServicePeriodAllocations,
  materializeRecurringEntries,
  normalizeRecurringRuleForTenancy,
} from './lib/schemaV3.js';
import {
  ensureRentalSchema,
  readRentalStorageSnapshot,
  useLocalStorage,
  writeRentalSlicesAtomically,
} from './lib/storage.js';
import {
  belongsToTutorial,
  buildTutorialCleanupPlan,
  EMPTY_TUTORIAL_PROGRESS,
  finishTutorialStep,
  startTutorialProgress,
} from './lib/tutorialModel.js';
import {
  contextLabel,
  firstSelectableCategory,
  getMonth,
  getYear,
  initials,
  sum,
  tenancyStateLabel,
} from './lib/viewHelpers.js';

ensureRentalSchema({
  properties: [],
  transactions: [],
  categories: demoCategories,
  units: [],
  contacts: [],
  tenancies: [],
  documents: [],
  generateUnitsForProperty,
});

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Übersicht', icon: 'dashboard' },
  { id: 'properties', label: 'Immobilien', icon: 'building' },
  { id: 'tenants', label: 'Mieter', icon: 'home' },
  { id: 'transactions', label: 'Finanzen', icon: 'wallet' },
  { id: 'documents', label: 'Dokumente', icon: 'file' },
  { id: 'reports', label: 'Auswertungen', icon: 'chart' },
  { id: 'categories', label: 'Einstellungen/Kategorien', icon: 'tags' },
];

const PAGE_TITLES = {
  dashboard: 'Übersicht',
  properties: 'Immobilien',
  tenants: 'Mieter',
  transactions: 'Finanzen',
  documents: 'Dokumente',
  reports: 'Auswertungen',
  categories: 'Einstellungen/Kategorien',
  detail: 'Immobiliendetails',
};

function buildingTypeFromObjectType(objectType) {
  return {
    Einfamilienhaus: 'singleFamily',
    Eigentumswohnung: 'condominium',
    Mehrfamilienhaus: 'multiFamily',
    Doppelhaus: 'duplex',
    Gewerbeeinheit: 'commercial',
    'Wohn- und Geschäftshaus': 'mixed',
  }[objectType] || 'unknown';
}

function formatPlanValue(amount, configured, totalUnits, multiplier = 1) {
  if (!(totalUnits > 0) || configured === 0) return 'Nicht gepflegt';
  const formatted = moneyExact.format(Number(amount || 0) * multiplier);
  return configured < totalUnits
    ? `${formatted} · ${configured}/${totalUnits} gepflegt · unvollständig`
    : formatted;
}

function planCompletenessLabel(configured, totalUnits) {
  if (!(totalUnits > 0) || configured === 0) return 'Nicht gepflegt';
  return configured < totalUnits
    ? `${configured}/${totalUnits} gepflegt · unvollständig`
    : `${configured}/${totalUnits} gepflegt`;
}

function formWarmPlanLabel(coldRent, utilityAdvance) {
  const coldConfigured = coldRent !== '' && coldRent !== null && coldRent !== undefined;
  const utilityConfigured = utilityAdvance !== '' && utilityAdvance !== null && utilityAdvance !== undefined;
  if (!coldConfigured && !utilityConfigured) return 'Nicht gepflegt';
  const sum = Number(coldRent || 0) + Number(utilityAdvance || 0);
  return coldConfigured && utilityConfigured
    ? moneyExact.format(sum)
    : `${moneyExact.format(sum)} · unvollständig`;
}

function nextRentDueDate(contractStart, dueDay = 3) {
  const today = new Date().toISOString().slice(0, 10);
  const earliest = contractStart && contractStart > today ? contractStart : today;
  let dueDate = earliest.slice(0, 8) + String(dueDay).padStart(2, '0');
  if (dueDate < earliest) {
    const next = new Date(earliest.slice(0, 7) + '-01T00:00:00Z');
    next.setUTCMonth(next.getUTCMonth() + 1);
    dueDate = next.toISOString().slice(0, 8) + String(dueDay).padStart(2, '0');
  }
  return dueDate;
}

function App() {
  const [properties, setProperties] = useLocalStorage(
    'vermieter-demo-properties',
    [],
  );
  const [transactions, setTransactions] = useLocalStorage(
    'vermieter-demo-transactions',
    [],
  );
  const [categories, setCategories] = useLocalStorage(
    'vermieter-demo-categories',
    demoCategories,
  );
  const [units, setUnits] = useLocalStorage('vermieter-demo-units', []);
  const [contacts, setContacts] = useLocalStorage('vermieter-demo-contacts', []);
  const [tenancies, setTenancies] = useLocalStorage(
    'vermieter-demo-tenancies',
    [],
  );
  const [documents, setDocuments] = useLocalStorage(
    'vermieter-demo-documents',
    [],
  );
  const [tenancyParties, setTenancyParties] = useLocalStorage(
    'vermieter-demo-tenancy-parties',
    [],
  );
  const [tenancyUnits, setTenancyUnits] = useLocalStorage(
    'vermieter-demo-tenancy-units',
    [],
  );
  const [recurringRules, setRecurringRules] = useLocalStorage(
    'vermieter-demo-recurring-rules',
    [],
  );
  const [accountEntries, setAccountEntries] = useLocalStorage(
    'vermieter-demo-account-entries',
    [],
  );
  const [migrationIssues, setMigrationIssues] = useLocalStorage('vermieter-demo-migration-issues', []);
  const [tutorialProgress, setTutorialProgress] = useLocalStorage(
    'vermieter-demo-tutorial-progress',
    EMPTY_TUTORIAL_PROGRESS,
  );
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?.id || '');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transactionModal, setTransactionModal] = useState(null);
  const [propertyModal, setPropertyModal] = useState(false);
  const [unitModal, setUnitModal] = useState(null);
  const [documentModal, setDocumentModal] = useState(null);
  const [documentDetail, setDocumentDetail] = useState(null);
  const [transactionDetail, setTransactionDetail] = useState(null);
  const [toast, setToast] = useState('');
  const [tenantTarget, setTenantTarget] = useState(null);

  useEffect(() => {
    const handleStorageError = (event) => {
      setToast(`Speichern fehlgeschlagen: ${event.detail?.message || 'Der lokale Speicher ist voll oder nicht verfügbar.'}`);
    };
    window.addEventListener('vermieter-storage-error', handleStorageError);
    return () => window.removeEventListener('vermieter-storage-error', handleStorageError);
  }, []);

  useEffect(() => {
    if (!properties.length) {
      setSelectedPropertyId('');
      if (activeView === 'detail') setActiveView('properties');
      return;
    }
    if (!properties.some((property) => property.id === selectedPropertyId)) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [activeView, properties, selectedPropertyId]);

  const tutorialSessionId = tutorialProgress.status === 'active'
    ? tutorialProgress.sessionId
    : '';
  const withTutorialTag = (record) => tutorialSessionId
    ? { ...record, tutorialSessionId }
    : record;

  const displayProperties = useMemo(() => properties.map((property) => {
    const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
    const activeTenancies = tenancies.filter(
      (tenancy) => propertyUnits.some((unit) => tenancyUnitIds(tenancy, tenancyUnits).includes(unit.id)) && isTenancyActive(tenancy),
    );
    const occupiedUnits = new Set(activeTenancies.flatMap((tenancy) => tenancyUnitIds(tenancy, tenancyUnits))).size;
    const unitArea = propertyUnits.reduce((total, unit) => total + Number(unit.area || 0), 0);
    const plan = unitPlanSummary(propertyUnits);
    const contract = activeContractSummary({ propertyUnits, tenancies, tenancyUnits });
    return {
      ...property,
      units: propertyUnits.length || property.units,
      occupiedUnits,
      area: unitArea || property.area,
      planColdRent: plan.coldRent,
      planUtilityAdvance: plan.utilityAdvance,
      planWarmRent: plan.warmRent,
      planConfiguredCold: plan.configuredCold,
      planConfiguredUtility: plan.configuredUtility,
      planConfiguredWarm: plan.configuredWarm,
      planTotalUnits: plan.totalUnits,
      planComplete: plan.coldComplete && plan.utilityComplete,
      activeColdRent: contract.coldRent,
      activeUtilityAdvance: contract.utilityAdvance,
      activeWarmRent: contract.warmRent,
      activeTenancyCount: contract.tenancyCount,
    };
  }), [properties, tenancies, tenancyUnits, units]);

  const openProperty = (propertyId) => {
    setSelectedPropertyId(propertyId);
    setActiveView('detail');
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigate = (view) => {
    setActiveView(view);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openTenantRecord = ({ tab, contactId = '', tenancyId = '', unitId = '', origin = null }) => {
    setTenantTarget({ tab, contactId, tenancyId, unitId, origin, nonce: Date.now() });
    navigate('tenants');
  };

  const addTransaction = (transaction) => {
    const storedTransaction = withTutorialTag(transaction);
    const nextTransactions = [storedTransaction, ...transactions];
    let nextDocuments = documents;
    if (transaction.receiptName) {
      nextDocuments = [withTutorialTag({
        id: 'doc-transaction-' + transaction.id,
        ownerType: 'transaction',
        ownerId: transaction.id,
        propertyId: transaction.propertyId,
        documentType: 'Rechnung / Beleg',
        name: transaction.receiptName,
        date: transaction.date,
        note: 'Direkt mit der Buchung gespeichert.',
        dataUrl: transaction.receiptDataUrl,
      }), ...documents];
    }
    try {
      writeRentalSlicesAtomically({ transactions: nextTransactions, documents: nextDocuments });
    } catch {
      setToast('Buchung wurde nicht gespeichert. Bitte Speicherplatz freigeben oder den Beleg verkleinern.');
      return false;
    }
    setTransactions(nextTransactions);
    setDocuments(nextDocuments);
    setTransactionModal(null);
    setToast('Buchung wurde lokal gespeichert.');
    window.setTimeout(() => setToast(''), 3200);
    return true;
  };

  const deleteTransaction = (transactionId) => {
    const transaction = transactions.find((item) => item.id === transactionId);
    if (isLinkedTenantPaymentTransaction(transaction)) {
      setTransactionDetail(null);
      setToast('Verknüpfte Mietzahlungen werden nicht einzeln gelöscht. Nutze „Mietzahlung stornieren“ im Mieterkonto und buche sie bei Bedarf neu.');
      window.setTimeout(() => setToast(''), 4600);
      return;
    }
    const nextTransactions = transactions.filter((item) => item.id !== transactionId);
    const nextDocuments = documents.filter(
      (document) => !(document.ownerType === 'transaction' && document.ownerId === transactionId),
    );
    try {
      writeRentalSlicesAtomically({ transactions: nextTransactions, documents: nextDocuments });
    } catch {
      setToast('Löschen fehlgeschlagen. Buchung und Beleg wurden nicht verändert.');
      return;
    }
    setTransactions(nextTransactions);
    setDocuments(nextDocuments);
    setTransactionDetail(null);
    setToast('Buchung und direkt zugeordnete Belege wurden gelöscht.');
    window.setTimeout(() => setToast(''), 3200);
  };

  const addCategory = (category) => {
    const parent = categories.find((item) => item.id === category.parentId);
    const nextCategories = [
      ...categories,
      {
        ...category,
        id: 'custom-' + Date.now(),
        parentId: category.parentId || null,
        color: parent?.color || (category.kind === 'income' ? '#68a88f' : '#c47c5d'),
        allocatableDefault: false,
        allocationModeDefault: 'area',
      },
    ];
    try {
      writeRentalSlicesAtomically({ categories: nextCategories });
    } catch {
      setToast('Kategorie wurde nicht gespeichert. Der bisherige Stand bleibt erhalten.');
      return false;
    }
    setCategories(nextCategories);
    setToast(category.parentId ? 'Unterkategorie wurde angelegt.' : 'Kategorie wurde angelegt.');
    window.setTimeout(() => setToast(''), 3200);
    return true;
  };

  const addProperty = (property) => {
    if (properties.length >= 10) {
      setToast('Die Demo ist auf maximal 10 Immobilien begrenzt.');
      window.setTimeout(() => setToast(''), 3200);
      return;
    }

    const initials = property.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('');
    const { unitCount, targetColdRent, targetUtilityAdvance, ...propertyData } = property;
    const newProperty = withTutorialTag({
      ...propertyData,
      id: 'property-' + Date.now(),
      buildingType: property.buildingType || buildingTypeFromObjectType(property.objectType),
      shortName: property.shortName || property.name.split(/\s+/).slice(-1)[0],
      initials: initials || 'IM',
      accent: property.type === 'Gewerbe' ? '#9c6048' : '#3f806e',
    });

    const newUnits = generateUnitsForProperty({
      ...newProperty,
      targetColdRent,
      targetUtilityAdvance,
    }, unitCount || newProperty.units)
      .map((unit) => withTutorialTag(unit));
    const nextProperties = [...properties, { ...newProperty, units: newUnits.length }];
    const nextUnits = [...units, ...newUnits];
    try {
      writeRentalSlicesAtomically({ properties: nextProperties, units: nextUnits });
    } catch {
      setToast('Immobilie wurde nicht gespeichert. Der bisherige Stand bleibt erhalten.');
      return false;
    }
    setProperties(nextProperties);
    setUnits(nextUnits);
    setSelectedPropertyId(newProperty.id);
    setPropertyModal(false);
    setActiveView('detail');
    setToast('Immobilie wurde lokal angelegt.');
    window.setTimeout(() => setToast(''), 3200);
    return true;
  };

  const addUnit = (unit) => {
    const id = unit.id || 'unit-' + Date.now();
    const candidate = withTutorialTag({ ...unit, id });
    const property = properties.find((item) => item.id === unit.propertyId);
    const structure = validateUnitStructure(property, units, candidate);
    if (!structure.valid) {
      setToast(structure.message);
      window.setTimeout(() => setToast(''), 4200);
      return;
    }
    const nextUnits = unit.id
      ? units.map((item) => item.id === unit.id ? candidate : item)
      : [...units, candidate];
    try {
      writeRentalSlicesAtomically({ units: nextUnits });
    } catch {
      setToast('Einheit wurde nicht gespeichert. Der bisherige Stand bleibt erhalten.');
      return false;
    }
    setUnits(nextUnits);
    setUnitModal(null);
    setToast(unit.id
      ? 'Einheit und Planwerte wurden gespeichert.'
      : candidate.unitKind === 'ancillary' ? 'Nebeneinheit wurde dem Objekt hinzugefügt.' : 'Einheit wurde dem Objekt hinzugefügt.');
    window.setTimeout(() => setToast(''), 3200);
    return true;
  };

  const saveContact = (payload) => {
    const nextContacts = contacts.map((contact) => contact.id === payload.id ? {
      ...contact,
      ...payload,
      address: { ...(contact.address || {}), ...(payload.address || {}) },
      communication: { ...(contact.communication || {}), ...(payload.communication || {}) },
    } : contact);
    try {
      writeRentalSlicesAtomically({ contacts: nextContacts });
    } catch {
      setToast('Kontaktakte wurde nicht gespeichert. Der bisherige Stand bleibt erhalten.');
      return false;
    }
    setContacts(nextContacts);
    setToast('Kontaktakte wurde gespeichert.');
    window.setTimeout(() => setToast(''), 3200);
    return true;
  };

  const createContact = (payload) => {
    const contact = withTutorialTag({ ...payload, id: 'contact-' + Date.now() });
    const nextContacts = [...contacts, contact];
    try {
      writeRentalSlicesAtomically({ contacts: nextContacts });
    } catch {
      setToast('Mietpartei wurde nicht gespeichert. Der bisherige Stand bleibt erhalten.');
      return false;
    }
    setContacts(nextContacts);
    setToast('Mietpartei wurde angelegt.');
    window.setTimeout(() => setToast(''), 3200);
    return true;
  };

  const createTenancy = (payload) => {
    const contract = payload.tenancy;
    const unitIds = payload.tenancyUnits.map((relation) => relation.unitId);
    if (tenancyHasIntervalConflict({
      tenancies,
      tenancyUnits,
      unitIds,
      contractStart: contract.contractStart,
      contractEnd: contract.contractEnd,
    })) {
      setToast('Der Vertragszeitraum überschneidet sich bei mindestens einer Einheit mit einem bestehenden Mietverhältnis.');
      window.setTimeout(() => setToast(''), 3200);
      return false;
    }
    const stamp = Date.now();
    const tenancyId = 'tenancy-' + stamp;
    const newTenancy = withTutorialTag({ ...contract, id: tenancyId });
    const newParties = payload.tenancyParties.map((party, index) => withTutorialTag({
      ...party,
      id: `tenancy-party-${stamp}-${index}`,
      tenancyId,
    }));
    const newRelations = payload.tenancyUnits.map((relation, index) => withTutorialTag({
      ...relation,
      id: `tenancy-unit-${stamp}-${index}`,
      tenancyId,
    }));
    const startDate = nextRentDueDate(contract.contractStart);
    const ruleEnd = contract.contractEnd || '';
    const rentRules = [
      { component: 'coldRent', description: 'Kaltmiete', amount: contract.coldRent },
      { component: 'utilityAdvance', description: 'Nebenkostenvorauszahlung', amount: contract.utilityAdvance },
    ].filter((rule) => Number(rule.amount) > 0 && (!ruleEnd || startDate <= ruleEnd))
      .map((rule, index) => withTutorialTag({
        ...rule,
        id: `rule-${stamp}-${index}`,
        tenancyId,
        frequency: 'monthly',
        interval: 1,
        dueDay: 3,
        startDate,
        endDate: ruleEnd,
        status: 'active',
        source: 'tenancy',
        occurrenceKeyTemplate: '{ruleId}:{dueDate}',
      }));
    const nextTenancies = [...tenancies, newTenancy];
    const nextParties = [...tenancyParties, ...newParties];
    const nextRelations = [...tenancyUnits, ...newRelations];
    const nextRules = [...recurringRules, ...rentRules];
    try {
      writeRentalSlicesAtomically({
        tenancies: nextTenancies,
        tenancyParties: nextParties,
        tenancyUnits: nextRelations,
        recurringRules: nextRules,
      });
    } catch {
      setToast('Mietverhältnis wurde nicht gespeichert. Der bisherige Stand bleibt erhalten.');
      return false;
    }
    setTenancies(nextTenancies);
    setTenancyParties(nextParties);
    setTenancyUnits(nextRelations);
    setRecurringRules(nextRules);
    setToast('Mietverhältnis mit bestehenden Kontakten wurde angelegt.');
    window.setTimeout(() => setToast(''), 3200);
    return true;
  };

  const addAccountEntry = (entry) => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (entry.occurrenceKey && accountEntries.some((item) => item.occurrenceKey === entry.occurrenceKey)) {
      setToast('Diese Kontobuchung ist für den Zeitraum bereits vorhanden.');
      window.setTimeout(() => setToast(''), 3800);
      return false;
    }
    const accountEntryId = entry.id || `account-${stamp}`;
    let nextEntry = withTutorialTag({ ...entry, id: accountEntryId });
    let nextTransactions = transactions;
    if (entry.entryType === 'payment') {
      const tenancy = tenancies.find((item) => item.id === entry.tenancyId);
      const unitId = tenancyUnitIds(tenancy, tenancyUnits)[0] || tenancy?.unitId || '';
      const unit = units.find((item) => item.id === unitId);
      const linked = buildLinkedTenantPayment({ entry, tenancy, unit, token: stamp });
      nextEntry = withTutorialTag(linked.accountEntry);
      const paymentTransaction = withTutorialTag(linked.transaction);
      nextTransactions = [paymentTransaction, ...transactions];
    }
    const nextAccountEntries = [...accountEntries, nextEntry];
    try {
      writeRentalSlicesAtomically({
        accountEntries: nextAccountEntries,
        ...(entry.entryType === 'payment' ? { transactions: nextTransactions } : {}),
      });
    } catch {
      setToast('Kontobuchung wurde nicht gespeichert. Der bisherige Stand bleibt erhalten.');
      return false;
    }
    setAccountEntries(nextAccountEntries);
    if (entry.entryType === 'payment') setTransactions(nextTransactions);
    const message = entry.entryType === 'settlement'
      ? 'Abrechnungsergebnis wurde im Mieterkonto gebucht.'
      : entry.entryType === 'correction'
        ? 'Korrektur wurde im Mieterkonto gebucht.'
        : 'Zahlung wurde im Mieterkonto gebucht.';
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
    return true;
  };

  const voidTenantPayment = (entry) => {
    let next;
    try {
      next = voidLinkedTenantPayment({
        accountEntry: entry,
        accountEntries,
        transactions,
      });
      writeRentalSlicesAtomically({
        accountEntries: next.accountEntries,
        transactions: next.transactions,
      });
    } catch (error) {
      setToast(error?.message || 'Die Mietzahlung wurde nicht storniert. Der bisherige Stand bleibt erhalten.');
      window.setTimeout(() => setToast(''), 4600);
      return false;
    }
    setAccountEntries(next.accountEntries);
    setTransactions(next.transactions);
    setToast('Mietzahlung wurde gemeinsam aus Mieterkonto und Finanzen storniert. Du kannst sie jetzt korrekt neu buchen.');
    window.setTimeout(() => setToast(''), 4200);
    return true;
  };

  const generateAccountEntries = ({ throughDate, tenancyId }) => {
    const selectedRules = tenancyId
      ? recurringRules.filter((rule) => rule.tenancyId === tenancyId)
      : recurringRules;
    const tutorialRuleIds = new Set(selectedRules
      .filter((rule) => belongsToTutorial(rule, tutorialSessionId))
      .map((rule) => rule.id));
    const existingIds = new Set(accountEntries.map((entry) => entry.id));
    const nextAccountEntries = materializeRecurringEntries(selectedRules, accountEntries, throughDate).map((entry) => (
      existingIds.has(entry.id) || !tutorialRuleIds.has(entry.sourceId)
        ? entry
        : withTutorialTag(entry)
    ));
    try {
      writeRentalSlicesAtomically({ accountEntries: nextAccountEntries });
    } catch {
      setToast('Sollstellungen wurden nicht gespeichert. Der bisherige Stand bleibt erhalten.');
      return false;
    }
    setAccountEntries(nextAccountEntries);
    setToast('Fällige Sollstellungen wurden ohne Dubletten erzeugt.');
    window.setTimeout(() => setToast(''), 3200);
    return true;
  };

  const createRecurringRule = (rule) => {
    const tenancy = tenancies.find((item) => item.id === rule.tenancyId);
    const today = new Date().toISOString().slice(0, 10);
    const normalized = normalizeRecurringRuleForTenancy(rule, tenancy, today);
    if (!normalized.valid) {
      setToast(normalized.message);
      window.setTimeout(() => setToast(''), 4200);
      return false;
    }
    const newRule = withTutorialTag({
      ...normalized.value,
      id: 'rule-custom-' + Date.now(),
      status: 'active',
      amount: Math.max(0, Number(rule.amount) || 0),
      interval: 1,
      occurrenceKeyTemplate: '{ruleId}:{dueDate}',
      source: 'manual',
    });
    const nextRules = [...recurringRules, newRule];
    try {
      writeRentalSlicesAtomically({ recurringRules: nextRules });
    } catch {
      setToast('Wiederholungsregel wurde nicht gespeichert. Der bisherige Stand bleibt erhalten.');
      return false;
    }
    setRecurringRules(nextRules);
    setToast('Wiederholungsregel wurde gespeichert.');
    window.setTimeout(() => setToast(''), 3200);
    return true;
  };

  const endTenancy = (tenancyId) => {
    const today = new Date().toISOString().slice(0, 10);
    const nextTenancies = tenancies.map((tenancy) =>
      tenancy.id === tenancyId
        ? { ...tenancy, status: 'ended', contractEnd: today, endDate: today, moveOutDate: tenancy.moveOutDate || today }
        : tenancy,
    );
    const nextRules = recurringRules.map((rule) => rule.tenancyId === tenancyId
      ? { ...rule, status: 'ended', endDate: rule.endDate || today }
      : rule);
    try {
      writeRentalSlicesAtomically({ tenancies: nextTenancies, recurringRules: nextRules });
    } catch {
      setToast('Mietverhältnis wurde nicht beendet. Der bisherige Stand bleibt erhalten.');
      return false;
    }
    setTenancies(nextTenancies);
    setRecurringRules(nextRules);
    setToast('Mietverhältnis wurde beendet und bleibt in der Historie erhalten.');
    window.setTimeout(() => setToast(''), 3200);
  };

  const addDocument = (document) => {
    const nextDocuments = [withTutorialTag({ ...document, id: 'doc-' + Date.now() }), ...documents];
    try {
      writeRentalSlicesAtomically({ documents: nextDocuments });
    } catch {
      setToast('Dokument wurde nicht gespeichert. Bitte Speicherplatz freigeben oder die Datei verkleinern.');
      return false;
    }
    setDocuments(nextDocuments);
    setDocumentModal(null);
    setToast('Dokument wurde am ausgewählten Bereich abgelegt.');
    window.setTimeout(() => setToast(''), 3200);
    return true;
  };

  const openTutorial = () => {
    setTutorialProgress((current) => {
      if (current.status === 'completed') return { ...EMPTY_TUTORIAL_PROGRESS, open: true };
      if (current.status === 'paused') return { ...current, status: 'active', open: true };
      return { ...current, open: true };
    });
  };

  const startTutorial = () => {
    setTutorialProgress(startTutorialProgress(`tutorial-${Date.now()}`));
  };

  const pauseTutorial = () => {
    setTutorialProgress((current) => current.status === 'idle'
      ? { ...current, open: false }
      : { ...current, status: 'paused', open: false });
  };

  const resumeTutorial = () => {
    setTutorialProgress((current) => ({ ...current, status: 'active', open: true }));
  };

  const advanceTutorial = (step, skipped = false) => {
    setTutorialProgress((current) => finishTutorialStep(current, step.id, skipped));
  };

  const tutorialBack = () => {
    setTutorialProgress((current) => ({
      ...current,
      stepIndex: Math.max(0, current.stepIndex - 1),
      status: 'active',
      open: true,
    }));
  };

  const tutorialProperty = properties.find((item) => belongsToTutorial(item, tutorialProgress.sessionId));
  const tutorialContact = contacts.find((item) => belongsToTutorial(item, tutorialProgress.sessionId));
  const tutorialTenancy = tenancies.find((item) => belongsToTutorial(item, tutorialProgress.sessionId));

  const tutorialAction = (step) => {
    if (step.id === 'welcome') {
      navigate('dashboard');
      return;
    }
    setTutorialProgress((current) => ({ ...current, open: false }));
    if (step.id === 'property') {
      navigate('properties');
      setPropertyModal(true);
      return;
    }
    if (step.id === 'units') {
      if (tutorialProperty) openProperty(tutorialProperty.id);
      else navigate('properties');
      return;
    }
    if (step.id === 'contact') {
      openTenantRecord({ tab: 'contacts' });
      return;
    }
    if (step.id === 'tenancy') {
      openTenantRecord({ tab: 'tenancies' });
      return;
    }
    if (step.id === 'account') {
      openTenantRecord({ tab: 'accounts', tenancyId: tutorialTenancy?.id || '' });
      return;
    }
    if (step.id === 'recurring') {
      navigate('transactions');
      return;
    }
    if (step.id === 'annual') {
      navigate('transactions');
      setTransactionModal({ propertyId: tutorialProperty?.id || selectedPropertyId });
      return;
    }
    if (step.id === 'documents') {
      navigate('documents');
      return;
    }
    if (step.id === 'review') navigate('reports');
  };

  const detachTutorialData = () => {
    const sessionId = tutorialProgress.sessionId;
    const detach = (record) => {
      if (!belongsToTutorial(record, sessionId)) return record;
      const { tutorialSessionId: _tutorialSessionId, ...clean } = record;
      return clean;
    };
    setProperties((current) => current.map(detach));
    setUnits((current) => current.map(detach));
    setContacts((current) => current.map(detach));
    setTenancies((current) => current.map(detach));
    setTenancyParties((current) => current.map(detach));
    setTenancyUnits((current) => current.map(detach));
    setRecurringRules((current) => current.map(detach));
    setAccountEntries((current) => current.map(detach));
    setTransactions((current) => current.map(detach));
    setDocuments((current) => current.map(detach));
    setTutorialProgress(EMPTY_TUTORIAL_PROGRESS);
    setToast('Übungsdaten bleiben als normale Daten erhalten. Tutorial abgeschlossen.');
    window.setTimeout(() => setToast(''), 3600);
  };

  const cleanupTutorialData = () => {
    const sessionId = tutorialProgress.sessionId;
    if (!sessionId || !window.confirm('Nur die in diesem Tutorial markierten Übungsdaten entfernen? Bestehende Daten bleiben unangetastet.')) return;
    const plan = buildTutorialCleanupPlan({ properties, units, contacts, tenancies, transactions }, sessionId);
    const propertyIds = new Set(plan.propertyIds);
    const unitIds = new Set(plan.unitIds);
    const contactIds = new Set(plan.contactIds);
    const tenancyIds = new Set(plan.tenancyIds);
    const transactionIds = new Set(plan.transactionIds);
    setProperties((current) => current.filter((item) => !propertyIds.has(item.id)));
    setUnits((current) => current.filter((item) => !unitIds.has(item.id)));
    setContacts((current) => current.filter((item) => !contactIds.has(item.id)));
    setTenancies((current) => current.filter((item) => !tenancyIds.has(item.id)));
    setTenancyParties((current) => current.filter((item) => !tenancyIds.has(item.tenancyId) && !belongsToTutorial(item, sessionId)));
    setTenancyUnits((current) => current.filter((item) => !tenancyIds.has(item.tenancyId) && !unitIds.has(item.unitId) && !belongsToTutorial(item, sessionId)));
    setRecurringRules((current) => current.filter((item) => !tenancyIds.has(item.tenancyId) && !belongsToTutorial(item, sessionId)));
    setAccountEntries((current) => current.filter((item) => !tenancyIds.has(item.tenancyId) && !belongsToTutorial(item, sessionId)));
    setTransactions((current) => current.filter((item) => !transactionIds.has(item.id)));
    setDocuments((current) => current.filter((item) => (
      !belongsToTutorial(item, sessionId)
      && !propertyIds.has(item.propertyId)
      && !transactionIds.has(item.ownerId)
      && !unitIds.has(item.ownerId)
      && !tenancyIds.has(item.ownerId)
      && !contactIds.has(item.ownerId)
    )));
    if (propertyIds.has(selectedPropertyId)) setSelectedPropertyId(properties.find((item) => !propertyIds.has(item.id))?.id || '');
    setTenantTarget(null);
    setTutorialProgress(EMPTY_TUTORIAL_PROGRESS);
    navigate('dashboard');
    setToast('Ausschließlich die markierten Übungsdaten wurden entfernt.');
    window.setTimeout(() => setToast(''), 3600);
  };

  const downloadDataBackup = (reason) => {
    const backup = {
      ...readRentalStorageSnapshot(),
      exportedAt: new Date().toISOString(),
      reason,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vermieter-kompass-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const clearBusinessData = () => {
    if (!window.confirm('Vor dem Leeren wird automatisch ein JSON-Backup heruntergeladen. Danach werden alle Fachdaten entfernt; Kategorien bleiben erhalten. Fortfahren?')) return;
    downloadDataBackup('Fachdaten leeren');
    try {
      writeRentalSlicesAtomically({
        properties: [],
        transactions: [],
        units: [],
        contacts: [],
        tenancies: [],
        documents: [],
        tenancyParties: [],
        tenancyUnits: [],
        recurringRules: [],
        accountEntries: [],
        migrationIssues: [],
        tutorialProgress: EMPTY_TUTORIAL_PROGRESS,
      });
      setProperties([]);
      setTransactions([]);
      setUnits([]);
      setContacts([]);
      setTenancies([]);
      setDocuments([]);
      setTenancyParties([]);
      setTenancyUnits([]);
      setRecurringRules([]);
      setAccountEntries([]);
      setMigrationIssues([]);
      setTutorialProgress(EMPTY_TUTORIAL_PROGRESS);
      setSelectedPropertyId('');
      setTenantTarget(null);
      setActiveView('dashboard');
      setSidebarOpen(false);
      setToast('Fachdaten wurden geleert. Die Kategorien bleiben erhalten.');
      window.setTimeout(() => setToast(''), 3600);
    } catch {
      setToast('Fachdaten wurden nicht geleert. Der bisherige Datenstand bleibt erhalten.');
    }
  };

  const loadVerifiedSample = () => {
    const hasBusinessData = Boolean(
      properties.length
      || transactions.length
      || units.length
      || contacts.length
      || tenancies.length
      || documents.length
      || tenancyParties.length
      || tenancyUnits.length
      || recurringRules.length
      || accountEntries.length
      || migrationIssues.length
      || tutorialProgress.status !== EMPTY_TUTORIAL_PROGRESS.status,
    );
    if (hasBusinessData && !window.confirm('Der aktuelle Fachdatenbestand wird vorher als JSON gesichert und anschließend durch den geprüften Musterbestand ersetzt. Fortfahren?')) return;
    if (hasBusinessData) downloadDataBackup('Geprüften Musterbestand laden');
    try {
      writeRentalSlicesAtomically({
        properties: demoProperties,
        transactions: demoTransactions,
        units: demoUnits,
        contacts: demoContacts,
        tenancies: demoTenancies,
        documents: demoDocuments,
        tenancyParties: demoTenancyParties,
        tenancyUnits: demoTenancyUnits,
        recurringRules: demoRecurringRules,
        accountEntries: demoAccountEntries,
        migrationIssues: [],
        tutorialProgress: EMPTY_TUTORIAL_PROGRESS,
      });
      setProperties(demoProperties);
      setTransactions(demoTransactions);
      setUnits(demoUnits);
      setContacts(demoContacts);
      setTenancies(demoTenancies);
      setDocuments(demoDocuments);
      setTenancyParties(demoTenancyParties);
      setTenancyUnits(demoTenancyUnits);
      setRecurringRules(demoRecurringRules);
      setAccountEntries(demoAccountEntries);
      setMigrationIssues([]);
      setTutorialProgress(EMPTY_TUTORIAL_PROGRESS);
      setSelectedPropertyId(demoProperties[0]?.id || '');
      setTenantTarget(null);
      setActiveView('dashboard');
      setSidebarOpen(false);
      setToast('Geprüfter Musterbestand wurde geladen.');
      window.setTimeout(() => setToast(''), 3600);
    } catch {
      setToast('Musterbestand wurde nicht geladen. Der bisherige Datenstand bleibt erhalten.');
    }
  };

  const selectedProperty =
    displayProperties.find((property) => property.id === selectedPropertyId) || displayProperties[0];
  const tutorialMilestones = {
    property: Boolean(tutorialProperty),
    units: Boolean(tutorialProperty && units.some((unit) => (
      unit.propertyId === tutorialProperty.id && belongsToTutorial(unit, tutorialProgress.sessionId)
    ))),
    contact: Boolean(tutorialContact),
    tenancy: Boolean(tutorialTenancy),
    account: accountEntries.some((entry) => belongsToTutorial(entry, tutorialProgress.sessionId)),
    recurring: recurringRules.some((rule) => (
      belongsToTutorial(rule, tutorialProgress.sessionId) && rule.source === 'manual'
    )),
    annual: transactions.some((transaction) => (
      belongsToTutorial(transaction, tutorialProgress.sessionId)
      && transaction.servicePeriodStart
      && transaction.servicePeriodEnd
    )),
    documents: documents.some((document) => belongsToTutorial(document, tutorialProgress.sessionId)),
    review: activeView === 'reports',
  };

  return (
    <div className="app-shell">
      <aside className={'sidebar ' + (sidebarOpen ? 'sidebar--open' : '')}>
        <div className="brand">
          <div className="brand__mark">
            <Icon name="home" size={24} />
          </div>
          <div>
            <strong>Vermieter</strong>
            <span>Kompass</span>
          </div>
        </div>

        <div className="portfolio-label">Mein Portfolio</div>
        <nav className="main-nav" aria-label="Hauptnavigation">
          {NAV_ITEMS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={
                'nav-item ' +
                (activeView === item.id ||
                (activeView === 'detail' && item.id === 'properties')
                  ? 'nav-item--active'
                  : '')
              }
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button type="button" className="tutorial-nav-button" onClick={openTutorial}>
          <Icon name="compass" size={18} />
          <span>Tutorial</span>
        </button>

        <div className="sidebar__footer">
          <div className="demo-owner">
            <div className="avatar">VK</div>
            <div>
              <strong>Lokaler Datenbestand</strong>
              <span>Nur auf diesem Gerät</span>
            </div>
          </div>
          <button type="button" className="reset-button" onClick={loadVerifiedSample}>
            <Icon name="plus" size={17} />
            Geprüften Musterbestand laden
          </button>
          <button type="button" className="reset-button" onClick={clearBusinessData}>
            <Icon name="reset" size={17} />
            Fachdaten leeren
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Navigation schließen"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar__title">
            <button
              type="button"
              className="icon-button mobile-menu"
              aria-label="Navigation öffnen"
              onClick={() => setSidebarOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <div>
              <span className="eyebrow">Portfolio 2026</span>
              <h1>{PAGE_TITLES[activeView]}</h1>
            </div>
          </div>
          <div className="topbar__actions">
            <span className="demo-pill">Lokale Demo</span>
            <button
              type="button"
              className="button button--primary"
              onClick={() => setTransactionModal({ propertyId: selectedPropertyId })}
              disabled={!properties.length}
              title={!properties.length ? 'Lege zuerst eine Immobilie an.' : undefined}
            >
              <Icon name="plus" size={18} />
              <span>Neue Buchung</span>
            </button>
          </div>
        </header>

        <div className="content">
          {activeView === 'dashboard' && (
            <Dashboard
              properties={displayProperties}
              transactions={transactions}
              categories={categories}
              unitRecords={units}
              onOpenProperty={openProperty}
              onNavigate={navigate}
              onOpenTransaction={setTransactionDetail}
            />
          )}
          {activeView === 'properties' && (
            <PropertiesPage
              properties={displayProperties}
              transactions={transactions}
              onOpenProperty={openProperty}
              onAdd={() => setPropertyModal(true)}
            />
          )}
          {activeView === 'detail' && selectedProperty && (
            <PropertyDetail
              property={selectedProperty}
              transactions={transactions}
              categories={categories}
              units={units.filter((unit) => unit.propertyId === selectedProperty.id)}
              contacts={contacts}
              tenancies={tenancies}
              tenancyUnits={tenancyUnits}
              documents={documents}
              onBack={() => navigate('properties')}
              onAdd={(unitId) => setTransactionModal({ propertyId: selectedProperty.id, unitId })}
              onAddUnit={() => setUnitModal({ propertyId: selectedProperty.id })}
              onEditUnit={(unitId) => setUnitModal({ propertyId: selectedProperty.id, unitId })}
              onAddTenancy={(unitId) => openTenantRecord({ tab: 'tenancies', unitId })}
              onAddDocument={(ownerType, ownerId) => setDocumentModal({
                ownerType,
                ownerId,
                propertyId: selectedProperty.id,
              })}
              onOpenDocument={setDocumentDetail}
              onEndTenancy={endTenancy}
              onOpenTransaction={setTransactionDetail}
              onSaveContact={saveContact}
              allProperties={displayProperties}
              onOpenContactArea={(contactId) => openTenantRecord({
                tab: 'contacts',
                contactId,
                origin: { propertyId: selectedProperty.id, label: selectedProperty.name },
              })}
              onOpenTenancy={(tenancyId) => openTenantRecord({
                tab: 'tenancies',
                tenancyId,
                origin: { propertyId: selectedProperty.id, label: selectedProperty.name },
              })}
            />
          )}
          {activeView === 'tenants' && (
            <>
              {migrationIssues.length > 0 && (
                <div className="info-banner info-banner--warning">
                  <strong>{migrationIssues.length} historischer Vertragskonflikt zur Prüfung</strong>
                  <span>Die Migration hat Altdaten unverändert bewahrt und nicht automatisch umgeschrieben.</span>
                </div>
              )}
              <TenantArea
                contacts={contacts}
                tenancies={tenancies}
                tenancyParties={tenancyParties}
                tenancyUnits={tenancyUnits}
                units={units}
                properties={displayProperties}
                accountEntries={accountEntries}
                recurringRules={recurringRules}
                transactions={transactions}
                onSaveContact={saveContact}
                onCreateContact={createContact}
                onCreateTenancy={createTenancy}
                onAddAccountEntry={addAccountEntry}
                onVoidPayment={voidTenantPayment}
                onPostSettlement={addAccountEntry}
                onGenerateEntries={generateAccountEntries}
                target={tenantTarget}
                onBackToOrigin={tenantTarget?.origin?.propertyId
                  ? () => openProperty(tenantTarget.origin.propertyId)
                  : null}
              />
            </>
          )}
          {activeView === 'transactions' && (
            <>
              <TransactionsPage
                properties={displayProperties}
                transactions={transactions}
                categories={categories}
                units={units}
                tenancies={tenancies}
                tenancyUnits={tenancyUnits}
                tenancyParties={tenancyParties}
                contacts={contacts}
                onAdd={() => properties.length && setTransactionModal({})}
                onOpenTransaction={setTransactionDetail}
              />
              <RecurringRulesPanel
                rules={recurringRules}
                tenancies={tenancies}
                contacts={contacts}
                onCreate={createRecurringRule}
                onGenerate={() => generateAccountEntries({
                  throughDate: new Date().toISOString().slice(0, 10),
                  tenancyId: null,
                })}
              />
            </>
          )}
          {activeView === 'documents' && (
            <DocumentsPage
              documents={documents}
              properties={displayProperties}
              onOpen={setDocumentDetail}
              onAdd={() => {
                const propertyId = selectedPropertyId || displayProperties[0]?.id;
                if (propertyId) setDocumentModal({ ownerType: 'property', ownerId: propertyId, propertyId });
              }}
            />
          )}
          {activeView === 'reports' && (
            <ReportsPage properties={displayProperties} transactions={transactions} />
          )}
          {activeView === 'categories' && (
            <CategoriesPage
              categories={categories}
              transactions={transactions}
              onAdd={addCategory}
              tutorialProgress={tutorialProgress}
              onOpenTutorial={openTutorial}
            />
          )}
        </div>
      </main>

      <TutorialCoach
        progress={tutorialProgress}
        milestones={tutorialMilestones}
        onStart={startTutorial}
        onAction={tutorialAction}
        onAdvance={(step) => advanceTutorial(step, false)}
        onBack={tutorialBack}
        onSkip={(step) => advanceTutorial(step, true)}
        onPause={pauseTutorial}
        onMinimize={() => setTutorialProgress((current) => ({ ...current, open: false }))}
        onResume={resumeTutorial}
        onKeep={detachTutorialData}
        onCleanup={cleanupTutorialData}
      />

      {transactionModal && properties.length > 0 && (
        <TransactionModal
          properties={displayProperties}
          categories={categories}
          units={units}
          tenancies={tenancies}
          tenancyUnits={tenancyUnits}
          contacts={contacts}
          presetPropertyId={transactionModal.propertyId}
          presetUnitId={transactionModal.unitId}
          onClose={() => setTransactionModal(null)}
          onSubmit={addTransaction}
        />
      )}

      {propertyModal && (
        <PropertyModal
          propertyCount={properties.length}
          onClose={() => setPropertyModal(false)}
          onSubmit={addProperty}
        />
      )}

      {unitModal && (
        <UnitModal
          property={displayProperties.find((property) => property.id === unitModal.propertyId)}
          units={units.filter((unit) => unit.propertyId === unitModal.propertyId)}
          unit={units.find((unit) => unit.id === unitModal.unitId)}
          onClose={() => setUnitModal(null)}
          onSubmit={addUnit}
        />
      )}

      {documentModal && (
        <DocumentModal
          context={documentModal}
          property={displayProperties.find((property) => property.id === documentModal.propertyId)}
          onClose={() => setDocumentModal(null)}
          onSubmit={addDocument}
        />
      )}

      {documentDetail && (
        <DocumentDetailModal
          document={documentDetail}
          onClose={() => setDocumentDetail(null)}
        />
      )}

      {transactionDetail && (
        <TransactionDetailModal
          transaction={transactionDetail}
          property={displayProperties.find(
            (property) => property.id === transactionDetail.propertyId,
          )}
          unit={units.find((unit) => unit.id === transactionDetail.unitId)}
          units={units}
          tenancies={tenancies}
          contacts={contacts}
          category={categories.find(
            (category) => category.id === transactionDetail.categoryId,
          )}
          parentCategory={categories.find(
            (category) =>
              category.id ===
              categories.find((item) => item.id === transactionDetail.categoryId)?.parentId,
          )}
          onAddDocument={() => {
            setDocumentModal({
              ownerType: 'transaction',
              ownerId: transactionDetail.id,
              propertyId: transactionDetail.propertyId,
            });
            setTransactionDetail(null);
          }}
          onDelete={() => deleteTransaction(transactionDetail.id)}
          onClose={() => setTransactionDetail(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Dashboard({
  properties,
  transactions,
  categories,
  unitRecords,
  onOpenProperty,
  onNavigate,
  onOpenTransaction,
}) {
  const yearTransactions = transactions.filter(
    (transaction) => getYear(transaction.date) === DEMO_YEAR,
  );
  const income = sum(yearTransactions, 'income');
  const expenses = sum(yearTransactions, 'expense');
  const result = income - expenses;
  const units = properties.reduce((total, property) => total + property.units, 0);
  const occupiedUnits = properties.reduce(
    (total, property) => total + property.occupiedUnits,
    0,
  );
  const recent = yearTransactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const occupancyRate = units > 0 ? Math.round((occupiedUnits / units) * 100) : 0;
  const receiptCount = yearTransactions.filter((transaction) => transaction.receiptName).length;

  return (
    <>
      <section className="welcome-row">
        <div>
          <p className="section-kicker">Willkommen im Vermieter-Kompass</p>
          <h2>Deine Immobilien auf einen Blick.</h2>
          <p className="muted">
            Alle Zahlen basieren auf deinen lokal gespeicherten Buchungen für {DEMO_YEAR}.
          </p>
        </div>
        <div className="as-of">
          <span>Datenstand</span>
          <strong>{recent[0]?.date ? formatDate(recent[0].date) : 'Noch keine Buchungen'}</strong>
        </div>
      </section>

      {!properties.length && (
        <section className="info-banner empty-onboarding">
          <Icon name="building" size={22} />
          <p><strong>Dein Portfolio ist noch leer.</strong> Lege zuerst eine Immobilie an; danach werden Buchungen, Dokumente und Mietverhältnisse freigeschaltet.</p>
          <button type="button" className="button button--primary button--small" onClick={() => onNavigate('properties')}>Erste Immobilie anlegen</button>
        </section>
      )}

      <section className="metric-grid" aria-label="Kennzahlen">
        <MetricCard
          label="Einnahmen"
          value={money.format(income)}
          detail="im laufenden Jahr"
          tone="green"
          indicator={`${yearTransactions.filter((item) => item.kind === 'income').length} Zahlungseingänge`}
        />
        <MetricCard
          label="Ausgaben"
          value={money.format(expenses)}
          detail="inkl. Finanzierung"
          tone="orange"
          indicator={`${receiptCount} Belege`}
        />
        <MetricCard
          label="Überschuss"
          value={money.format(result)}
          detail="vor Steuern"
          tone="dark"
          indicator={income ? Math.round((result / income) * 100) + ' % Marge' : 'Noch keine Einnahmen'}
        />
        <MetricCard
          label="Vermietungsstand"
          value={occupancyRate + ' %'}
          detail={occupiedUnits + ' von ' + units + ' Einheiten'}
          tone="blue"
          indicator={units ? (occupiedUnits === units ? 'voll vermietet' : `${units - occupiedUnits} frei`) : 'Noch keine Einheiten'}
        />
      </section>

      <section className="dashboard-grid">
        <div className="card chart-card">
          <CardHeader
            title="Einnahmen & Ausgaben"
            subtitle={'Monatliche Entwicklung ' + DEMO_YEAR}
            action={<Legend />}
          />
          <MonthlyChart transactions={yearTransactions} />
        </div>

        <div className="card tasks-card">
          <CardHeader title="Anstehend" subtitle="Die nächsten Termine" />
          <div className="task-list">
            {demoTasks.map((task) => {
              const property = properties.find((item) => item.id === task.propertyId);
              return (
                <div className="task" key={task.id}>
                  <div className="task__date">
                    <Icon name="calendar" size={17} />
                    {task.date}
                  </div>
                  <strong>{task.title}</strong>
                  <span>{property?.shortName || 'Ohne Objekt'}</span>
                </div>
              );
            })}
            {!demoTasks.length && <div className="empty-state">Noch keine Termine oder Aufgaben hinterlegt.</div>}
          </div>
        </div>
      </section>

      <section className="card">
        <CardHeader
          title="Mein Immobilienbestand"
          subtitle={properties.length + ' Objekte im Portfolio'}
          action={
            <button type="button" className="text-button" onClick={() => onNavigate('properties')}>
              Alle Immobilien
              <Icon name="chevron" size={16} />
            </button>
          }
        />
        <div className="property-strip">
          {properties.map((property) => (
            <PropertyMiniCard
              key={property.id}
              property={property}
              transactions={yearTransactions}
              onClick={() => onOpenProperty(property.id)}
            />
          ))}
          {!properties.length && <div className="empty-state">Noch keine Immobilie vorhanden.</div>}
        </div>
      </section>

      <section className="card recent-card">
        <CardHeader
          title="Letzte Buchungen"
          subtitle="Zuletzt erfasste Bewegungen"
          action={
            <button type="button" className="text-button" onClick={() => onNavigate('transactions')}>
              Alle Buchungen
              <Icon name="chevron" size={16} />
            </button>
          }
        />
        <TransactionsTable
          transactions={recent}
          properties={properties}
          categories={categories}
          units={unitRecords}
          onOpenTransaction={onOpenTransaction}
          compact
        />
      </section>
    </>
  );
}

function MonthlyChart({ transactions }) {
  if (!transactions.length) {
    return <div className="empty-state">Noch keine Buchungen für den Jahresverlauf vorhanden.</div>;
  }
  const months = Array.from({ length: 12 }, (_, month) => {
    const monthTransactions = transactions.filter(
      (transaction) => getMonth(transaction.date) === month,
    );
    return {
      income: sum(monthTransactions, 'income'),
      expense: sum(monthTransactions, 'expense'),
    };
  });
  const maximum = Math.max(...months.flatMap((month) => [month.income, month.expense]), 1);

  return (
    <div className="monthly-chart" aria-label="Balkendiagramm Einnahmen und Ausgaben">
      <div className="chart-scale">
        <span>{money.format(maximum)}</span>
        <span>{money.format(maximum / 2)}</span>
        <span>0 €</span>
      </div>
      <div className="chart-bars">
        {months.map((month, index) => (
          <div className="chart-month" key={index}>
            <div className="chart-month__bars">
              <div
                className="bar bar--income"
                style={{ height: Math.max((month.income / maximum) * 100, month.income ? 3 : 0) + '%' }}
                title={'Einnahmen: ' + moneyExact.format(month.income)}
              />
              <div
                className="bar bar--expense"
                style={{ height: Math.max((month.expense / maximum) * 100, month.expense ? 3 : 0) + '%' }}
                title={'Ausgaben: ' + moneyExact.format(month.expense)}
              />
            </div>
            <span>{shortMonth(index)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PropertyMiniCard({ property, transactions, onClick }) {
  const propertyTransactions = transactions.filter(
    (transaction) => transaction.propertyId === property.id,
  );
  const result = sum(propertyTransactions, 'income') - sum(propertyTransactions, 'expense');

  return (
    <button type="button" className="property-mini" onClick={onClick}>
      <div className="property-visual" style={{ '--accent': property.accent }}>
        <span>{property.initials}</span>
        <small>{property.type}</small>
      </div>
      <div className="property-mini__body">
        <div>
          <strong>{property.shortName}</strong>
          <span>{property.city}</span>
        </div>
        <div className="property-mini__result">
          <span>Ergebnis {DEMO_YEAR}</span>
          <strong>{money.format(result)}</strong>
        </div>
      </div>
    </button>
  );
}

function PropertiesPage({ properties, transactions, onOpenProperty, onAdd }) {
  return (
    <>
      <section className="page-intro">
        <div>
          <span className="section-kicker">Bestand</span>
          <h2>{properties.length} Immobilien, ein klarer Überblick.</h2>
          <p className="muted">Wohn- und Gewerbeobjekte mit den wichtigsten Eckdaten.</p>
        </div>
        <div className="page-intro__actions">
          <div className="capacity-note">
            <strong>{properties.length} / 10</strong>
            <span>Objekte in dieser Demo</span>
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={onAdd}
            disabled={properties.length >= 10}
          >
            <Icon name="plus" size={18} />
            Immobilie anlegen
          </button>
        </div>
      </section>

      <section className="property-grid">
        {properties.map((property) => {
          const rows = transactions.filter(
            (transaction) =>
              transaction.propertyId === property.id && getYear(transaction.date) === DEMO_YEAR,
          );
          const income = sum(rows, 'income');
          const expenses = sum(rows, 'expense');
          return (
            <article className="property-card card" key={property.id}>
              <div className="property-card__visual" style={{ '--accent': property.accent }}>
                <div className="property-card__monogram">{property.initials}</div>
                <div className="property-card__badges">
                  <span>{property.type}</span>
                  <span className="status-badge">{property.occupiedUnits ? `${property.occupiedUnits} vermietet` : 'Noch frei'}</span>
                </div>
              </div>
              <div className="property-card__content">
                <div className="property-card__title">
                  <div>
                    <h3>{property.name}</h3>
                    <p>{propertyAddressLine(property)}</p>
                  </div>
                  <button
                    type="button"
                    className="round-arrow"
                    aria-label={property.name + ' öffnen'}
                    onClick={() => onOpenProperty(property.id)}
                  >
                    <Icon name="chevron" size={18} />
                  </button>
                </div>
                <div className="property-facts">
                  <span><strong>{property.units}</strong> Einheiten</span>
                  <span><strong>{number.format(property.area)} m²</strong> Fläche</span>
                  <span><strong>{property.built}</strong> Baujahr</span>
                  <span><strong>{formatPlanValue(
                    property.planWarmRent,
                    property.planConfiguredWarm,
                    property.planTotalUnits,
                  )}</strong> Plan-Warmmiete</span>
                </div>
                <div className="property-finance">
                  <div>
                    <span>Einnahmen {DEMO_YEAR}</span>
                    <strong className="positive">{money.format(income)}</strong>
                  </div>
                  <div>
                    <span>Ausgaben {DEMO_YEAR}</span>
                    <strong className="negative">{money.format(expenses)}</strong>
                  </div>
                  <div>
                    <span>Ergebnis</span>
                    <strong>{money.format(income - expenses)}</strong>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {!properties.length && (
          <div className="card empty-state">
            Noch keine Immobilie vorhanden. Mit „Immobilie anlegen“ startest du den Objektbaum.
          </div>
        )}
      </section>
    </>
  );
}

function PropertyDetail({
  property,
  transactions,
  categories,
  units,
  contacts,
  tenancies,
  tenancyUnits,
  documents,
  onBack,
  onAdd,
  onAddUnit,
  onEditUnit,
  onAddTenancy,
  onAddDocument,
  onOpenDocument,
  onEndTenancy,
  onOpenTransaction,
  onSaveContact,
  allProperties,
  onOpenContactArea,
  onOpenTenancy,
}) {
  const propertyUnitIds = units.map((unit) => unit.id);
  const propertyTenancies = tenancies.filter((tenancy) =>
    tenancyUnitIds(tenancy, tenancyUnits).some((unitId) => propertyUnitIds.includes(unitId)));
  const propertyTransactions = transactions.filter(
    (transaction) => transaction.propertyId === property.id,
  );
  const availableYears = [
    ...new Set(propertyTransactions.map((transaction) => getYear(transaction.date))),
  ].sort((a, b) => b - a);
  const [selectedYear, setSelectedYear] = useState(availableYears[0] || DEMO_YEAR);
  const [kindFilter, setKindFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [tenancyFilter, setTenancyFilter] = useState('all');
  const [allocationFilter, setAllocationFilter] = useState('all');
  const [selectedContext, setSelectedContext] = useState({ type: 'property', id: property.id });
  const [treeOpen, setTreeOpen] = useState(true);
  const [expandedUnits, setExpandedUnits] = useState(() => new Set(units.map((unit) => unit.id)));
  const [contactDirty, setContactDirty] = useState(false);

  const selectContext = (nextContext) => {
    if (contactDirty && (nextContext.type !== selectedContext.type || nextContext.id !== selectedContext.id)) {
      if (!window.confirm('Ungespeicherte Änderungen an der Kontaktakte verwerfen?')) return;
      setContactDirty(false);
    }
    setSelectedContext(nextContext);
  };

  useEffect(() => {
    setSelectedYear(availableYears[0] || DEMO_YEAR);
    setKindFilter('all');
    setCategoryFilter('all');
    setUnitFilter('all');
    setTenancyFilter('all');
    setAllocationFilter('all');
    setSelectedContext({ type: 'property', id: property.id });
    setContactDirty(false);
    setTreeOpen(true);
    setExpandedUnits(new Set(units.map((unit) => unit.id)));
  }, [property.id]);

  const rows = propertyTransactions
    .filter((transaction) => getYear(transaction.date) === Number(selectedYear))
    .sort((a, b) => b.date.localeCompare(a.date));
  const visibleRows = rows
    .filter((transaction) => kindFilter === 'all' || transaction.kind === kindFilter)
    .filter((transaction) => {
      if (categoryFilter === 'all') return true;
      const category = categories.find((item) => item.id === transaction.categoryId);
      return transaction.categoryId === categoryFilter || category?.parentId === categoryFilter;
    })
    .filter((transaction) => transactionMatchesUnit(transaction, unitFilter))
    .filter((transaction) => transactionMatchesTenancy(transaction, tenancyFilter))
    .filter((transaction) => {
      if (allocationFilter === 'all') return true;
      return allocationFilter === 'allocatable'
        ? transaction.allocatable === true
        : transaction.kind !== 'expense' || transaction.allocatable !== true;
    });
  const usedCategories = categories.filter((category) =>
    rows.some(
      (transaction) =>
        transaction.categoryId === category.id ||
        categories.find((item) => item.id === transaction.categoryId)?.parentId === category.id,
    ),
  );
  const income = sum(rows, 'income');
  const expenses = sum(rows, 'expense');

  return (
    <>
      <button type="button" className="back-button" onClick={onBack}>
        <Icon name="arrowLeft" size={19} />
        Zurück zu Immobilien
      </button>

      <section className="property-hero card">
        <div className="property-hero__visual" style={{ '--accent': property.accent }}>
          <span>{property.initials}</span>
        </div>
        <div className="property-hero__content">
          <div className="property-hero__heading">
            <div>
              <span className="type-label">{property.type}</span>
              <h2>{property.name}</h2>
              <p>{propertyAddressLine(property)}</p>
            </div>
            <button type="button" className="button button--primary" onClick={() => onAdd()}>
              <Icon name="plus" size={18} />
              Buchung erfassen
            </button>
          </div>
          <p className="property-description">{property.description}</p>
          <div className="hero-facts">
            <span><strong>{property.units}</strong> Einheiten</span>
            <span><strong>{property.occupiedUnits}</strong> vermietet</span>
            <span><strong>{number.format(property.area)} m²</strong> Fläche</span>
            <span><strong>{formatPlanValue(property.planColdRent, property.planConfiguredCold, property.planTotalUnits)}</strong> Plan-Kaltmiete</span>
            <span><strong>{formatPlanValue(property.planUtilityAdvance, property.planConfiguredUtility, property.planTotalUnits)}</strong> Plan-Betriebskosten</span>
            <span><strong>{formatPlanValue(property.planWarmRent, property.planConfiguredWarm, property.planTotalUnits)}</strong> Plan-Warmmiete</span>
            <span><strong>{money.format(property.activeWarmRent)}</strong> Aktuelle Vertrags-Warmmiete</span>
          </div>
        </div>
      </section>

      <section className="metric-grid metric-grid--three">
        <MetricCard
          label="Einnahmen"
          value={money.format(income)}
          detail={selectedYear + ' – zum Filtern anklicken'}
          tone="green"
          indicator="Ist"
          active={kindFilter === 'income'}
          onClick={() => setKindFilter(kindFilter === 'income' ? 'all' : 'income')}
        />
        <MetricCard
          label="Ausgaben"
          value={money.format(expenses)}
          detail={selectedYear + ' – zum Filtern anklicken'}
          tone="orange"
          indicator={rows.filter((row) => row.receiptName).length + ' Belege'}
          active={kindFilter === 'expense'}
          onClick={() => setKindFilter(kindFilter === 'expense' ? 'all' : 'expense')}
        />
        <MetricCard
          label="Objektergebnis"
          value={money.format(income - expenses)}
          detail={'vor Steuern in ' + selectedYear}
          tone="dark"
          indicator={income ? Math.round(((income - expenses) / income) * 100) + ' %' : '–'}
        />
      </section>

      <section className="card object-workspace">
        <CardHeader
          title="Objektbaum & digitale Akte"
          subtitle="Immobilie → Einheit → Mietverhältnis → Mietpartei"
          action={(() => {
            const activeCount = propertyTenancies.filter((tenancy) => isTenancyActive(tenancy)).length;
            return <span className="tree-legend">{units.length} Einheiten · {activeCount} {activeCount === 1 ? 'aktiver Vertrag' : 'aktive Verträge'}</span>;
          })()}
        />
        <div className="object-workspace__grid">
          <ObjectTree
            property={property}
            units={units}
            tenancies={propertyTenancies}
            tenancyUnits={tenancyUnits}
            contacts={contacts}
            selectedContext={selectedContext}
            onSelect={selectContext}
            treeOpen={treeOpen}
            onToggleTree={() => setTreeOpen((current) => !current)}
            expandedUnits={expandedUnits}
            onToggleUnit={(unitId) => setExpandedUnits((current) => {
              const next = new Set(current);
              if (next.has(unitId)) next.delete(unitId);
              else next.add(unitId);
              return next;
            })}
          />
          <ObjectContextPanel
            context={selectedContext}
            property={property}
            units={units}
            tenancies={propertyTenancies}
            tenancyUnits={tenancyUnits}
            contacts={contacts}
            documents={documents}
            transactions={propertyTransactions}
            categories={categories}
            onAddUnit={onAddUnit}
            onEditUnit={onEditUnit}
            onAddTenancy={onAddTenancy}
            onAddDocument={onAddDocument}
            onOpenDocument={onOpenDocument}
            onEndTenancy={onEndTenancy}
            onAddTransaction={onAdd}
            onOpenTransaction={onOpenTransaction}
            allProperties={allProperties}
            onSaveContact={onSaveContact}
            contactDirty={contactDirty}
            onContactDirtyChange={setContactDirty}
            onSelectContact={(contactId, tenancyId) => selectContext({ type: 'contact', id: contactId, tenancyId })}
            onOpenContactArea={onOpenContactArea}
            onOpenTenancy={onOpenTenancy}
          />
        </div>
      </section>

      <section className="detail-grid">
        <div className="card chart-card">
          <CardHeader title="Jahresverlauf" subtitle={'Objektbezogene Buchungen ' + selectedYear} action={<Legend />} />
          <MonthlyChart transactions={rows} />
        </div>
        <div className="card facts-card">
          <CardHeader title="Objektdaten" subtitle="Stammdaten der Demo" />
          <dl>
            <div><dt>Nutzungsart</dt><dd>{property.type}</dd></div>
            <div><dt>Baujahr</dt><dd>{property.built}</dd></div>
            <div><dt>Gesamtfläche</dt><dd>{number.format(property.area)} m²</dd></div>
            <div><dt>Vermietungsstand</dt><dd>{property.occupiedUnits} / {property.units}</dd></div>
            <div><dt>Plan-Kaltmiete p.a.</dt><dd>{formatPlanValue(property.planColdRent, property.planConfiguredCold, property.planTotalUnits, 12)}</dd></div>
            <div><dt>Plan-Betriebskosten p.a.</dt><dd>{formatPlanValue(property.planUtilityAdvance, property.planConfiguredUtility, property.planTotalUnits, 12)}</dd></div>
            <div><dt>Aktuelle Vertrags-Warmmiete</dt><dd>{money.format(property.activeWarmRent)}</dd></div>
            {property.legacyTargetColdRentTotal !== null && property.legacyTargetColdRentTotal !== undefined && (
              <div><dt>Historischer Objekt-Sollwert</dt><dd>{money.format(property.legacyTargetColdRentTotal)} · nicht operativ</dd></div>
            )}
          </dl>
        </div>
      </section>

      <section className="card object-ledger">
        <CardHeader
          title="Einnahmen, Ausgaben & Belege"
          subtitle={visibleRows.length + ' von ' + rows.length + ' Buchungen sichtbar'}
          action={
            <label className="compact-select">
              <span>Jahr</span>
              <select
                aria-label="Jahr der Objektbuchungen"
                value={selectedYear}
                onChange={(event) => {
                  setSelectedYear(Number(event.target.value));
                  setCategoryFilter('all');
                }}
              >
                {(availableYears.length ? availableYears : [DEMO_YEAR]).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          }
        />
        <div className="object-ledger__filters">
          <div className="filter-pills" aria-label="Buchungsart">
            <button
              type="button"
              className={kindFilter === 'all' ? 'active' : ''}
              onClick={() => setKindFilter('all')}
            >
              Alle
            </button>
            <button
              type="button"
              className={kindFilter === 'income' ? 'active' : ''}
              onClick={() => setKindFilter('income')}
            >
              Einnahmen
            </button>
            <button
              type="button"
              className={kindFilter === 'expense' ? 'active' : ''}
              onClick={() => setKindFilter('expense')}
            >
              Ausgaben
            </button>
          </div>
          <label className="compact-select compact-select--category">
            <span>Kategorie</span>
            <select
              aria-label="Kategorie der Objektbuchungen"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">Alle Kategorien</option>
              {usedCategories
                .filter((category) => !category.parentId)
                .map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              {usedCategories
                .filter((category) => category.parentId)
                .map((category) => {
                  const parent = categories.find((item) => item.id === category.parentId);
                  return (
                    <option key={category.id} value={category.id}>
                      {(parent ? parent.name + ' › ' : '') + category.name}
                    </option>
                  );
                })}
            </select>
          </label>
          <label className="compact-select compact-select--category">
            <span>Einheit</span>
            <select
              aria-label="Einheit der Objektbuchungen"
              value={unitFilter}
              onChange={(event) => {
                setUnitFilter(event.target.value);
                setTenancyFilter('all');
              }}
            >
              <option value="all">Alle Einheiten</option>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </label>
          <label className="compact-select compact-select--category">
            <span>Mietverhältnis</span>
            <select
              aria-label="Mietverhältnis der Objektbuchungen"
              value={tenancyFilter}
              onChange={(event) => setTenancyFilter(event.target.value)}
            >
              <option value="all">Alle Mietverhältnisse</option>
              {propertyTenancies.map((tenancy) => {
                const primary = contacts.find((contact) => contact.id === tenancy.primaryContactId);
                return <option key={tenancy.id} value={tenancy.id}>{primary?.name || 'Ohne Hauptkontakt'}</option>;
              })}
            </select>
          </label>
          <label className="compact-select compact-select--category">
            <span>Kostenstatus</span>
            <select
              aria-label="Umlagestatus der Objektbuchungen"
              value={allocationFilter}
              onChange={(event) => setAllocationFilter(event.target.value)}
            >
              <option value="all">Alle Kosten</option>
              <option value="allocatable">Umlagefähig markiert</option>
              <option value="owner">Eigentümerkosten</option>
            </select>
          </label>
          <span className="ledger-hint">Buchung anklicken, um Details oder Beleg zu öffnen.</span>
        </div>
        <TransactionsTable
          transactions={visibleRows}
          properties={[property]}
          categories={categories}
          units={units}
          onOpenTransaction={onOpenTransaction}
        />
      </section>
    </>
  );
}

function ObjectTree({
  property,
  units,
  tenancies,
  tenancyUnits,
  contacts,
  selectedContext,
  onSelect,
  treeOpen,
  onToggleTree,
  expandedUnits,
  onToggleUnit,
}) {
  const selected = (type, id) => selectedContext.type === type && selectedContext.id === id;
  return (
    <aside className="object-tree" aria-label="Objektstruktur">
      <div className="object-tree__root">
        <button type="button" className="tree-toggle" aria-label="Immobilie auf- oder zuklappen" onClick={onToggleTree}>
          <span className={'tree-chevron ' + (treeOpen ? 'tree-chevron--open' : '')}><Icon name="chevron" size={15} /></span>
        </button>
        <button
          type="button"
          className={'tree-node tree-node--root ' + (selected('property', property.id) ? 'tree-node--selected' : '')}
          onClick={() => onSelect({ type: 'property', id: property.id })}
        >
          <span className="tree-node__icon"><Icon name="building" size={18} /></span>
          <span><strong>{property.shortName}</strong><small>{property.type}</small></span>
        </button>
      </div>
      {treeOpen && (
        <div className="tree-branch tree-branch--root">
          <button
            type="button"
            className={'tree-node ' + (selected('property', property.id) ? 'tree-node--selected' : '')}
            onClick={() => onSelect({ type: 'property', id: property.id })}
          >
            <span className="tree-node__icon"><Icon name="file" size={17} /></span>
            <span><strong>Objektakte</strong><small>Stammdaten, Dokumente, Buchungen</small></span>
          </button>
          <div className="tree-section-label">Einheiten ({units.length})</div>
          {units.map((unit) => {
            const unitTenancies = tenancies
              .filter((tenancy) => tenancyUnitIds(tenancy, tenancyUnits).includes(unit.id))
              .sort((a, b) => (b.contractStart || b.startDate).localeCompare(a.contractStart || a.startDate));
            const activeTenancy = unitTenancies.find((tenancy) => isTenancyActive(tenancy));
            return (
              <div className="tree-unit" key={unit.id}>
                <div className="tree-unit__row">
                  <button type="button" className="tree-toggle" aria-label={unit.name + ' auf- oder zuklappen'} onClick={() => onToggleUnit(unit.id)}>
                    <span className={'tree-chevron ' + (expandedUnits.has(unit.id) ? 'tree-chevron--open' : '')}><Icon name="chevron" size={14} /></span>
                  </button>
                  <button
                    type="button"
                    className={'tree-node ' + (selected('unit', unit.id) ? 'tree-node--selected' : '')}
                    onClick={() => onSelect({ type: 'unit', id: unit.id })}
                  >
                    <span className="tree-node__icon tree-node__icon--unit"><Icon name="home" size={17} /></span>
                    <span><strong>{unit.name}</strong><small>{unit.usageType} · {number.format(unit.area)} m²</small></span>
                    <i className={'occupancy-dot ' + (activeTenancy ? 'occupancy-dot--active' : '')} title={activeTenancy ? 'Vermietet' : 'Leerstand'} />
                  </button>
                </div>
                {expandedUnits.has(unit.id) && (
                  <div className="tree-branch">
                    {unitTenancies.length ? unitTenancies.map((tenancy) => {
                      const primary = contacts.find((contact) => contact.id === tenancy.primaryContactId);
                      return (
                        <div key={tenancy.id}>
                          <button
                            type="button"
                            className={'tree-node ' + (selected('tenancy', tenancy.id) ? 'tree-node--selected' : '')}
                            onClick={() => onSelect({ type: 'tenancy', id: tenancy.id })}
                          >
                            <span className="tree-node__icon tree-node__icon--tenancy"><Icon name="calendar" size={16} /></span>
                            <span><strong>{tenancyStateLabel(tenancy)}</strong><small>{primary?.name || 'Ohne Hauptkontakt'}</small></span>
                          </button>
                          <div className="tree-branch tree-branch--contacts">
                            {(tenancy.contactIds || []).map((contactId) => {
                              const contact = contacts.find((item) => item.id === contactId);
                              if (!contact) return null;
                              return (
                                <button
                                  type="button"
                                  key={contact.id}
                                  className={'tree-node tree-node--contact ' + (selected('contact', contact.id) ? 'tree-node--selected' : '')}
                                  onClick={() => onSelect({ type: 'contact', id: contact.id, tenancyId: tenancy.id })}
                                  aria-label={`${contact.name} rechts in der Kontaktakte anzeigen`}
                                >
                                  <span className="tenant-avatar tenant-avatar--tree">{initials(contact.name)}</span>
                                  <span><strong>{contact.name}</strong><small>{contact.id === tenancy.primaryContactId ? 'Hauptkontakt' : 'Vertragspartner'}</small></span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }) : <div className="tree-empty">Noch kein Mietverhältnis</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function ObjectContextPanel({
  context,
  property,
  units,
  tenancies,
  tenancyUnits,
  contacts,
  documents,
  transactions,
  categories,
  onAddUnit,
  onEditUnit,
  onAddTenancy,
  onAddDocument,
  onOpenDocument,
  onEndTenancy,
  onAddTransaction,
  onOpenTransaction,
  allProperties,
  onSaveContact,
  contactDirty,
  onContactDirtyChange,
  onSelectContact,
  onOpenContactArea,
  onOpenTenancy,
}) {
  const unit = context.type === 'unit'
    ? units.find((item) => item.id === context.id)
    : context.type === 'tenancy'
      ? units.find((item) => item.id === tenancyUnitIds(
        tenancies.find((tenancy) => tenancy.id === context.id),
        tenancyUnits,
      )[0])
      : null;
  const tenancy = context.type === 'tenancy'
    ? tenancies.find((item) => item.id === context.id)
    : context.type === 'contact'
      ? tenancies.find((item) => item.id === context.tenancyId)
        || tenancies.find((item) => (item.contactIds || []).includes(context.id))
      : context.type === 'unit'
        ? activeTenancyForUnit(tenancies, context.id, undefined, tenancyUnits)
        : null;
  const contact = context.type === 'contact' ? contacts.find((item) => item.id === context.id) : null;
  const primary = tenancy ? contacts.find((item) => item.id === tenancy.primaryContactId) : null;
  const propertyPlan = unitPlanSummary(units);
  const unitPlan = unit ? unitPlanSummary([unit]) : null;
  const contextDocuments = documentsForContext(documents, context, units, tenancies, contacts)
    .sort((a, b) => b.date.localeCompare(a.date));
  const contextTransactions = transactions.filter((transaction) => {
    if (context.type === 'property') return true;
    if (context.type === 'unit') return transactionMatchesUnit(transaction, context.id);
    if (context.type === 'tenancy') return transactionMatchesTenancy(transaction, context.id);
    if (context.type === 'contact') return tenancy && transactionMatchesTenancy(transaction, tenancy.id);
    return false;
  });
  const title = context.type === 'property'
    ? 'Objektakte ' + property.shortName
    : context.type === 'unit'
      ? unit?.name
      : context.type === 'tenancy'
        ? 'Mietverhältnis · ' + (primary?.name || 'ohne Hauptkontakt')
        : contact?.name;
  const subtitle = context.type === 'property'
    ? 'Alle Unterlagen und Bewegungen des Objekts'
    : context.type === 'unit'
      ? unit?.usageType + ' · ' + number.format(unit?.area || 0) + ' m²'
      : context.type === 'tenancy'
        ? (isTenancyActive(tenancy) ? 'Aktiv seit ' : 'Beendet · Beginn ') + formatDate(tenancy?.startDate)
        : contact?.kind === 'company' ? 'Firma / Vertragspartner' : 'Person / Vertragspartner';

  return (
    <div className="object-context">
      <div className="object-context__header">
        <div><span className="section-kicker">{contextLabel(context.type)}</span><h3>{title}</h3><p>{subtitle}</p></div>
        <div className="context-actions">
          {context.type === 'property' && <button type="button" className="button button--ghost button--small" onClick={onAddUnit}><Icon name="plus" size={15} /> Einheit</button>}
          {context.type === 'unit' && unit && <button type="button" className="button button--ghost button--small" onClick={() => onEditUnit(unit.id)}><Icon name="file" size={15} /> Einheit bearbeiten</button>}
          {(context.type === 'property' || (context.type === 'unit' && !tenancy)) && (
            <button type="button" className="button button--ghost button--small" onClick={() => onAddTenancy(context.type === 'unit' ? context.id : undefined)}><Icon name="plus" size={15} /> Mieter</button>
          )}
          {(context.type === 'property' || context.type === 'unit') && (
            <button type="button" className="button button--ghost button--small" onClick={() => onAddTransaction(context.type === 'unit' ? context.id : undefined)}><Icon name="plus" size={15} /> Buchung</button>
          )}
          {tenancy && context.type === 'unit' && (
            <button type="button" className="button button--ghost button--small" onClick={() => onOpenTenancy(tenancy.id)}><Icon name="calendar" size={15} /> Mietverhältnis öffnen</button>
          )}
          {context.type === 'tenancy' && tenancy && (
            <button type="button" className="button button--ghost button--small" onClick={() => onOpenTenancy(tenancy.id)}><Icon name="calendar" size={15} /> Mietverhältnis öffnen</button>
          )}
          {context.type === 'contact' && contact && (
            <button type="button" className="button button--ghost button--small" onClick={() => onOpenContactArea(contact.id)}><Icon name="home" size={15} /> Vollständigen Mieterbereich öffnen</button>
          )}
          <button type="button" className="button button--primary button--small" onClick={() => onAddDocument(context.type, context.id)}><Icon name="upload" size={15} /> Dokument</button>
        </div>
      </div>

      {context.type === 'property' && (
        <div className="context-facts context-facts--four">
          <ContextFact label="Einheiten" value={String(units.length)} />
          <ContextFact label="Aktiv vermietet" value={String(tenancies.filter((item) => isTenancyActive(item)).length)} />
          <ContextFact label="Dokumente gesamt" value={String(contextDocuments.length)} />
          <ContextFact label="Buchungen" value={String(contextTransactions.length)} />
          <ContextFact label="Plan-Kaltmiete" value={formatPlanValue(propertyPlan.coldRent, propertyPlan.configuredCold, propertyPlan.totalUnits)} />
          <ContextFact label="Plan-Betriebskosten" value={formatPlanValue(propertyPlan.utilityAdvance, propertyPlan.configuredUtility, propertyPlan.totalUnits)} />
          <ContextFact label="Plan-Warmmiete" value={formatPlanValue(propertyPlan.warmRent, propertyPlan.configuredWarm, propertyPlan.totalUnits)} />
          <ContextFact label="Plan-Vollständigkeit" value={planCompletenessLabel(propertyPlan.configuredWarm, propertyPlan.totalUnits)} />
        </div>
      )}
      {context.type === 'unit' && unit && (
        <div className="context-facts context-facts--four">
          <ContextFact label="Nutzung" value={unit.usageType} />
          <ContextFact label="Fläche" value={number.format(unit.area) + ' m²'} />
          <ContextFact label="Etage / Lage" value={unit.floor || '–'} />
          <ContextFact label="Status" value={tenancy ? 'Vermietet' : 'Leerstand'} />
          <ContextFact label="Plan-Kaltmiete" value={formatPlanValue(unitPlan.coldRent, unitPlan.configuredCold, unitPlan.totalUnits)} />
          <ContextFact label="Plan-Betriebskosten" value={formatPlanValue(unitPlan.utilityAdvance, unitPlan.configuredUtility, unitPlan.totalUnits)} />
          <ContextFact label="Plan-Warmmiete" value={formatPlanValue(unitPlan.warmRent, unitPlan.configuredWarm, unitPlan.totalUnits)} />
          <ContextFact label="Plan-Vollständigkeit" value={planCompletenessLabel(unitPlan.configuredWarm, unitPlan.totalUnits)} />
        </div>
      )}
      {context.type === 'tenancy' && tenancy && (
        <>
          <div className="context-facts context-facts--four">
            <ContextFact label="Einheit" value={unit?.name || '–'} />
            <ContextFact label="Kaltmiete" value={moneyExact.format(tenancy.coldRent)} />
            <ContextFact label="NK-Vorauszahlung" value={moneyExact.format(tenancy.utilityAdvance)} />
            <ContextFact label="Kaution" value={moneyExact.format(tenancy.deposit)} />
          </div>
          <div className="tenancy-parties">
            {(tenancy.contactIds || []).map((contactId) => {
              const party = contacts.find((item) => item.id === contactId);
              return party ? (
                <button type="button" key={party.id} onClick={() => onSelectContact(party.id, tenancy.id)} aria-label={`${party.name} rechts in der Kontaktakte anzeigen`}>
                  <b>{party.name}</b><small>{party.id === tenancy.primaryContactId ? 'Hauptkontakt · Kontaktakte anzeigen' : 'Vertragspartner · Kontaktakte anzeigen'}</small>
                </button>
              ) : null;
            })}
          </div>
          {isTenancyActive(tenancy) && (
            <button type="button" className="text-action text-action--danger" onClick={() => onEndTenancy(tenancy.id)}>Mietverhältnis heute beenden</button>
          )}
        </>
      )}
      {context.type === 'contact' && contact && (
        <div className="object-contact-record">
          <ContactRecord
            contact={contact}
            properties={allProperties}
            addressSources={[property.id]}
            onSave={onSaveContact}
            dirty={contactDirty}
            onDirtyChange={onContactDirtyChange}
          />
        </div>
      )}

      <div className="context-section">
        <div className="context-section__heading"><div><h4>Dokumente</h4><p>{context.type === 'property' ? 'Inklusive Unterbereiche, ohne Dubletten' : 'Direkt an diesem Bereich abgelegt'}</p></div><span>{contextDocuments.length}</span></div>
        <DocumentList documents={contextDocuments} onOpen={onOpenDocument} />
      </div>
      <div className="context-section">
        <div className="context-section__heading"><div><h4>Zugeordnete Bewegungen</h4><p>Kostenanteile und Einnahmen dieses Bereichs</p></div><span>{contextTransactions.length}</span></div>
        <TransactionsTable
          transactions={contextTransactions.slice(0, 5)}
          properties={[property]}
          categories={categories}
          units={units}
          compact
          onOpenTransaction={onOpenTransaction}
        />
      </div>
    </div>
  );
}

function TransactionsPage({
  properties,
  transactions,
  categories,
  units,
  tenancies,
  tenancyUnits,
  tenancyParties = [],
  contacts,
  onAdd,
  onOpenTransaction,
}) {
  const [kindFilter, setKindFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [tenancyFilter, setTenancyFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [allocationFilter, setAllocationFilter] = useState('all');
  const [search, setSearch] = useState('');

  const availableUnits = units.filter(
    (unit) => propertyFilter === 'all' || unit.propertyId === propertyFilter,
  );
  const availableUnitIds = availableUnits.map((unit) => unit.id);
  const availableTenancies = tenancies.filter((tenancy) =>
    tenancyUnitIds(tenancy, tenancyUnits).some((unitId) => availableUnitIds.includes(unitId)));

  const filtered = useMemo(
    () =>
      transactions
        .filter((transaction) => kindFilter === 'all' || transaction.kind === kindFilter)
        .filter(
          (transaction) =>
            propertyFilter === 'all' || transaction.propertyId === propertyFilter,
        )
        .filter((transaction) => transactionMatchesUnit(transaction, unitFilter))
        .filter((transaction) => transactionMatchesTenancy(transaction, tenancyFilter))
        .filter((transaction) => categoryMatchesFilter(transaction.categoryId, categoryFilter, categories))
        .filter((transaction) => allocationFilter === 'all' || (
          allocationFilter === 'allocatable'
            ? transaction.allocatable === true
            : transaction.kind !== 'expense' || transaction.allocatable !== true
        ))
        .filter((transaction) => {
          const property = properties.find((item) => item.id === transaction.propertyId);
          const relatedUnitIds = new Set([
            transaction.unitId,
            ...(transaction.allocations || []).map((allocation) => allocation.unitId),
          ].filter(Boolean));
          const relatedTenancyIds = new Set([
            transaction.tenancyId,
            ...(transaction.allocations || []).map((allocation) => allocation.tenancyId),
          ].filter(Boolean));
          const relatedUnits = units.filter((unit) => relatedUnitIds.has(unit.id));
          const relatedTenancies = tenancies.filter((tenancy) => relatedTenancyIds.has(tenancy.id));
          const relatedPartyRelations = tenancyParties.filter((party) =>
            relatedTenancyIds.has(party.tenancyId));
          const relatedContactIds = new Set(
            relatedPartyRelations.map((party) => party.contactId).filter(Boolean),
          );
          relatedTenancies.forEach((tenancy) => {
            const hasPartyRelations = relatedPartyRelations.some((party) =>
              party.tenancyId === tenancy.id);
            if (!hasPartyRelations) {
              (tenancy.contactIds || []).forEach((contactId) => relatedContactIds.add(contactId));
            }
          });
          const relatedContacts = contacts.filter((contact) => relatedContactIds.has(contact.id));

          return matchesGermanSearch(search, [
            transaction.description,
            transaction.receiptName,
            transaction.date,
            formatDate(transaction.date),
            transaction.amount,
            moneyExact.format(transaction.amount),
            categoryPathNames(transaction.categoryId, categories),
            property?.name,
            property?.shortName,
            property?.address,
            property?.postalCode,
            property?.city,
            relatedUnits.map((unit) => unit.name),
            relatedContacts.map((contact) => contact.name),
          ]);
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, kindFilter, propertyFilter, unitFilter, tenancyFilter, categoryFilter, allocationFilter, search, categories, contacts, properties, tenancies, tenancyParties, units],
  );

  return (
    <>
      <section className="page-intro">
        <div>
          <span className="section-kicker">Finanzen</span>
          <h2>Jede Bewegung nachvollziehbar.</h2>
          <p className="muted">Einnahmen, Ausgaben und zugeordnete Belege an einem Ort.</p>
        </div>
        <button type="button" className="button button--primary" onClick={onAdd} disabled={!properties.length} title={!properties.length ? 'Lege zuerst eine Immobilie an.' : undefined}>
          <Icon name="plus" size={18} />
          Buchung erfassen
        </button>
      </section>

      <section className="card transactions-card">
        <div className="filters">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Beschreibung, Kategorie, Objekt durchsuchen …"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select aria-label="Kategorie filtern" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Alle Kategorien</option>
            <CategoryFilterOptions categories={categories} />
          </select>
          <select
            aria-label="Buchungsart filtern"
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
          >
            <option value="all">Alle Buchungsarten</option>
            <option value="income">Nur Einnahmen</option>
            <option value="expense">Nur Ausgaben</option>
          </select>
          <select
            aria-label="Immobilie filtern"
            value={propertyFilter}
            onChange={(event) => {
              setPropertyFilter(event.target.value);
              setUnitFilter('all');
              setTenancyFilter('all');
            }}
          >
            <option value="all">Alle Immobilien</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>{property.shortName}</option>
            ))}
          </select>
          <select aria-label="Einheit filtern" value={unitFilter} onChange={(event) => { setUnitFilter(event.target.value); setTenancyFilter('all'); }}>
            <option value="all">Alle Einheiten</option>
            {availableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
          <select aria-label="Mietverhältnis filtern" value={tenancyFilter} onChange={(event) => setTenancyFilter(event.target.value)}>
            <option value="all">Alle Mietverhältnisse</option>
            {availableTenancies.map((tenancy) => {
              const primary = contacts.find((contact) => contact.id === tenancy.primaryContactId);
              return <option key={tenancy.id} value={tenancy.id}>{primary?.name || 'Ohne Hauptkontakt'}</option>;
            })}
          </select>
          <select aria-label="Kostenstatus filtern" value={allocationFilter} onChange={(event) => setAllocationFilter(event.target.value)}>
            <option value="all">Alle Kostenstatus</option>
            <option value="allocatable">Umlagefähig markiert</option>
            <option value="owner">Eigentümerkosten</option>
          </select>
        </div>
        <div className="table-summary">
          <span>{filtered.length} Buchungen</span>
          <span>Einnahmen: <strong className="positive">{money.format(sum(filtered, 'income'))}</strong></span>
          <span>Ausgaben: <strong className="negative">{money.format(sum(filtered, 'expense'))}</strong></span>
        </div>
        <TransactionsTable
          transactions={filtered}
          properties={properties}
          categories={categories}
          units={units}
          onOpenTransaction={onOpenTransaction}
        />
      </section>
    </>
  );
}

function TransactionsTable({
  transactions,
  properties,
  categories,
  units = [],
  compact = false,
  onOpenTransaction,
}) {
  if (!transactions.length) {
    return <div className="empty-state">Keine passenden Buchungen gefunden.</div>;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Beschreibung</th>
            {!compact && <th>Immobilie</th>}
            <th>Kategorie</th>
            <th>Beleg</th>
            <th className="align-right">Betrag</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const property = properties.find((item) => item.id === transaction.propertyId);
            const category = categories.find((item) => item.id === transaction.categoryId);
            const parentCategory = category?.parentId
              ? categories.find((item) => item.id === category.parentId)
              : null;
            const unit = units.find((item) => item.id === transaction.unitId);
            const allocatedUnits = transaction.allocations?.length || 0;
            return (
              <tr key={transaction.id}>
                <td className="no-wrap">{formatDate(transaction.date)}</td>
                <td>
                  {onOpenTransaction ? (
                    <button
                      type="button"
                      className="table-description-button"
                      onClick={() => onOpenTransaction(transaction)}
                    >
                      {transaction.description}
                    </button>
                  ) : (
                    <strong className="table-description">{transaction.description}</strong>
                  )}
                  {(unit || allocatedUnits || transaction.kind === 'expense') && (
                    <span className="table-scope">
                      {unit ? unit.name : allocatedUnits ? allocatedUnits + ' Einheiten' : 'Gesamtobjekt'}
                      {transaction.kind === 'expense' && (
                        <i className={transaction.allocatable ? 'allocation-chip allocation-chip--yes' : 'allocation-chip'}>
                          {transaction.allocatable ? 'umlagefähig' : 'Eigentümerkosten'}
                        </i>
                      )}
                    </span>
                  )}
                </td>
                {!compact && <td>{property?.shortName || 'Unbekannt'}</td>}
                <td>
                  <span className={'kind-chip kind-chip--' + transaction.kind}>
                    {parentCategory
                      ? parentCategory.name + ' › ' + category.name
                      : category?.name || 'Ohne Kategorie'}
                  </span>
                </td>
                <td>
                  <Receipt
                    transaction={transaction}
                    onOpen={
                      onOpenTransaction
                        ? () => onOpenTransaction(transaction)
                        : undefined
                    }
                  />
                </td>
                <td className={'align-right amount amount--' + transaction.kind}>
                  {transaction.kind === 'expense' ? '− ' : '+ '}
                  {moneyExact.format(transaction.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Receipt({ transaction, onOpen }) {
  if (!transaction.receiptName) {
    return <span className="no-receipt">–</span>;
  }
  return (
    <button
      type="button"
      className="receipt-link"
      title={transaction.receiptName}
      onClick={onOpen}
      disabled={!onOpen}
    >
      <Icon name="file" size={16} />
      Ansehen
    </button>
  );
}

function ReportsPage({ properties, transactions }) {
  const availableYears = [...new Set(transactions.map((transaction) => getYear(transaction.date)))]
    .sort((a, b) => b - a);
  const [year, setYear] = useState(availableYears[0] || DEMO_YEAR);
  const rows = transactions.filter((transaction) => getYear(transaction.date) === Number(year));
  const income = sum(rows, 'income');
  const expenses = sum(rows, 'expense');
  const propertyResults = properties.map((property) => {
    const propertyRows = rows.filter((transaction) => transaction.propertyId === property.id);
    return {
      property,
      income: sum(propertyRows, 'income'),
      expenses: sum(propertyRows, 'expense'),
    };
  });

  return (
    <>
      <section className="page-intro">
        <div>
          <span className="section-kicker">Berichte</span>
          <h2>Jahresübersicht {year}</h2>
          <p className="muted">Grobe betriebswirtschaftliche Sicht, bewusst ohne Steuerlogik.</p>
        </div>
        <label className="year-select">
          <span>Auswertungsjahr</span>
          <select value={year} onChange={(event) => setYear(event.target.value)}>
            {(availableYears.length ? availableYears : [DEMO_YEAR]).map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </section>

      <section className="metric-grid metric-grid--three">
        <MetricCard label="Gesamteinnahmen" value={money.format(income)} detail={'Jahr ' + year} tone="green" indicator="Ist" />
        <MetricCard label="Gesamtausgaben" value={money.format(expenses)} detail={'Jahr ' + year} tone="orange" indicator={rows.filter((row) => row.receiptName).length + ' Belege'} />
        <MetricCard label="Jahresergebnis" value={money.format(income - expenses)} detail="vor Steuern" tone="dark" indicator={income ? Math.round(((income - expenses) / income) * 100) + ' % Marge' : '–'} />
      </section>

      <section className="card report-chart">
        <CardHeader title="Monatsvergleich" subtitle={'Cashflow im Jahr ' + year} action={<Legend />} />
        <MonthlyChart transactions={rows} />
      </section>

      <section className="card">
        <CardHeader title="Ergebnis nach Immobilie" subtitle="Einnahmen minus Ausgaben" />
        <div className="report-list">
          {propertyResults.map(({ property, income: itemIncome, expenses: itemExpenses }) => {
            const result = itemIncome - itemExpenses;
            const width = income ? Math.max((itemIncome / income) * 100, 8) : 8;
            return (
              <div className="report-row" key={property.id}>
                <div className="report-property">
                  <span className="small-monogram" style={{ background: property.accent }}>
                    {property.initials}
                  </span>
                  <div>
                    <strong>{property.shortName}</strong>
                    <span>{property.type}</span>
                  </div>
                </div>
                <div className="report-bar-wrap">
                  <div className="report-bar" style={{ width: width + '%' }} />
                </div>
                <div className="report-number">
                  <span>{money.format(itemIncome)} / {money.format(itemExpenses)}</span>
                  <strong>{money.format(result)}</strong>
                </div>
              </div>
            );
          })}
          {!propertyResults.length && <div className="empty-state">Noch keine Immobilie für eine Auswertung vorhanden.</div>}
        </div>
      </section>

      <div className="info-banner">
        <Icon name="wallet" size={22} />
        <p>
          <strong>Demo-Hinweis:</strong> Diese Übersicht ist keine Buchhaltung und ersetzt
          weder Steuerberatung noch eine rechtssichere Nebenkostenabrechnung.
        </p>
      </div>
    </>
  );
}

function CategoriesPage({ categories, transactions, onAdd, tutorialProgress, onOpenTutorial }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('expense');
  const [parentId, setParentId] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim(), kind, parentId: parentId || null });
    setName('');
  };

  const changeKind = (value) => {
    setKind(value);
    setParentId('');
  };

  const parentCategories = categories.filter(
    (category) => category.kind === kind && !category.parentId,
  );

  const renderGroup = (groupKind, title) => {
    const parents = categories.filter(
      (category) => category.kind === groupKind && !category.parentId,
    );

    return (
      <div className="category-column">
        <h3>{title}</h3>
        <div className="category-list">
          {parents.map((category) => {
            const children = categories.filter((item) => item.parentId === category.id);
            const relatedIds = new Set([category.id, ...children.map((item) => item.id)]);
            const bookingCount = transactions.filter((transaction) =>
              relatedIds.has(transaction.categoryId),
            ).length;

            return (
              <div className="category-tree-group" key={category.id}>
                <div className="category-item category-item--parent">
                  <span className="category-color" style={{ background: category.color }} />
                  <div>
                    <strong>{category.name}</strong>
                    <span>{bookingCount} Buchungen gesamt</span>
                  </div>
                  <span className={'kind-label kind-label--' + groupKind}>
                    {children.length ? children.length + ' Unterkategorien' : 'Direkt'}
                  </span>
                </div>
                {children.length > 0 && (
                  <div className="subcategory-list">
                    {children.map((child) => (
                      <div className="subcategory-item" key={child.id}>
                        <span className="subcategory-branch">↳</span>
                        <div>
                          <strong>{child.name}</strong>
                          <span>
                            {transactions.filter(
                              (transaction) => transaction.categoryId === child.id,
                            ).length}
                            {' '}Buchungen
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <TutorialSettingsCard progress={tutorialProgress} onOpen={onOpenTutorial} />
      <section className="page-intro">
        <div>
          <span className="section-kicker">Systematik</span>
          <h2>Kategorien mit sinnvoller Tiefe.</h2>
          <p className="muted">
            Hauptkategorien bündeln die Themen, Unterkategorien machen Buchungen genauer.
          </p>
        </div>
      </section>

      <section className="category-layout">
        <div className="card category-overview">
          {renderGroup('income', 'Einnahmen')}
          {renderGroup('expense', 'Ausgaben')}
        </div>
        <aside className="card add-category">
          <CardHeader
            title="Kategorie ergänzen"
            subtitle="Haupt- oder Unterkategorie"
          />
          <form onSubmit={submit}>
            <label>
              <span>Bezeichnung</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="z. B. Schornsteinfeger"
                required
              />
            </label>
            <label>
              <span>Art</span>
              <select value={kind} onChange={(event) => changeKind(event.target.value)}>
                <option value="expense">Ausgabe</option>
                <option value="income">Einnahme</option>
              </select>
            </label>
            <label>
              <span>Übergeordnete Kategorie</span>
              <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
                <option value="">Keine – neue Hauptkategorie</option>
                {parentCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <p className="form-help">
              Beispiel: Versicherungen als Hauptkategorie und Gebäudeversicherung darunter.
            </p>
            <button type="submit" className="button button--primary button--full">
              <Icon name="plus" size={18} />
              {parentId ? 'Unterkategorie hinzufügen' : 'Kategorie hinzufügen'}
            </button>
          </form>
        </aside>
      </section>
    </>
  );
}

function UnitModal({ property, units, unit = null, onClose, onSubmit }) {
  const primaryUnits = units.filter((unit) => unit.unitKind !== 'ancillary');
  const singleFamily = property.buildingType === 'singleFamily';
  const editing = Boolean(unit);
  const [form, setForm] = useState({
    name: unit?.name || '',
    usageType: unit?.usageType || (singleFamily ? 'Garage / Stellplatz' : property.type === 'Gewerbe' ? 'Gewerbe' : 'Wohnen'),
    floor: unit?.floor || '',
    area: unit?.area ?? '',
    unitKind: unit?.unitKind || (singleFamily ? 'ancillary' : 'primary'),
    ancillaryType: unit?.ancillaryType || (singleFamily ? 'parking' : null),
    parentUnitId: unit?.parentUnitId || (singleFamily ? primaryUnits[0]?.id || '' : null),
    targetColdRent: unit?.targetColdRent ?? '',
    targetUtilityAdvance: unit?.targetUtilityAdvance ?? '',
  });
  const submit = (event) => {
    event.preventDefault();
    const optionalMoney = (value) => value === '' ? null : Math.max(0, Number(value));
    onSubmit({
      ...form,
      ...(unit?.id ? { id: unit.id } : {}),
      propertyId: property.id,
      area: Math.max(1, Number(form.area)),
      targetColdRent: optionalMoney(form.targetColdRent),
      targetUtilityAdvance: optionalMoney(form.targetUtilityAdvance),
    });
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="unit-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal__header">
          <div><span className="section-kicker">{property.shortName}</span><h2 id="unit-title">{editing ? 'Einheit bearbeiten' : 'Einheit hinzufügen'}</h2></div>
          <button type="button" className="icon-button" aria-label="Dialog schließen" onClick={onClose}><Icon name="close" /></button>
        </div>
        <form className="transaction-form" onSubmit={submit}>
          <div className="tenant-property-note">
            <div className="small-monogram" style={{ background: property.accent }}>{property.initials}</div>
            <div><strong>{property.name}</strong><span>{editing ? 'Bestehende Einheit und Planwerte' : 'Neue vermietbare Untereinheit'}</span></div>
          </div>
          <div className="form-grid">
            <label className="form-span"><span>Bezeichnung</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="z. B. Ladenlokal oder 2. OG links" required /></label>
              <label><span>Einheitenart</span><select value={form.unitKind} disabled={singleFamily || editing} onChange={(event) => setForm((current) => ({ ...current, unitKind: event.target.value, usageType: event.target.value === 'ancillary' ? 'Garage / Stellplatz' : property.type === 'Gewerbe' ? 'Gewerbe' : 'Wohnen', ancillaryType: event.target.value === 'ancillary' ? 'parking' : null, parentUnitId: event.target.value === 'ancillary' ? primaryUnits[0]?.id || '' : null }))}><option value="primary">Haupteinheit</option><option value="ancillary">Nebeneinheit</option></select></label>
              <label><span>Nutzung</span><select value={form.usageType} disabled={form.unitKind === 'ancillary'} onChange={(event) => setForm((current) => ({ ...current, usageType: event.target.value }))}><option>Wohnen</option><option>Gewerbe</option><option>Garage / Stellplatz</option></select></label>
              {form.unitKind === 'ancillary' && <label><span>Art der Nebeneinheit</span><select value={form.ancillaryType || 'parking'} onChange={(event) => setForm((current) => ({ ...current, ancillaryType: event.target.value, name: current.name || (event.target.value === 'garage' ? 'Garage' : 'Stellplatz') }))}><option value="garage">Garage</option><option value="parking">Stellplatz</option></select></label>}
              {form.unitKind === 'ancillary' && <label><span>Zugehörige Haupteinheit</span><select value={form.parentUnitId || ''} onChange={(event) => setForm((current) => ({ ...current, parentUnitId: event.target.value }))} required>{primaryUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>}
            <label><span>Etage / Lage</span><input value={form.floor} onChange={(event) => setForm((current) => ({ ...current, floor: event.target.value }))} placeholder="z. B. Erdgeschoss" /></label>
            <label><span>Fläche in m²</span><input type="number" min="1" step="0.01" value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))} required /></label>
            <label><span>Plan-Kaltmiete</span><input type="number" min="0" step="0.01" value={form.targetColdRent} onChange={(event) => setForm((current) => ({ ...current, targetColdRent: event.target.value }))} placeholder="Nicht hinterlegt" /></label>
            <label><span>Plan-Betriebskosten</span><input type="number" min="0" step="0.01" value={form.targetUtilityAdvance} onChange={(event) => setForm((current) => ({ ...current, targetUtilityAdvance: event.target.value }))} placeholder="Nicht hinterlegt" /></label>
            <p className="form-help form-span">Plan-Warmmiete: {formWarmPlanLabel(form.targetColdRent, form.targetUtilityAdvance)}. Der Wert 0 € bleibt eine bewusste Vorgabe.</p>
          </div>
          <div className="modal__footer">
            <p>{editing ? 'Die Änderungen bleiben der bestehenden Einheit und ihren Verknüpfungen zugeordnet.' : 'Die Einheit wird als eigener Knoten unter der Immobilie angelegt.'}</p>
            <div><button type="button" className="button button--ghost" onClick={onClose}>Abbrechen</button><button type="submit" className="button button--primary">Einheit speichern</button></div>
          </div>
        </form>
      </section>
    </div>
  );
}

function DocumentModal({ context, property, onClose, onSubmit }) {
  const [form, setForm] = useState({ documentType: 'Sonstiges Dokument', date: new Date().toISOString().slice(0, 10), note: '' });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (!file) return;
    if (file.size > 250 * 1024) {
      setError('Die Datei ist größer als 250 KB. Bitte einen kleineren PDF- oder Bildbeleg verwenden.');
      return;
    }
    const dataUrl = await readFile(file);
    const saved = await onSubmit({ ...form, ...context, name: file.name, dataUrl });
    if (saved === false) setError('Das Dokument konnte nicht lokal gespeichert werden.');
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="document-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal__header"><div><span className="section-kicker">{contextLabel(context.ownerType)} · {property.shortName}</span><h2 id="document-title">Dokument anhängen</h2></div><button type="button" className="icon-button" aria-label="Dialog schließen" onClick={onClose}><Icon name="close" /></button></div>
        <form className="transaction-form" onSubmit={submit}>
          <div className="form-grid">
            <label><span>Dokumenttyp</span><select value={form.documentType} onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))}><option>Mietvertrag</option><option>Übergabeprotokoll</option><option>Rechnung / Beleg</option><option>Versicherung</option><option>Energieausweis</option><option>Grundriss</option><option>Korrespondenz</option><option>Sonstiges Dokument</option></select></label>
            <label><span>Dokumentdatum</span><input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required /></label>
            <label className="upload-field form-span"><input type="file" accept=".pdf,image/*" onChange={(event) => { setFile(event.target.files?.[0] || null); setError(''); }} required /><Icon name="upload" size={24} /><span><strong>{file?.name || 'Datei auswählen'}</strong><small>PDF oder Bild, bis 250 KB vollständig lokal</small></span></label>
            {error && <p className="form-error form-span" role="alert">{error}</p>}
            <label className="form-span"><span>Notiz</span><textarea rows="2" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Kurzer Hinweis zum Dokument" /></label>
          </div>
          <div className="modal__footer"><p>Das Dokument wird genau einmal an diesem Bereich abgelegt.</p><div><button type="button" className="button button--ghost" onClick={onClose}>Abbrechen</button><button type="submit" className="button button--primary">Dokument speichern</button></div></div>
        </form>
      </section>
    </div>
  );
}

function DocumentDetailModal({ document, onClose }) {
  const isImage = document.dataUrl?.startsWith('data:image');
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal receipt-modal" role="dialog" aria-modal="true" aria-labelledby="document-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal__header"><div><span className="section-kicker">{contextLabel(document.ownerType)}</span><h2 id="document-detail-title">{document.documentType}</h2></div><button type="button" className="icon-button" aria-label="Dialog schließen" onClick={onClose}><Icon name="close" /></button></div>
        <div className="receipt-modal__body">
          <dl className="transaction-detail-list"><div><dt>Dateiname</dt><dd>{document.name}</dd></div><div><dt>Datum</dt><dd>{formatDate(document.date)}</dd></div><div><dt>Ablageort</dt><dd>{contextLabel(document.ownerType)}</dd></div><div><dt>Notiz</dt><dd>{document.note || '–'}</dd></div></dl>
          <div className="receipt-preview">
            {document.dataUrl ? (isImage ? <img src={document.dataUrl} alt="Dokumentvorschau" /> : <iframe src={document.dataUrl} title="Dokumentvorschau" />) : (
              <div className="demo-invoice"><div className="demo-invoice__brand"><Icon name="file" size={25} /><div><strong>{document.documentType.toUpperCase()}</strong><span>Demo-Datei ohne gespeicherten Originalinhalt</span></div></div><div className="demo-invoice__lines"><span /><span /><span /></div></div>
            )}
          </div>
        </div>
        <div className="modal__footer receipt-modal__footer"><p>Lokale Demo – keine revisionssichere Archivierung.</p><div>{document.dataUrl && <a className="button button--ghost" href={document.dataUrl} target="_blank" rel="noreferrer">Original öffnen</a>}<button type="button" className="button button--primary" onClick={onClose}>Schließen</button></div></div>
      </section>
    </div>
  );
}

function TransactionDetailModal({
  transaction,
  property,
  unit,
  units,
  tenancies,
  contacts,
  category,
  parentCategory,
  onAddDocument,
  onDelete,
  onClose,
}) {
  const [deleteArmed, setDeleteArmed] = useState(false);
  const categoryName = parentCategory
    ? parentCategory.name + ' › ' + category.name
    : category?.name || 'Ohne Kategorie';
  const isImage = transaction.receiptDataUrl?.startsWith('data:image');

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal receipt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <span className="section-kicker">
              {transaction.kind === 'income' ? 'Einnahme' : 'Ausgabe'}
            </span>
            <h2 id="receipt-title">Buchungsdetails</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Dialog schließen"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="receipt-modal__body">
          <div className={'receipt-amount receipt-amount--' + transaction.kind}>
            <span>{transaction.description}</span>
            <strong>
              {transaction.kind === 'expense' ? '− ' : '+ '}
              {moneyExact.format(transaction.amount)}
            </strong>
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
              <div className="receipt-preview__header"><div><span>Kostenverteilung</span><strong>{allocationLabel(transaction.allocationMode)}</strong></div><span className="receipt-status">Historischer Schnappschuss</span></div>
              {transaction.allocations?.length ? transaction.allocations.map((allocation) => {
                const allocationUnit = units.find((item) => item.id === allocation.unitId);
                const allocationTenancy = tenancies.find((item) => item.id === allocation.tenancyId);
                const primary = contacts.find((item) => item.id === allocationTenancy?.primaryContactId);
                return <div className="detail-allocation-row" key={`${allocation.unitId}-${allocation.tenancyId || 'vacant'}-${allocation.servicePeriodStart || 'snapshot'}`}><span><strong>{allocationUnit?.name || 'Unbekannte Einheit'}</strong><small>{primary?.name || 'Leerstand / kein Mietverhältnis'}{allocation.servicePeriodStart && allocation.servicePeriodEnd ? ` · ${formatDate(allocation.servicePeriodStart)}–${formatDate(allocation.servicePeriodEnd)}` : ''}</small></span><strong>{moneyExact.format(allocation.amount)}</strong></div>;
              }) : <p className="allocation-note">Manuelle oder externe Abrechnung – noch keine Anteile hinterlegt.</p>}
            </div>
          )}

          {transaction.receiptName ? (
            <div className="receipt-preview">
              <div className="receipt-preview__header">
                <div>
                  <span>Beleg</span>
                  <strong>{transaction.receiptName}</strong>
                </div>
                <span className="receipt-status">
                  {transaction.receiptDataUrl ? 'Lokal gespeichert' : 'Demo-Beleg'}
                </span>
              </div>
              {transaction.receiptDataUrl ? (
                isImage ? (
                  <img src={transaction.receiptDataUrl} alt="Belegvorschau" />
                ) : (
                  <iframe
                    src={transaction.receiptDataUrl}
                    title="Belegvorschau"
                  />
                )
              ) : (
                <div className="demo-invoice">
                  <div className="demo-invoice__brand">
                    <Icon name="file" size={25} />
                    <div>
                      <strong>RECHNUNG / BELEG</strong>
                      <span>Vorführansicht ohne Originaldatei</span>
                    </div>
                  </div>
                  <div className="demo-invoice__lines">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="demo-invoice__total">
                    <span>Gesamtbetrag</span>
                    <strong>{moneyExact.format(transaction.amount)}</strong>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="no-document">
              <Icon name="file" size={24} />
              <div>
                <strong>Kein Beleg hinterlegt</strong>
                <span>Die Buchungsdetails sind trotzdem vollständig einsehbar.</span>
              </div>
            </div>
          )}
        </div>

        <div className="modal__footer receipt-modal__footer">
          <p>Demo-Ansicht – keine revisionssichere Belegablage.</p>
          <div>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => deleteArmed ? onDelete() : setDeleteArmed(true)}
            >
              {deleteArmed ? 'Löschen bestätigen' : 'Buchung löschen'}
            </button>
            <button type="button" className="button button--ghost" onClick={onAddDocument}>Dokument anhängen</button>
            {transaction.receiptDataUrl && (
              <a
                className="button button--ghost"
                href={transaction.receiptDataUrl}
                target="_blank"
                rel="noreferrer"
              >
                Original öffnen
              </a>
            )}
            <button type="button" className="button button--primary" onClick={onClose}>
              Schließen
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function PropertyModal({ propertyCount, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: '',
    shortName: '',
    address: '',
    postalCode: '',
    city: '',
    country: 'Deutschland',
    objectType: 'Mehrfamilienhaus',
    type: 'Wohnen',
    units: 1,
    area: '',
    built: 2020,
    targetColdRent: '',
    targetUtilityAdvance: '',
    description: '',
  });

  const update = (field, value) => {
    setForm((current) => {
      if (field !== 'objectType') return { ...current, [field]: value };
      const singleUnit = ['Eigentumswohnung', 'Einfamilienhaus', 'Gewerbeeinheit'].includes(value);
      return {
        ...current,
        objectType: value,
        type: value === 'Gewerbeeinheit' ? 'Gewerbe' : value === 'Wohn- und Geschäftshaus' ? 'Gemischt' : 'Wohnen',
        units: singleUnit ? 1 : current.units,
      };
    });
  };

  const submit = (event) => {
    event.preventDefault();
    const units = Math.max(1, Number(form.units));
    onSubmit({
      ...form,
      units,
      unitCount: units,
      occupiedUnits: 0,
      area: Math.max(1, Number(form.area)),
      built: Number(form.built),
      targetColdRent: form.targetColdRent === '' ? null : Math.max(0, Number(form.targetColdRent)),
      targetUtilityAdvance: form.targetUtilityAdvance === '' ? null : Math.max(0, Number(form.targetUtilityAdvance)),
      description:
        form.description.trim() ||
        'Testobjekt für die lokale Vermieter-Kompass-Demo.',
    });
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal property-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <span className="section-kicker">Objekt {propertyCount + 1} von 10</span>
            <h2 id="property-title">Immobilie anlegen</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Dialog schließen"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        <form className="transaction-form property-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="form-span">
              <span>Objektname</span>
              <input
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="z. B. Wohnhaus Sonnenweg"
                required
              />
            </label>
            <label>
              <span>Kurzname</span>
              <input
                value={form.shortName}
                onChange={(event) => update('shortName', event.target.value)}
                placeholder="z. B. Sonnenweg"
              />
            </label>
            <label>
              <span>Objektart</span>
              <select value={form.objectType} onChange={(event) => update('objectType', event.target.value)}>
                <option value="Mehrfamilienhaus">Mehrfamilienhaus</option>
                <option value="Wohn- und Geschäftshaus">Wohn- und Geschäftshaus</option>
                <option value="Einfamilienhaus">Einfamilienhaus</option>
                <option value="Eigentumswohnung">Eigentumswohnung</option>
                <option value="Gewerbeeinheit">Gewerbeeinheit</option>
              </select>
            </label>
            <label>
              <span>Straße und Hausnummer</span>
              <input
                value={form.address}
                onChange={(event) => update('address', event.target.value)}
                placeholder="Sonnenweg 12"
                required
              />
            </label>
            <label>
              <span>Postleitzahl</span>
              <input
                value={form.postalCode}
                onChange={(event) => update('postalCode', event.target.value)}
                placeholder="45127"
                inputMode="numeric"
                pattern="[0-9]{5}"
                required
              />
            </label>
            <label>
              <span>Ort</span>
              <input
                value={form.city}
                onChange={(event) => update('city', event.target.value)}
                placeholder="Essen"
                required
              />
            </label>
            <label>
              <span>Land</span>
              <input value={form.country} onChange={(event) => update('country', event.target.value)} required />
            </label>
            <label>
              <span>Einheiten</span>
              <input
                type="number"
                min="1"
                max="50"
                value={form.units}
                onChange={(event) => update('units', event.target.value)}
                disabled={['Eigentumswohnung', 'Einfamilienhaus', 'Gewerbeeinheit'].includes(form.objectType)}
                required
              />
            </label>
            <label>
              <span>Gesamtfläche in m²</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={form.area}
                onChange={(event) => update('area', event.target.value)}
                required
              />
            </label>
            <label>
              <span>Baujahr</span>
              <input
                type="number"
                min="1800"
                max="2100"
                value={form.built}
                onChange={(event) => update('built', event.target.value)}
                required
              />
            </label>
            <label>
              <span>Plan-Kaltmiete der ersten Einheit</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.targetColdRent}
                onChange={(event) => update('targetColdRent', event.target.value)}
                placeholder="Nicht hinterlegt"
                disabled={Number(form.units) !== 1}
              />
            </label>
            <label>
              <span>Plan-Betriebskosten der ersten Einheit</span>
              <input type="number" min="0" step="0.01" value={form.targetUtilityAdvance} onChange={(event) => update('targetUtilityAdvance', event.target.value)} placeholder="Nicht hinterlegt" disabled={Number(form.units) !== 1} />
            </label>
            <p className="form-help form-span">
              {Number(form.units) === 1
                ? `Plan-Warmmiete: ${formWarmPlanLabel(form.targetColdRent, form.targetUtilityAdvance)}`
                : 'Bei mehreren Einheiten werden die Planwerte anschließend je Einheit gepflegt; ein alter Objektgesamtwert wird nicht verteilt.'}
            </p>
            <label className="form-span">
              <span>Notiz zum Objekt</span>
              <textarea
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder="Kurze Beschreibung, Mietsituation oder Besonderheiten"
                rows="3"
              />
            </label>
          </div>

          <div className="modal__footer">
            <p>Das Testobjekt wird ausschließlich lokal in diesem Browser gespeichert.</p>
            <div>
              <button type="button" className="button button--ghost" onClick={onClose}>
                Abbrechen
              </button>
              <button type="submit" className="button button--primary">
                Immobilie speichern
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function TransactionModal({
  properties,
  categories,
  units,
  tenancies,
  tenancyUnits,
  contacts,
  presetPropertyId,
  presetUnitId,
  onClose,
  onSubmit,
}) {
  const firstExpenseCategory = firstSelectableCategory(categories, 'expense') || categories[0];
  const [form, setForm] = useState({
    propertyId: presetPropertyId || properties[0].id,
    unitId: presetUnitId || '',
    date: new Date().toISOString().slice(0, 10),
    kind: 'expense',
    categoryId: firstExpenseCategory.id,
    description: '',
    amount: '',
    servicePeriodStart: '',
    servicePeriodEnd: '',
    allocatable: firstExpenseCategory.allocatableDefault === true,
    allocationMode: presetUnitId
      ? 'direct'
      : firstExpenseCategory.allocationModeDefault || 'area',
  });
  const [file, setFile] = useState(null);
  const [fileNote, setFileNote] = useState('');
  const [manualAmounts, setManualAmounts] = useState({});
  const [allocationError, setAllocationError] = useState('');

  const propertyUnits = units.filter((unit) => unit.propertyId === form.propertyId);
  const selectedCategory = categories.find((category) => category.id === form.categoryId);
  const hasServicePeriod = Boolean(form.servicePeriodStart && form.servicePeriodEnd);
  const allocations = form.kind === 'expense' && form.allocatable
    ? hasServicePeriod && form.allocationMode !== 'manual'
      ? calculateServicePeriodAllocations({
        amount: form.amount,
        propertyId: form.propertyId,
        unitId: form.unitId || null,
        mode: form.allocationMode,
        units,
        tenancies,
        tenancyUnits,
        servicePeriodStart: form.servicePeriodStart,
        servicePeriodEnd: form.servicePeriodEnd,
      })
      : calculateAllocations({
        amount: form.amount,
        propertyId: form.propertyId,
        unitId: form.unitId || null,
        mode: form.allocationMode,
        units,
        tenancies,
        date: form.date,
        manualAmounts,
      })
    : [];

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const changeKind = (value) => {
    const category = firstSelectableCategory(categories, value) || categories[0];
    setForm((current) => ({
      ...current,
      kind: value,
      categoryId: category.id,
      allocatable: value === 'expense' && category.allocatableDefault === true,
      allocationMode: current.unitId ? 'direct' : category.allocationModeDefault || 'area',
    }));
    setManualAmounts({});
    setAllocationError('');
  };

  const changeCategory = (categoryId) => {
    const category = categories.find((item) => item.id === categoryId);
    setForm((current) => ({
      ...current,
      categoryId,
      allocatable: current.kind === 'expense' && category?.allocatableDefault === true,
      allocationMode: current.unitId ? 'direct' : category?.allocationModeDefault || 'area',
    }));
    setManualAmounts({});
  };

  const changeProperty = (propertyId) => {
    setForm((current) => ({ ...current, propertyId, unitId: '', allocationMode: selectedCategory?.allocationModeDefault || 'area' }));
    setManualAmounts({});
  };

  const changeUnit = (unitId) => {
    setForm((current) => ({
      ...current,
      unitId,
      allocationMode: unitId ? 'direct' : selectedCategory?.allocationModeDefault || 'area',
    }));
    setManualAmounts({});
  };

  const submit = async (event) => {
    event.preventDefault();
    const servicePeriodStart = event.currentTarget.elements.servicePeriodStart?.value || '';
    const servicePeriodEnd = event.currentTarget.elements.servicePeriodEnd?.value || '';
    if (Boolean(servicePeriodStart) !== Boolean(servicePeriodEnd)) {
      setAllocationError('Bitte Beginn und Ende des Leistungszeitraums gemeinsam angeben.');
      return;
    }
    if (servicePeriodStart && servicePeriodEnd < servicePeriodStart) {
      setAllocationError('Das Ende des Leistungszeitraums darf nicht vor dem Beginn liegen.');
      return;
    }
    if (form.kind === 'expense' && form.allocatable && form.allocationMode === 'manual') {
      const distributed = allocations.reduce((total, allocation) => total + allocation.amount, 0);
      if (Math.abs(distributed - Number(form.amount)) > 0.01) {
        setAllocationError('Die manuellen Anteile müssen zusammen genau dem Buchungsbetrag entsprechen.');
        return;
      }
    }
    if (file && file.size > 250 * 1024) {
      setFileNote('Der Beleg ist größer als 250 KB. Bitte die Datei verkleinern.');
      return;
    }
    const submittedAllocations = form.kind === 'expense' && form.allocatable
      ? servicePeriodStart && servicePeriodEnd && form.allocationMode !== 'manual'
        ? calculateServicePeriodAllocations({
          amount: form.amount,
          propertyId: form.propertyId,
          unitId: form.unitId || null,
          mode: form.allocationMode,
          units,
          tenancies,
          tenancyUnits,
          servicePeriodStart,
          servicePeriodEnd,
        })
        : allocations
      : [];
    let receiptDataUrl;
    if (file) {
      receiptDataUrl = await readFile(file);
    }
    await onSubmit({
      ...form,
      id: 'tx-' + Date.now(),
      amount: Number(form.amount),
      servicePeriodStart: servicePeriodStart || null,
      servicePeriodEnd: servicePeriodEnd || null,
      unitId: form.unitId || null,
      tenancyId: form.unitId
        ? activeTenancyForUnit(tenancies, form.unitId, form.date)?.id || null
        : null,
      allocatable: form.kind === 'expense' ? form.allocatable : false,
      allocationMode: form.kind === 'expense' && form.allocatable ? form.allocationMode : null,
      allocations: submittedAllocations,
      receiptName: file?.name,
      receiptDataUrl,
    });
  };

  const selectFile = (event) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    if (!selected) {
      setFileNote('');
    } else if (selected.size > 250 * 1024) {
      setFileNote('Der Beleg ist größer als 250 KB. Bitte die Datei verkleinern.');
    } else {
      setFileNote('Die Datei wird lokal im Browser gespeichert.');
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <span className="section-kicker">Neue Bewegung</span>
            <h2 id="transaction-title">Buchung erfassen</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Dialog schließen" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <form className="transaction-form" onSubmit={submit}>
          <div className="kind-toggle">
            <button
              type="button"
              className={form.kind === 'income' ? 'active' : ''}
              onClick={() => changeKind('income')}
            >
              Einnahme
            </button>
            <button
              type="button"
              className={form.kind === 'expense' ? 'active' : ''}
              onClick={() => changeKind('expense')}
            >
              Ausgabe
            </button>
          </div>

          <div className="form-grid">
            <label>
              <span>Immobilie</span>
              <select
                value={form.propertyId}
                onChange={(event) => changeProperty(event.target.value)}
              >
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Geltungsbereich</span>
              <select value={form.unitId} onChange={(event) => changeUnit(event.target.value)}>
                <option value="">Gesamte Immobilie</option>
                {propertyUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · {unit.usageType}</option>)}
              </select>
            </label>
            <label>
              <span>Datum</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => update('date', event.target.value)}
                required
              />
            </label>
            <label>
              <span>Kategorie</span>
              <select
                value={form.categoryId}
                onChange={(event) => changeCategory(event.target.value)}
              >
                <CategorySelectOptions categories={categories} kind={form.kind} />
              </select>
            </label>
            <label>
              <span>Betrag in €</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => update('amount', event.target.value)}
                placeholder="0,00"
                required
              />
            </label>
            <label>
              <span>Leistungszeitraum von</span>
              <input name="servicePeriodStart" type="date" value={form.servicePeriodStart} onChange={(event) => update('servicePeriodStart', event.target.value)} />
            </label>
            <label>
              <span>Leistungszeitraum bis</span>
              <input name="servicePeriodEnd" type="date" value={form.servicePeriodEnd} onChange={(event) => update('servicePeriodEnd', event.target.value)} />
            </label>
            <p className="form-help form-span">Jahreskosten wie Wasser, Grundsteuer oder Gebäudeversicherung werden einmalig mit ihrem vollständigen Leistungszeitraum erfasst.</p>
            {form.kind === 'expense' && (
              <div className="allocation-box form-span">
                <div className="allocation-box__header">
                  <div>
                    <strong>Kostenart & Mieteranteile</strong>
                    <span>Demo-Vorschlag – Umlagefähigkeit immer mit Mietvertrag prüfen.</span>
                  </div>
                  <label className="switch-field">
                    <input
                      type="checkbox"
                      checked={form.allocatable}
                      onChange={(event) => update('allocatable', event.target.checked)}
                    />
                    <span>{form.allocatable ? 'Umlagefähig markiert' : 'Eigentümerkosten'}</span>
                  </label>
                </div>
                {form.allocatable ? (
                  <>
                    <label className="allocation-mode-select">
                      <span>Verteilerschlüssel</span>
                      <select
                        value={form.allocationMode}
                        onChange={(event) => {
                          update('allocationMode', event.target.value);
                          setManualAmounts({});
                        }}
                      >
                        <option value="area" disabled={Boolean(form.unitId)}>Nach Wohn-/Nutzfläche</option>
                        <option value="equal" disabled={Boolean(form.unitId)}>Gleichmäßig je Einheit</option>
                        <option value="direct" disabled={!form.unitId}>Direkt auf ausgewählte Einheit</option>
                        <option value="manual">Manuell / externe Abrechnung</option>
                      </select>
                    </label>
                    <div className="allocation-preview">
                      <div className="allocation-preview__heading"><span>Einheit / Mietverhältnis</span><span>Anteil</span></div>
                      {(form.unitId ? propertyUnits.filter((unit) => unit.id === form.unitId) : propertyUnits).map((unit) => {
                        const tenancy = activeTenancyForUnit(tenancies, unit.id, form.date, tenancyUnits);
                        const primary = contacts.find((contact) => contact.id === tenancy?.primaryContactId);
                        const unitAllocations = allocations.filter((row) => row.unitId === unit.id);
                        const allocationAmount = unitAllocations.reduce((total, row) => total + row.amount, 0);
                        return (
                          <div className="allocation-preview__row" key={unit.id}>
                            <span><strong>{unit.name}</strong><small>{hasServicePeriod && unitAllocations.length > 1 ? `${unitAllocations.length} zeitanteilige Mietabschnitte` : primary?.name || 'Leerstand / kein aktives Mietverhältnis'}</small></span>
                            {form.allocationMode === 'manual' ? (
                              <label className="manual-amount"><input type="number" min="0" step="0.01" value={manualAmounts[unit.id] || ''} onChange={(event) => setManualAmounts((current) => ({ ...current, [unit.id]: event.target.value }))} /><span>€</span></label>
                            ) : <strong>{moneyExact.format(allocationAmount)}</strong>}
                          </div>
                        );
                      })}
                    </div>
                    <p className="allocation-note">{hasServicePeriod ? 'Die Vorschau verteilt zeitanteilig nach Vertrags- beziehungsweise Einzugszeiträumen. Gespeichert wird der historische Schnappschuss.' : 'Gespeichert wird ein historischer Schnappschuss der Einheit und des am Buchungsdatum aktiven Mietverhältnisses.'}</p>
                    {allocationError && <p className="form-error">{allocationError}</p>}
                  </>
                ) : (
                  <p className="owner-cost-note">Diese Ausgabe bleibt vollständig beim Eigentümer und wird keinem Mietverhältnis zugeordnet.</p>
                )}
              </div>
            )}
            <label className="form-span">
              <span>Beschreibung</span>
              <input
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder="z. B. Heizungswartung Juli"
                required
              />
            </label>
            <label className="upload-field form-span">
              <input type="file" accept=".pdf,image/*" onChange={selectFile} />
              <Icon name="upload" size={24} />
              <span>
                <strong>{file ? file.name : 'Beleg auswählen'}</strong>
                <small>PDF oder Bild, bis 250 KB vollständig lokal</small>
              </span>
            </label>
            {fileNote && <p className="file-note form-span">{fileNote}</p>}
          </div>

          <div className="modal__footer">
            <p>Keine Cloud: Die Demo speichert ausschließlich in diesem Browser.</p>
            <div>
              <button type="button" className="button button--ghost" onClick={onClose}>
                Abbrechen
              </button>
              <button type="submit" className="button button--primary">
                Buchung speichern
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

export default App;
