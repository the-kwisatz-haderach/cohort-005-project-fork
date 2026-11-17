import { parseOklch, relativeLuminance } from "./lib/oklch";

/**
 * WCAG 2 contrast ratio, from 1 to 21, between two opaque CSS `oklch()`
 * colours as written in `app/app.css`. Order does not matter.
 */
export function contrastRatio(first: string, second: string): number {
  const [darker, lighter] = [first, second]
    .map((css) => relativeLuminance(parseOklch(css)))
    .sort((x, y) => x - y);
  return (lighter + 0.05) / (darker + 0.05);
}
