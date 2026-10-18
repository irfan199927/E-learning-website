/** Minimal RFC 5545 iCalendar writer for the "Export .ics" / calendar subscription feed. */

export interface IcsEvent {
  uid: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  description?: string | null;
  url?: string | null;
  location?: string | null;
  cancelled?: boolean;
  updatedAt: Date;
}

const utc = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

export function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n"); // a lone CR too: lenient parsers split lines on it
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1), never splitting a UTF-8 sequence. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const len = Buffer.byteLength(ch);
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + len > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += len;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(events: IcsEvent[], calendarName = "E-learner"): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//E-learner//Classes//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${utc(e.updatedAt)}`,
      `DTSTART:${utc(e.startsAt)}`,
      `DTEND:${utc(e.endsAt)}`,
      `SUMMARY:${escapeText(e.title)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push(`STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
