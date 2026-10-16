/** "1 student", "3 students". English-only until i18n (next-intl) lands. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
