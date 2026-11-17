import { describe, it, expect } from "vitest";
import { contrastRatio } from "../index";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("contrastRatio", () => {
  it("is 21 between white and black", () => {
    expect(contrastRatio("oklch(1 0 0)", "oklch(0 0 0)")).toBeCloseTo(21, 2);
  });

  it("does not depend on argument order", () => {
    expect(contrastRatio("oklch(0 0 0)", "oklch(1 0 0)")).toBeCloseTo(21, 2);
  });

  it("is 1 for a colour against itself", () => {
    expect(contrastRatio("oklch(0.6 0.1 200)", "oklch(0.6 0.1 200)")).toBe(1);
  });

  it("reads lightness written as a percentage", () => {
    expect(contrastRatio("oklch(50% 0 0)", "oklch(0% 0 0)")).toBe(
      contrastRatio("oklch(0.5 0 0)", "oklch(0 0 0)")
    );
  });

  it.each([
    // WCAG ratios of the sRGB primaries, written here in oklch().
    ["red #ff0000", "oklch(0.62796 0.25768 29.2339)", 3.998],
    ["green #00ff00", "oklch(0.86644 0.29483 142.4953)", 1.372],
    ["blue #0000ff", "oklch(0.45201 0.31321 264.052)", 8.5925],
  ])("matches WCAG for %s against white", (_, colour, expected) => {
    expect(contrastRatio(colour, "oklch(1 0 0)")).toBeCloseTo(expected, 3);
  });

  it("matches WCAG for yellow #ffff00 against black", () => {
    expect(
      contrastRatio("oklch(0.96798 0.21101 109.769)", "oklch(0 0 0)")
    ).toBeCloseTo(19.556, 2);
  });

  it("clips a colour outside sRGB to the gamut edge", () => {
    expect(contrastRatio("oklch(1.2 0 0)", "oklch(0 0 0)")).toBeCloseTo(21, 2);
  });

  it("tolerates surrounding whitespace", () => {
    expect(contrastRatio("  oklch( 1  0  0 ) ", "oklch(0 0 0)")).toBeCloseTo(
      21,
      2
    );
  });

  it("rejects anything that is not an opaque oklch() colour", () => {
    expect(() => contrastRatio("#fff", "oklch(0 0 0)")).toThrow(
      "Not an opaque oklch() colour: #fff"
    );
    expect(() => contrastRatio("oklch(1 0 0 / 10%)", "oklch(0 0 0)")).toThrow();
    expect(() => contrastRatio("xoklch(1 0 0)", "oklch(0 0 0)")).toThrow();
    expect(() => contrastRatio("oklch(1 0 0)x", "oklch(0 0 0)")).toThrow();
  });
});

const css = readFileSync(join(process.cwd(), "app/app.css"), "utf8");

function themeToken(mode: "light" | "dark", name: string): string {
  const selector = mode === "light" ? ":root {" : ".dark {";
  const start = css.indexOf(selector);
  const block = css.slice(start, css.indexOf("}", start));
  const match = new RegExp(`--${name}: ([^;]+);`).exec(block);
  if (!match) throw new Error(`No --${name} in the ${mode} theme`);
  return match[1];
}

// The start page uses --brand as text, as a button fill and for icons.
describe.each(["light", "dark"] as const)("the %s brand colour", (mode) => {
  const brand = themeToken(mode, "brand");

  it("is readable as text on the page background (WCAG AA, 4.5:1)", () => {
    expect(
      contrastRatio(brand, themeToken(mode, "background"))
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("is readable as text on a card (WCAG AA, 4.5:1)", () => {
    expect(
      contrastRatio(brand, themeToken(mode, "card"))
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("carries its foreground text on a button (WCAG AA, 4.5:1)", () => {
    expect(
      contrastRatio(themeToken(mode, "brand-foreground"), brand)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("stands out as an icon on the muted band (WCAG non-text, 3:1)", () => {
    expect(
      contrastRatio(brand, themeToken(mode, "muted"))
    ).toBeGreaterThanOrEqual(3);
  });
});
