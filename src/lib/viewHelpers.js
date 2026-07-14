import { isTenancyActive } from './rentalModel.js';

export function sum(transactions, kind) {
  return transactions
    .filter((transaction) => transaction.kind === kind)
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
}

export function getYear(date) {
  return Number(date.slice(0, 4));
}

export function getMonth(date) {
  return Number(date.slice(5, 7)) - 1;
}

export function contextLabel(type) {
  return {
    property: 'Immobilie',
    unit: 'Einheit',
    tenancy: 'Mietverhältnis',
    contact: 'Mietpartei',
    transaction: 'Buchung',
  }[type] || type;
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function tenancyStateLabel(tenancy) {
  const today = new Date().toISOString().slice(0, 10);
  const contractStart = tenancy.contractStart || tenancy.startDate;
  if (contractStart > today) return 'Geplantes Mietverhältnis';
  return isTenancyActive(tenancy, today)
    ? 'Aktives Mietverhältnis'
    : 'Früheres Mietverhältnis';
}

export function firstSelectableCategory(categories, kind) {
  return (
    categories.find((category) => category.kind === kind && category.parentId) ||
    categories.find((category) => category.kind === kind)
  );
}
