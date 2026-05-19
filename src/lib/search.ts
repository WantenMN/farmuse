export function fuzzyFilter<T>(
  items: T[],
  searchTerm: string,
  keySelector: (item: T) => string
): T[] {
  const term = searchTerm.toLowerCase().replace(/\s+/g, "");
  if (!term) return items;

  return items
    .filter((item) => {
      const value = keySelector(item).toLowerCase();

      let termIdx = 0;
      for (const char of value) {
        if (char === term[termIdx]) {
          termIdx++;
        }
        if (termIdx === term.length) return true;
      }
      return false;
    })
    .sort((a, b) => {
      const aValue = keySelector(a).toLowerCase();
      const bValue = keySelector(b).toLowerCase();
      const originalTerm = searchTerm.toLowerCase().trim();

      if (aValue === originalTerm && bValue !== originalTerm) return -1;
      if (bValue === originalTerm && aValue !== originalTerm) return 1;

      const aStarts = aValue.startsWith(originalTerm);
      const bStarts = bValue.startsWith(originalTerm);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      const aIncludes = aValue.includes(originalTerm);
      const bIncludes = bValue.includes(originalTerm);
      if (aIncludes && !bIncludes) return -1;
      if (bIncludes && !aIncludes) return 1;

      if (aValue.length !== bValue.length) {
        return aValue.length - bValue.length;
      }

      return aValue.localeCompare(bValue);
    });
}
