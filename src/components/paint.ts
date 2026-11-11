import type { CSSProperties } from "react";

/** The brand colour tokens of globals.css that drawings use. */
export type Tone =
  | "cream"
  | "sky"
  | "sand"
  | "sage"
  | "olive"
  | "terracotta"
  | "terracotta-text"
  | "forest"
  | "water"
  | "maroon"
  | "muted"
  | "stone-done"
  | "white"
  | "glass";

/**
 * SVG fill and stroke from a brand token, so the drawings follow a change in globals.css instead of keeping their own hex.
 * An inline style (allowed by the CSP: style-src-attr), because presentation attributes do not resolve var() everywhere.
 * `null` leaves the fill to the element (or its `fill` attribute).
 */
export function paint(fill: Tone | "none" | null, stroke?: Tone): CSSProperties {
  const out: CSSProperties = {};
  if (fill) out.fill = fill === "none" ? "none" : `var(--${fill})`;
  if (stroke) out.stroke = `var(--${stroke})`;
  return out;
}
