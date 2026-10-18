/**
 * Remembers a collapsed desktop sidebar. A plain module (not the "use client" ShellFrame), so the server
 * component AppShell gets the real string and the first paint already has the right width.
 */
export const SIDEBAR_COOKIE = "sidebar";
