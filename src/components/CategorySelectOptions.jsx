export function CategorySelectOptions({ categories, kind }) {
  const parents = categories.filter(
    (category) => category.kind === kind && !category.parentId,
  );

  return parents.map((parent) => {
    const children = categories.filter((category) => category.parentId === parent.id);
    if (!children.length) {
      return <option key={parent.id} value={parent.id}>{parent.name}</option>;
    }

    return (
      <optgroup key={parent.id} label={parent.name}>
        {children.map((child) => (
          <option key={child.id} value={child.id}>{child.name}</option>
        ))}
      </optgroup>
    );
  });
}
