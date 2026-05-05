/**
 * A generic fuzzy filtering and sorting utility that prioritizes prefix matches.
 */
export function fuzzyFilter<T>(
  items: T[],
  searchTerm: string,
  keySelector: (item: T) => string
): T[] {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return items;

  return items
    .filter((item) => {
      const value = keySelector(item).toLowerCase();
      return value.includes(term);
    })
    .sort((a, b) => {
      const aValue = keySelector(a).toLowerCase();
      const bValue = keySelector(b).toLowerCase();

      const aStarts = aValue.startsWith(term);
      const bStarts = bValue.startsWith(term);

      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Secondary sort by length (shorter matches first)
      if (aValue.length !== bValue.length) {
        return aValue.length - bValue.length;
      }

      return aValue.localeCompare(bValue);
    });
}
