const OKLCH = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/;

export type Oklch = { l: number; c: number; h: number };

export function parseOklch(css: string): Oklch {
  const match = OKLCH.exec(css.trim());
  if (!match) throw new Error(`Not an opaque oklch() colour: ${css}`);
  const [, l, percent, c, h] = match;
  return {
    l: percent ? Number(l) / 100 : Number(l),
    c: Number(c),
    h: Number(h),
  };
}

// Björn Ottosson's OKLab → linear sRGB matrices: https://bottosson.github.io/posts/oklab/
export function toLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);

  const lCone = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCone = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCone = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone,
    -1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone,
    -0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone,
  ];
}

const clampToGamut = (channel: number) => Math.min(1, Math.max(0, channel));

// WCAG 2 relative luminance takes linear sRGB, which OKLab already yields.
export function relativeLuminance(colour: Oklch): number {
  const [r, g, b] = toLinearSrgb(colour).map(clampToGamut);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
