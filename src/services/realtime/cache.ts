import type { QueryClient, QueryKey } from '@tanstack/react-query';

export function appendToList<T extends { id: string }>(
  qc: QueryClient,
  key: QueryKey,
  row: T,
): void {
  qc.setQueryData<T[]>(key, (prev) => {
    if (!prev) return [row];
    if (prev.some((r) => r.id === row.id)) return prev; // dedup
    return [...prev, row];
  });
}

export function updateInList<T extends { id: string }>(
  qc: QueryClient,
  key: QueryKey,
  row: T,
): void {
  qc.setQueryData<T[]>(key, (prev) => {
    if (!prev) return prev;
    return prev.map((r) => (r.id === row.id ? { ...r, ...row } : r));
  });
}

export function removeFromList(
  qc: QueryClient,
  key: QueryKey,
  rowId: string,
): void {
  qc.setQueryData<{ id: string }[]>(key, (prev) => {
    if (!prev) return prev;
    return prev.filter((r) => r.id !== rowId);
  });
}
