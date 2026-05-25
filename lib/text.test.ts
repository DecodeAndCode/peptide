import { describe, expect, it } from "vitest";
import {
  buildExcerpt,
  escapeHtml,
  normalizeText,
  paragraphsToHtml,
  prettifyContentType,
  slugify,
} from "@/lib/text";

describe("normalizeText", () => {
  it("lowercases and collapses non-alphanumeric runs to single spaces", () => {
    expect(normalizeText("  Hello, World!  ")).toBe("hello world");
    expect(normalizeText("Multi---hyphen___test")).toBe("multi hyphen test");
  });

  it("strips emoji and unicode punctuation", () => {
    expect(normalizeText("🚀 Launch 2026 ✨")).toBe("launch 2026");
  });
});

describe("slugify", () => {
  it("returns fallback for empty/whitespace input", () => {
    expect(slugify("")).toBe("suppgo-content");
    expect(slugify("   ")).toBe("suppgo-content");
  });

  it("hyphenates words and lowercases", () => {
    expect(slugify("Stack & Combination Guide")).toBe("stack-combination-guide");
  });

  it("truncates at 80 chars", () => {
    const long = "a".repeat(120);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });
});

describe("buildExcerpt", () => {
  it("collapses whitespace and truncates to 180 chars by default", () => {
    const body = "Line one.\n\nLine two with    extra spaces.\n\n" + "x".repeat(300);
    expect(buildExcerpt(body).length).toBeLessThanOrEqual(180);
    expect(buildExcerpt(body).startsWith("Line one. Line two with extra spaces.")).toBe(true);
  });

  it("respects custom max length", () => {
    expect(buildExcerpt("a".repeat(100), 50).length).toBe(50);
  });
});

describe("prettifyContentType", () => {
  it("title-cases snake_case strings", () => {
    expect(prettifyContentType("faq_snippet")).toBe("Faq Snippet");
    expect(prettifyContentType("product_interaction")).toBe("Product Interaction");
  });
});

describe("escapeHtml", () => {
  it("escapes &, <, >, and double quotes", () => {
    expect(escapeHtml(`<p class="x">Tom & Jerry</p>`)).toBe(
      "&lt;p class=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/p&gt;",
    );
  });

  it("escapes ampersand first so existing entities are not double-escaped intentionally", () => {
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });
});

describe("paragraphsToHtml", () => {
  it("wraps each double-newline-separated block in <p>", () => {
    const html = paragraphsToHtml("Hello world.\n\nSecond paragraph here.");
    expect(html).toBe("<p>Hello world.</p>\n<p>Second paragraph here.</p>");
  });

  it("converts single newlines inside a paragraph to <br />", () => {
    expect(paragraphsToHtml("First line.\nSecond line.")).toBe(
      "<p>First line.<br />Second line.</p>",
    );
  });

  it("filters empty paragraphs", () => {
    expect(paragraphsToHtml("\n\n   \n\nHello.\n\n")).toBe("<p>Hello.</p>");
  });

  it("HTML-escapes content inside paragraphs", () => {
    expect(paragraphsToHtml("Use <strong> & be careful.")).toBe(
      "<p>Use &lt;strong&gt; &amp; be careful.</p>",
    );
  });
});
