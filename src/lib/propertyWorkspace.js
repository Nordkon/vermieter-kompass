const asArray = (value) => (Array.isArray(value) ? value : []);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const PROPERTY_TABS = new Set(['overview', 'records', 'finances']);
const KIND_FILTERS = new Set(['all', 'income', 'expense']);
const ALLOCATION_FILTERS = new Set(['all', 'allocatable', 'owner']);

const matchesUnit = (transaction, unitId) => (
  transaction.unitId === unitId
  || asArray(transaction.allocations).some((allocation) => allocation.unitId === unitId)
);

const matchesTenancy = (transaction, tenancyId) => (
  transaction.tenancyId === tenancyId
  || asArray(transaction.allocations).some((allocation) => allocation.tenancyId === tenancyId)
);

export function movementMatchesPropertyContext(transaction, context = {}) {
  if (!transaction || !context.id) return false;
  if (context.type === 'property') return transaction.propertyId === context.id;
  if (context.type === 'unit') return matchesUnit(transaction, context.id);
  if (context.type === 'tenancy') return matchesTenancy(transaction, context.id);
  if (context.type === 'contact') {
    const tenancyIds = [...new Set([context.tenancyId, ...asArray(context.tenancyIds)].filter(Boolean))];
    return tenancyIds.some((tenancyId) => matchesTenancy(transaction, tenancyId));
  }
  return false;
}

/**
 * Liefert höchstens fünf Kontextbewegungen, ohne die Eingabe zu verändern.
 * Gleich datierte Buchungen werden über ihre ID stabil sortiert.
 */
export function topPropertyContextMovements(transactions, context, limit = 5) {
  const safeLimit = Math.max(0, Math.min(5, Number.isFinite(Number(limit)) ? Number(limit) : 5));
  return asArray(transactions)
    .filter((transaction) => movementMatchesPropertyContext(transaction, context))
    .sort((left, right) => {
      const dateOrder = String(right.date || right.bookingDate || '')
        .localeCompare(String(left.date || left.bookingDate || ''));
      return dateOrder || String(left.id || '').localeCompare(String(right.id || ''));
    })
    .slice(0, safeLimit);
}

const tenancyUnitIds = (tenancy, tenancyUnits) => {
  const related = asArray(tenancyUnits)
    .filter((relation) => relation.tenancyId === tenancy?.id)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((relation) => relation.unitId);
  return related.length ? related : [tenancy?.unitId].filter(Boolean);
};

/**
 * Übersetzt den Objektakten-Kontext direkt in die kontrollierten Filterwerte
 * der Finanzseite.
 */
export function propertyContextToFinanceFilters(context = {}, {
  propertyId = '',
  units = [],
  tenancies = [],
  tenancyUnits = [],
} = {}) {
  const fallback = {
    propertyFilter: propertyId || 'all',
    unitFilter: 'all',
    tenancyFilter: 'all',
  };

  if (context.type === 'property') {
    return { ...fallback, propertyFilter: context.id || fallback.propertyFilter };
  }

  if (context.type === 'unit') {
    const unit = asArray(units).find((item) => item.id === context.id);
    return {
      ...fallback,
      propertyFilter: unit?.propertyId || context.propertyId || fallback.propertyFilter,
      unitFilter: context.id || 'all',
    };
  }

  const tenancyId = context.type === 'tenancy' ? context.id : context.tenancyId;
  if ((context.type === 'tenancy' || context.type === 'contact') && tenancyId) {
    const tenancy = asArray(tenancies).find((item) => item.id === tenancyId);
    const firstUnitId = tenancyUnitIds(tenancy, tenancyUnits)[0];
    const unit = asArray(units).find((item) => item.id === firstUnitId);
    return {
      ...fallback,
      propertyFilter: unit?.propertyId || context.propertyId || fallback.propertyFilter,
      tenancyFilter: tenancyId,
    };
  }

  return fallback;
}

/**
 * Normalisiert den rein sitzungsbezogenen UI-Zustand einer Objektakte.
 * Der Rückgabewert wird bewusst nicht in LocalStorage gespeichert.
 */
export function normalizePropertySessionState(session = {}, {
  propertyId = '',
  years = [],
  units = [],
  tenancies = [],
  categories = [],
  fallbackYear = new Date().getFullYear(),
} = {}) {
  const safeYears = asArray(years).map(Number).filter(Number.isFinite);
  const unitIds = new Set(asArray(units).map((unit) => unit.id));
  const tenancyIds = new Set(asArray(tenancies).map((tenancy) => tenancy.id));
  const categoryIds = new Set(asArray(categories).map((category) => category.id));
  const selectedYear = Number(session.selectedYear);
  const context = session.selectedContext || {};
  const contextValid = context.type === 'property'
    ? context.id === propertyId
    : context.type === 'unit'
      ? unitIds.has(context.id)
      : context.type === 'tenancy'
        ? tenancyIds.has(context.id)
        : context.type === 'contact'
          ? Boolean(context.id) && tenancyIds.has(context.tenancyId)
          : false;

  return {
    activePropertyTab: PROPERTY_TABS.has(session.activePropertyTab) ? session.activePropertyTab : 'overview',
    selectedYear: safeYears.includes(selectedYear) ? selectedYear : safeYears[0] || fallbackYear,
    kindFilter: KIND_FILTERS.has(session.kindFilter) ? session.kindFilter : 'all',
    categoryFilter: session.categoryFilter === 'all' || categoryIds.has(session.categoryFilter)
      ? session.categoryFilter
      : 'all',
    unitFilter: session.unitFilter === 'all' || unitIds.has(session.unitFilter)
      ? session.unitFilter
      : 'all',
    tenancyFilter: session.tenancyFilter === 'all' || tenancyIds.has(session.tenancyFilter)
      ? session.tenancyFilter
      : 'all',
    allocationFilter: ALLOCATION_FILTERS.has(session.allocationFilter) ? session.allocationFilter : 'all',
    transactionSearch: typeof session.transactionSearch === 'string' ? session.transactionSearch : '',
    selectedContext: contextValid ? context : { type: 'property', id: propertyId },
    treeOpen: session.treeOpen !== false,
    expandedUnitIds: (hasOwn(session, 'expandedUnitIds') ? asArray(session.expandedUnitIds) : [...unitIds])
      .filter((unitId) => unitIds.has(unitId)),
  };
}
