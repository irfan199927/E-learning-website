import { describe, expect, it } from "vitest";
import { negotiateLocale, parseLocale } from "./locales";

describe("locales", () => {
  it("accepts only supported languages", () => {
    expect(parseLocale("hi")).toBe("hi");
    expect(parseLocale("fr")).toBeNull();
    expect(parseLocale(undefined)).toBeNull();
  });

  it("picks the best supported language from Accept-Language", () => {
    expect(negotiateLocale("mr-IN,mr;q=0.9,en;q=0.8")).toBe("mr");
    expect(negotiateLocale("fr-FR,hi;q=0.5,en;q=0.7")).toBe("en");
    expect(negotiateLocale("ta-IN, hi-IN")).toBe("hi");
    expect(negotiateLocale("hi;q=0, en")).toBe("en");
    expect(negotiateLocale("")).toBe("en");
    expect(negotiateLocale(null)).toBe("en");
  });
});
