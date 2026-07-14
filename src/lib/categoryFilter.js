const asArray = (value) => (Array.isArray(value) ? value : []);

const uniqueCategories = (categories) => {
  const seen = new Set();
  return asArray(categories).filter((category) => {
    if (!category?.id || seen.has(category.id)) return false;
    seen.add(category.id);
    return true;
  });
};

export function categoryPathNames(categoryId, categories) {
  const categoriesById = new Map(uniqueCategories(categories).map((category) => [category.id, category]));
  const visited = new Set();
  const names = [];
  let currentId = categoryId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const category = categoriesById.get(currentId);
    if (!category) break;
    names.unshift(category.name || category.id);
    currentId = category.parentId || null;
  }

  return names;
}

/**
 * Erstellt flache Select-Zeilen in stabiler Eingabereihenfolge. Verwaiste
 * Kategorien werden als Wurzeln behandelt; reine Zyklen folgen anschließend
 * als Fallback. Jede ID wird höchstens einmal ausgegeben.
 */
export function buildCategoryFilterRows(categories, kind) {
  const group = uniqueCategories(categories).filter((category) => category.kind === kind);
  const groupIds = new Set(group.map((category) => category.id));
  const childrenByParent = new Map();

  group.forEach((category) => {
    const parentId = groupIds.has(category.parentId) ? category.parentId : null;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(category);
  });

  const visited = new Set();
  const rows = [];
  const appendBranch = (category, depth) => {
    if (visited.has(category.id)) return;
    visited.add(category.id);
    rows.push({ id: category.id, name: category.name || category.id, depth });
    (childrenByParent.get(category.id) || []).forEach((child) => appendBranch(child, depth + 1));
  };

  (childrenByParent.get(null) || []).forEach((category) => appendBranch(category, 0));
  group.forEach((category) => appendBranch(category, 0));

  return rows;
}

/**
 * Eine Hauptkategorie schließt ihre direkten und beliebig tiefen
 * Unterkategorien ein. Eine konkrete Unterkategorie trifft nur sich selbst
 * und ihre eigenen Nachfahren.
 */
export function categoryMatchesFilter(categoryId, selectedId, categories) {
  if (!selectedId || selectedId === 'all') return true;
  if (!categoryId) return false;

  const categoriesById = new Map(uniqueCategories(categories).map((category) => [category.id, category]));
  const visited = new Set();
  let currentId = categoryId;

  while (currentId && !visited.has(currentId)) {
    if (currentId === selectedId) return true;
    visited.add(currentId);
    currentId = categoriesById.get(currentId)?.parentId || null;
  }

  return false;
}
