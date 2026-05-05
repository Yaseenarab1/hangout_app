import { useEffect, useState } from 'react';

/**
 * Returns a debounced version of `value` that only updates after `delayMs`
 * of stability. Useful for search inputs to avoid hammering the server on
 * every keystroke.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
