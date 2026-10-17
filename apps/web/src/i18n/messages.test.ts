import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { en, NAMESPACES } from "./catalog";
import { withFallback } from "./messages";

const dir = new URL("../../messages/", import.meta.url);
const read = (locale: string) =>
  Object.fromEntries(
    readdirSync(new URL(`${locale}/`, dir)).map((f) => [
      f.replace(/\.json$/, ""),
      JSON.parse(readFileSync(new URL(`${locale}/${f}`, dir), "utf8")) as Tree,
    ]),
  );
const hi = read("hi");
const mr = read("mr");

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(path, v);
    else for (const [p, s] of flatten(v, path)) out.set(p, s);
  }
  return out;
}

/** ICU arguments: `{name}`, `{count, plural, …}`, `{role, select, …}` (not the words inside a branch). */
const args = (message: string) =>
  new Set(
    [...message.matchAll(/\{(\w+)(?:\}|,\s*(?:plural|select|selectordinal|number|date|time)\b)/g)].map(
      (m) => m[1],
    ),
  );

const english = flatten(en as unknown as Tree);

it("every language has a file for every namespace, and no others", () => {
  for (const locale of ["en", "hi", "mr"])
    expect(Object.keys(read(locale)).sort()).toEqual([...NAMESPACES].sort());
});

describe.each([
  ["hi", hi],
  ["mr", mr],
])("%s messages", (_, catalog) => {
  const translated = flatten(catalog as Tree);

  it("has no keys English doesn't have (typos would never show)", () => {
    expect([...translated.keys()].filter((k) => !english.has(k))).toEqual([]);
  });

  it("uses only arguments the English message passes", () => {
    const wrong = [...translated].filter(([k, v]) => [...args(v)].some((a) => !args(english.get(k)!).has(a)));
    expect(wrong).toEqual([]);
  });
});

describe("withFallback", () => {
  it("fills missing or empty messages from English", () => {
    const merged = withFallback({ Nav: { overview: "अवलोकन", calendar: "" } }, en);
    expect(merged.Nav.overview).toBe("अवलोकन");
    expect(merged.Nav.calendar).toBe("Calendar");
    expect(merged.SignIn.title).toBe("Sign in");
  });
});
