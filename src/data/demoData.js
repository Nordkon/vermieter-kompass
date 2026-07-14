export const DEMO_YEAR = 2026;

const categorySeed = [
  { id: 'rent', name: 'Miete', kind: 'income', color: '#2f7d67', parentId: null },
  { id: 'rent-residential', name: 'Kaltmiete Wohnen', kind: 'income', color: '#2f7d67', parentId: 'rent' },
  { id: 'rent-commercial', name: 'Gewerbemiete', kind: 'income', color: '#2f7d67', parentId: 'rent' },
  { id: 'utility-income', name: 'Nebenkostenvorauszahlung', kind: 'income', color: '#55a28a', parentId: null },
  { id: 'operating-advance', name: 'Betriebskostenvorauszahlung', kind: 'income', color: '#55a28a', parentId: 'utility-income' },
  { id: 'heating-advance', name: 'Heizkostenvorauszahlung', kind: 'income', color: '#55a28a', parentId: 'utility-income' },
  { id: 'parking', name: 'Stellplatz / Garage', kind: 'income', color: '#88bca9', parentId: null },
  { id: 'garage-income', name: 'Garage', kind: 'income', color: '#88bca9', parentId: 'parking' },
  { id: 'parking-space-income', name: 'Stellplatz', kind: 'income', color: '#88bca9', parentId: 'parking' },
  { id: 'other-income', name: 'Sonstige Einnahme', kind: 'income', color: '#b3d2c6', parentId: null },

  { id: 'maintenance', name: 'Instandhaltung', kind: 'expense', color: '#c36b4c', parentId: null },
  { id: 'heating-sanitary', name: 'Heizung & Sanitär', kind: 'expense', color: '#c36b4c', parentId: 'maintenance' },
  { id: 'roof-facade', name: 'Dach & Fassade', kind: 'expense', color: '#c36b4c', parentId: 'maintenance' },
  { id: 'electrical', name: 'Elektro', kind: 'expense', color: '#c36b4c', parentId: 'maintenance' },
  { id: 'garden-outdoor', name: 'Garten & Außenanlagen', kind: 'expense', color: '#c36b4c', parentId: 'maintenance' },
  { id: 'minor-repairs', name: 'Kleinreparaturen', kind: 'expense', color: '#c36b4c', parentId: 'maintenance' },

  { id: 'utilities', name: 'Betriebskosten', kind: 'expense', color: '#d68b5d', parentId: null },
  { id: 'water-sewage', name: 'Wasser & Abwasser', kind: 'expense', color: '#d68b5d', parentId: 'utilities' },
  { id: 'waste-disposal', name: 'Müllabfuhr', kind: 'expense', color: '#d68b5d', parentId: 'utilities' },
  { id: 'common-electricity', name: 'Allgemeinstrom', kind: 'expense', color: '#d68b5d', parentId: 'utilities' },
  { id: 'heating-fuel', name: 'Heizung & Brennstoff', kind: 'expense', color: '#d68b5d', parentId: 'utilities' },
  { id: 'street-winter', name: 'Straßenreinigung & Winterdienst', kind: 'expense', color: '#d68b5d', parentId: 'utilities' },

  { id: 'insurance', name: 'Versicherungen', kind: 'expense', color: '#bd8b53', parentId: null },
  { id: 'building-insurance', name: 'Gebäudeversicherung', kind: 'expense', color: '#bd8b53', parentId: 'insurance' },
  { id: 'owner-liability', name: 'Haus- & Grundbesitzerhaftpflicht', kind: 'expense', color: '#bd8b53', parentId: 'insurance' },
  { id: 'elementary-insurance', name: 'Elementarschadenversicherung', kind: 'expense', color: '#bd8b53', parentId: 'insurance' },
  { id: 'legal-protection', name: 'Vermieterrechtsschutz', kind: 'expense', color: '#bd8b53', parentId: 'insurance' },

  { id: 'tax', name: 'Steuern & Abgaben', kind: 'expense', color: '#9e7450', parentId: null },
  { id: 'property-tax', name: 'Grundsteuer', kind: 'expense', color: '#9e7450', parentId: 'tax' },
  { id: 'municipal-fees', name: 'Kommunale Gebühren', kind: 'expense', color: '#9e7450', parentId: 'tax' },

  { id: 'loan', name: 'Finanzierung', kind: 'expense', color: '#756a60', parentId: null },
  { id: 'interest', name: 'Zinsen', kind: 'expense', color: '#756a60', parentId: 'loan' },
  { id: 'repayment', name: 'Tilgung', kind: 'expense', color: '#756a60', parentId: 'loan' },
  { id: 'bank-fees', name: 'Bankgebühren', kind: 'expense', color: '#756a60', parentId: 'loan' },

  { id: 'administration', name: 'Verwaltung', kind: 'expense', color: '#8d8075', parentId: null },
  { id: 'property-management', name: 'Hausverwaltung', kind: 'expense', color: '#8d8075', parentId: 'administration' },
  { id: 'tax-advice', name: 'Steuerberatung', kind: 'expense', color: '#8d8075', parentId: 'administration' },
  { id: 'account-fees', name: 'Kontoführung', kind: 'expense', color: '#8d8075', parentId: 'administration' },

  { id: 'modernization', name: 'Modernisierung', kind: 'expense', color: '#a85d51', parentId: null },
  { id: 'energy-renovation', name: 'Energetische Sanierung', kind: 'expense', color: '#a85d51', parentId: 'modernization' },
  { id: 'interior-work', name: 'Innenausbau', kind: 'expense', color: '#a85d51', parentId: 'modernization' },
  { id: 'accessibility', name: 'Barrierefreiheit', kind: 'expense', color: '#a85d51', parentId: 'modernization' },
  { id: 'other-expense', name: 'Sonstige Ausgabe', kind: 'expense', color: '#c7a38c', parentId: null },
];

const allocatableCategoryIds = new Set([
  'utilities',
  'water-sewage',
  'waste-disposal',
  'common-electricity',
  'heating-fuel',
  'street-winter',
  'insurance',
  'building-insurance',
  'owner-liability',
  'elementary-insurance',
  'tax',
  'property-tax',
  'municipal-fees',
]);

export const demoCategories = categorySeed.map((category) => ({
  ...category,
  allocatableDefault: allocatableCategoryIds.has(category.id),
  allocationModeDefault: category.id === 'heating-fuel' ? 'manual' : 'area',
}));

// Dieser kleine Bestand ist absichtlich nachvollziehbar und wird nur auf ausdrücklichen
// Wunsch über „Geprüften Musterbestand laden“ aktiviert. Der normale Start bleibt leer.
export const demoProperties = [{
  id: 'abendstern',
  name: 'Haus Abendstern',
  shortName: 'Abendstern',
  address: 'Sternweg 12',
  postalCode: '45127',
  city: 'Essen',
  country: 'Deutschland',
  type: 'Wohnen',
  objectType: 'Einfamilienhaus',
  buildingType: 'singleFamily',
  units: 1,
  area: 120,
  built: 1998,
  accent: '#2f7d67',
  initials: 'HA',
  description: 'Terra-End-to-End-Prüfung',
  legacyTargetColdRentTotal: null,
  legacyTargetColdRentSource: null,
}];

export const demoUnits = [{
  id: 'unit-abendstern-total',
  propertyId: 'abendstern',
  name: 'Gesamtobjekt',
  usageType: 'Wohnen',
  floor: 'Gesamtobjekt',
  area: 120,
  unitKind: 'primary',
  ancillaryType: null,
  parentUnitId: null,
  targetColdRent: 750,
  targetUtilityAdvance: 180,
}];

export const demoContacts = [
  {
    id: 'contact-anna-berger',
    kind: 'person',
    firstName: 'Anna',
    lastName: 'Berger',
    birthDate: '1988-05-12',
    companyName: '',
    address: { street: 'Sternweg 12', postalCode: '45127', city: 'Essen', country: 'Deutschland' },
    communication: {
      email: 'anna.berger@example.test',
      phone: '0201 5550101',
      mobile: '0170 5550101',
    },
    notes: 'Hauptansprechpartnerin, bevorzugt E-Mail',
    name: 'Anna Berger',
    email: 'anna.berger@example.test',
    phone: '0201 5550101',
  },
  {
    id: 'contact-ben-berger',
    kind: 'person',
    firstName: 'Ben',
    lastName: 'Berger',
    birthDate: '',
    companyName: '',
    address: { street: 'Parkallee 8', postalCode: '45128', city: 'Essen', country: 'Deutschland' },
    communication: { email: 'ben.berger@example.test', phone: '0201 5550102', mobile: '' },
    notes: '',
    name: 'Ben Berger',
    email: 'ben.berger@example.test',
    phone: '0201 5550102',
  },
];

export const demoTenancies = [{
  id: 'tenancy-abendstern',
  unitId: 'unit-abendstern-total',
  contactIds: ['contact-anna-berger', 'contact-ben-berger'],
  primaryContactId: 'contact-anna-berger',
  contractStart: '2026-07-14',
  contractEnd: '',
  moveInDate: '2026-07-14',
  moveOutDate: '',
  startDate: '2026-07-14',
  endDate: '',
  coldRent: 775,
  utilityAdvance: 190,
  depositAgreed: 2325,
  deposit: 2325,
  status: 'active',
}];

export const demoTenancyParties = [
  {
    id: 'tenancy-party-abendstern-anna',
    tenancyId: 'tenancy-abendstern',
    contactId: 'contact-anna-berger',
    relationshipType: 'tenant',
    isPrimaryContact: true,
    sortOrder: 0,
  },
  {
    id: 'tenancy-party-abendstern-ben',
    tenancyId: 'tenancy-abendstern',
    contactId: 'contact-ben-berger',
    relationshipType: 'tenant',
    isPrimaryContact: false,
    sortOrder: 1,
  },
];

export const demoTenancyUnits = [{
  id: 'tenancy-unit-abendstern-0',
  tenancyId: 'tenancy-abendstern',
  unitId: 'unit-abendstern-total',
  role: 'primary',
  sortOrder: 0,
}];

export const demoRecurringRules = [
  {
    id: 'rule-abendstern-cold-rent',
    tenancyId: 'tenancy-abendstern',
    frequency: 'monthly',
    interval: 1,
    dueDay: 3,
    amount: 775,
    component: 'coldRent',
    description: 'Kaltmiete',
    startDate: '2026-08-03',
    endDate: '',
    status: 'active',
    source: 'verified-sample',
    occurrenceKeyTemplate: '{ruleId}:{dueDate}',
  },
  {
    id: 'rule-abendstern-utility-advance',
    tenancyId: 'tenancy-abendstern',
    frequency: 'monthly',
    interval: 1,
    dueDay: 3,
    amount: 190,
    component: 'utilityAdvance',
    description: 'Betriebskostenvorauszahlung',
    startDate: '2026-08-03',
    endDate: '',
    status: 'active',
    source: 'verified-sample',
    occurrenceKeyTemplate: '{ruleId}:{dueDate}',
  },
];

const pad = (value) => String(value).padStart(2, '0');
const monthlyDates = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 7 + index, 3));
  return date.toISOString().slice(0, 10);
});

const chargeEntries = monthlyDates.flatMap((dueDate) => {
  const next = new Date(`${dueDate.slice(0, 7)}-01T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(0);
  const servicePeriodStart = `${dueDate.slice(0, 7)}-01`;
  const servicePeriodEnd = next.toISOString().slice(0, 10);
  return demoRecurringRules.map((rule) => ({
    id: `account-${rule.id}-${dueDate}`,
    tenancyId: rule.tenancyId,
    entryType: 'charge',
    side: 'debit',
    amount: rule.amount,
    dueDate,
    bookingDate: dueDate,
    servicePeriodStart,
    servicePeriodEnd,
    description: rule.description,
    component: rule.component,
    sourceType: 'recurringRule',
    sourceId: rule.id,
    occurrenceKey: `${rule.id}:${dueDate}`,
  }));
});

const regularPaymentDates = monthlyDates.slice(0, 11).map((date) => `${date.slice(0, 8)}05`);
const paymentSpecs = [
  ...regularPaymentDates.map((date, index) => ({ id: `payment-${pad(index + 1)}`, date, amount: 965, description: `Mietzahlung ${date.slice(0, 7)}` })),
  { id: 'payment-12-part', date: '2027-07-05', amount: 900, description: 'Teilzahlung 07/2027' },
  { id: 'payment-12-rest', date: '2027-07-10', amount: 65, description: 'Restzahlung 07/2027' },
];

const paymentAccountEntries = paymentSpecs.map((payment) => ({
  id: `account-${payment.id}`,
  tenancyId: 'tenancy-abendstern',
  entryType: 'payment',
  component: 'payment',
  side: 'credit',
  amount: payment.amount,
  bookingDate: payment.date,
  dueDate: payment.date,
  description: payment.description,
  sourceType: 'tenantPayment',
  sourceId: `transaction-${payment.id}`,
  transactionId: `transaction-${payment.id}`,
  occurrenceKey: `tenant-payment:${payment.id}`,
}));

export const demoAccountEntries = [
  ...chargeEntries,
  ...paymentAccountEntries,
  {
    id: 'account-settlement-tenancy-abendstern-2026-08-01-2027-07-31',
    tenancyId: 'tenancy-abendstern',
    entryType: 'settlement',
    component: 'utilitySettlement',
    side: 'debit',
    amount: 120,
    bookingDate: '2027-08-15',
    dueDate: '2027-08-15',
    servicePeriodStart: '2026-08-01',
    servicePeriodEnd: '2027-07-31',
    description: 'Betriebskostenabrechnung · Nachforderung',
    sourceType: 'annualSettlement',
    sourceId: 'settlement:tenancy-abendstern:2026-08-01:2027-07-31',
    occurrenceKey: 'settlement:tenancy-abendstern:2026-08-01:2027-07-31',
  },
];

const costSpecs = [
  { id: 'cost-property-tax', date: '2026-09-15', categoryId: 'property-tax', description: 'Grundsteuer 2026/2027', amount: 720, receiptName: 'grundsteuer_2026_2027.pdf', receiptDataUrl: './sample-receipts/grundsteuer_2026_2027.pdf' },
  { id: 'cost-building-insurance', date: '2026-10-01', categoryId: 'building-insurance', description: 'Gebäudeversicherung 2026/2027', amount: 480, receiptName: 'gebaeudeversicherung_2026_2027.pdf', receiptDataUrl: './sample-receipts/gebaeudeversicherung_2026_2027.pdf' },
  { id: 'cost-water', date: '2027-02-20', categoryId: 'water-sewage', description: 'Wasser & Abwasser 2026/2027', amount: 960, receiptName: 'wasser_abwasser_2026_2027.pdf', receiptDataUrl: './sample-receipts/wasser_abwasser_2026_2027.pdf' },
  { id: 'cost-heating-maintenance', date: '2027-05-08', categoryId: 'heating-sanitary', description: 'Heizungswartung', amount: 240, receiptName: 'heizungswartung_2027.pdf', receiptDataUrl: './sample-receipts/heizungswartung_2027.pdf' },
];

const costTransactions = costSpecs.map((cost) => ({
  ...cost,
  propertyId: 'abendstern',
  kind: 'expense',
  unitId: 'unit-abendstern-total',
  tenancyId: 'tenancy-abendstern',
  allocatable: true,
  allocationMode: 'direct',
  servicePeriodStart: '2026-08-01',
  servicePeriodEnd: '2027-07-31',
  allocations: [{
    unitId: 'unit-abendstern-total',
    tenancyId: 'tenancy-abendstern',
    amount: cost.amount,
    servicePeriodStart: '2026-08-01',
    servicePeriodEnd: '2027-07-31',
  }],
}));

const repairTransaction = {
  id: 'cost-wc-repair',
  propertyId: 'abendstern',
  unitId: 'unit-abendstern-total',
  tenancyId: null,
  date: '2027-04-11',
  kind: 'expense',
  categoryId: 'minor-repairs',
  description: 'WC verstopft · Rohrreinigung',
  amount: 165,
  receiptName: 'rohrreinigung_wc_2027.pdf',
  receiptDataUrl: './sample-receipts/rohrreinigung_wc_2027.pdf',
  allocatable: false,
  allocationMode: 'direct',
  servicePeriodStart: '2027-04-11',
  servicePeriodEnd: '2027-04-11',
  allocations: [],
};

const paymentTransactions = paymentSpecs.map((payment) => ({
  id: `transaction-${payment.id}`,
  propertyId: 'abendstern',
  unitId: 'unit-abendstern-total',
  tenancyId: 'tenancy-abendstern',
  date: payment.date,
  kind: 'income',
  categoryId: 'rent',
  description: payment.description,
  amount: payment.amount,
  sourceType: 'tenantPayment',
  sourceId: `account-${payment.id}`,
  accountEntryId: `account-${payment.id}`,
  occurrenceKey: `tenant-payment:${payment.id}`,
  servicePeriodStart: null,
  servicePeriodEnd: null,
  allocations: [],
}));

export const demoTransactions = [
  ...paymentTransactions,
  ...costTransactions,
  repairTransaction,
].sort((left, right) => right.date.localeCompare(left.date));

export const demoDocuments = [...costTransactions, repairTransaction].map((transaction) => ({
  id: `doc-receipt-${transaction.id}`,
  ownerType: 'transaction',
  ownerId: transaction.id,
  propertyId: transaction.propertyId,
  documentType: 'Rechnung / Beleg',
  name: transaction.receiptName,
  date: transaction.date,
  note: `Beleg zur Buchung „${transaction.description}“.`,
  dataUrl: transaction.receiptDataUrl,
}));

export const demoTasks = [];
