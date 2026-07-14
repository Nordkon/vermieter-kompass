import { buildCategoryFilterRows } from '../lib/categoryFilter.js';

const GROUPS = Object.freeze([
  { kind: 'income', label: 'Einnahmen' },
  { kind: 'expense', label: 'Ausgaben' },
]);

export function CategoryFilterOptions({ categories = [] }) {
  return GROUPS.map(({ kind, label }) => {
    const rows = buildCategoryFilterRows(categories, kind);

    return (
      <optgroup key={kind} label={label}>
        {rows.map((category) => (
          <option key={category.id} value={category.id}>
            {category.depth > 0 ? `${'\u00a0\u00a0'.repeat(category.depth)}↳ ` : ''}
            {category.name}
          </option>
        ))}
      </optgroup>
    );
  });
}
