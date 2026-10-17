import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

const render = (md: string) => renderToStaticMarkup(createElement(Markdown, null, md));

describe("Markdown", () => {
  it("formats text and keeps plain line breaks", () => {
    const html = render("# Angles\n\n**Sum** is 180°\nin a triangle.\n\n- one\n- two");
    expect(html).toContain("<h3");
    expect(html).toContain("<strong>Sum</strong>");
    expect(html).toContain("whitespace-pre-line");
    expect(html).toMatch(/<ul[^>]*>.*<li[^>]*>one<\/li>/s);
  });

  it("never renders HTML or unsafe links from the source", () => {
    const html = render(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[click](javascript:alert(1)) [ok](https://example.com)',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
});
