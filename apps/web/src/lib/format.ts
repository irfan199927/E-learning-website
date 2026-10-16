/** "1 student", "3 students". English-only until i18n (next-intl) lands. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "2.4 MB", "830 KB". */
export function fileSize(bytes: number): string {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "12 min", "1 h 5 min"; null when unknown. */
export function minutes(seconds: number | null): string | null {
  if (!seconds) return null;
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.max(1, m)} min`;
}
