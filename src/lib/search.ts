/**
 * A generic fuzzy filtering and sorting utility that prioritizes prefix matches.
 */
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

      // Standard subsequence fuzzy match
      let termIdx = 0;
      for (let char of value) {
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

      // 1. Exact match (case insensitive)
      if (aValue === originalTerm && bValue !== originalTerm) return -1;
      if (bValue === originalTerm && aValue !== originalTerm) return 1;

      // 2. Prefix match
      const aStarts = aValue.startsWith(originalTerm);
      const bStarts = bValue.startsWith(originalTerm);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      // 3. Contiguous substring match
      const aIncludes = aValue.includes(originalTerm);
      const bIncludes = bValue.includes(originalTerm);
      if (aIncludes && !bIncludes) return -1;
      if (bIncludes && !aIncludes) return 1;

      // 4. Length (shorter items first)
      if (aValue.length !== bValue.length) {
        return aValue.length - bValue.length;
      }

      return aValue.localeCompare(bValue);
    });
}
