import { describe, expect, it } from "vitest";
import { isSitePath } from "./safe-path";

describe("isSitePath", () => {
  it("accepts same-site paths", () => {
    expect(isSitePath("/dashboard")).toBe(true);
    expect(isSitePath("/courses/abc?tab=1#x")).toBe(true);
  });
  it.each([
    "",
    "dashboard",
    "//evil.com",
    "/\\evil.com",
    "/%5Cevil.com".replace("%5C", "\\"),
    "/\t/evil.com",
    "/\n/evil.com",
    "https://evil.com",
    null,
    undefined,
  ])("refuses %j", (v) => expect(isSitePath(v as string | null | undefined)).toBe(false));
});
