/**
 * Open-redirect guard: is this a path on our own site? Browser-safe (the sign-in form uses it).
 * Browsers drop tabs and newlines from URLs and read `\` as `/`, so `/\evil.com` or `/<tab>/evil.com` would
 * leave the site: any backslash or control character is refused, as are `//host` and anything not starting `/`.
 */
export function isSitePath(value: string | null | undefined): value is string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return false;
  // eslint-disable-next-line no-control-regex
  return !/[\\\u0000-\u001f\u007f]/.test(value);
}
