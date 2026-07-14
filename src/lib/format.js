export const money = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export const moneyExact = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export const number = new Intl.NumberFormat('de-DE');

export function formatDate(value) {
  return new Intl.DateTimeFormat('de-DE').format(new Date(value + 'T12:00:00'));
}

export function shortMonth(index) {
  return new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(
    new Date(2026, index, 1),
  );
}

