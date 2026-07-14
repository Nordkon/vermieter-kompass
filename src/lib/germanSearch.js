const asSearchValues = (values) => {
  if (Array.isArray(values)) return values.flatMap(asSearchValues);
  return [values];
};

export function normalizeGermanSearch(value) {
  return String(value ?? '')
    .toLocaleLowerCase('de-DE')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function searchTokenVariants(token) {
  const variants = new Set([token]);

  // Deutsche Mietbegriffe treten sowohl als Substantiv ("Miete") als auch
  // als Wortstamm in Zusammensetzungen ("Mietzahlung") auf.
  if (token.length >= 5 && token.endsWith('e')) variants.add(token.slice(0, -1));

  return [...variants];
}

/**
 * Prüft eine Suchanfrage gegen ein oder mehrere Felder. Arrays dürfen beliebig
 * verschachtelt sein, damit z. B. Beschreibung, Kategorie und Kategoriepfad
 * gemeinsam durchsucht werden können.
 */
export function matchesGermanSearch(query, values) {
  const normalizedQuery = normalizeGermanSearch(query);
  if (!normalizedQuery) return true;

  const haystack = normalizeGermanSearch(asSearchValues(values).join(' '));
  if (!haystack) return false;

  return normalizedQuery
    .split(' ')
    .every((token) => searchTokenVariants(token).some((variant) => haystack.includes(variant)));
}
