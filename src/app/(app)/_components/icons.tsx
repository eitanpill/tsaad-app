import type { SVGProps } from "react";
import { paint } from "@/components/paint";

type P = SVGProps<SVGSVGElement>;
const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true, focusable: "false" } as const;

// Nav icons: one hand-drawn line (the same 1.9 stroke, round ends) as the doodles, not a stock icon set.
export const CupIcon = (p: P) => (
  <svg {...base} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 5 C5.3 11 6 17 7.5 19.5 C9 21 15 21 16.5 19.5 C18 17 18.7 11 19 5" /><path d="M5 5 C8 6.5 16 6.5 19 5" /><path d="M6.2 12 C10 13.5 14 11 17.8 12" /></svg>
);
export const PathIcon = (p: P) => (
  <svg {...base} strokeWidth={1.9} strokeLinecap="round" {...p}><path d="M3 18.5 C8 18.5 8 12 12 12 S16 5.5 21 5.5" /><ellipse cx="4.5" cy="18.5" rx="2.4" ry="1.9" fill="currentColor" /><ellipse cx="12" cy="12" rx="2.4" ry="1.9" fill="currentColor" /><ellipse cx="19.5" cy="5.5" rx="2.4" ry="1.9" fill="currentColor" /></svg>
);
export const LiveIcon = (p: P) => (
  <svg {...base} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3.5 9 C3.5 7 4.5 6 6.5 6 H13 C15 6 16 7 16 9 V15 C16 17 15 18 13 18 H6.5 C4.5 18 3.5 17 3.5 15 Z" /><path d="M16 10.5 C18 9.2 19.5 8 20.5 8 V16 C19.5 16 18 14.8 16 13.5" /></svg>
);
export const BellIcon = (p: P) => (
  <svg {...base} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 16 C6.5 12 6 8 9 6 C11 4.5 13 4.5 15 6 C18 8 17.5 12 18 16 C18.5 17 19.5 17.5 20 18 H4 C4.5 17.5 5.5 17 6 16 Z" /><path d="M10 20.5 C11 21.5 13 21.5 14 20.5" /></svg>
);
export const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="3" y="2" width="3.6" height="12" rx="1.2" fill="currentColor" /><rect x="9.4" y="2" width="3.6" height="12" rx="1.2" fill="currentColor" /></svg>
);
export const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 2.5 L13 8 L4 13.5 Z" fill="currentColor" /></svg>
);
export const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2.5 7.5 L5.8 10.5 L11.5 3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const AlertCircle = () => (
  <svg aria-hidden="true" focusable="false" width="22" height="22" viewBox="0 0 20 20" style={{ flexShrink: 0 }}><circle cx="10" cy="10" r="9" style={paint("terracotta-text")} /><path d="M10 5.2 V11" strokeWidth="2.2" strokeLinecap="round" style={paint(null, "white")} /><circle cx="10" cy="14.4" r="1.3" style={paint("white")} /></svg>
);
export const WifiOffIcon = () => (
  <svg {...base} strokeLinecap="round"><path d="M2 8.5 C 7.5 3.5, 16.5 3.5, 22 8.5" /><path d="M5.5 12.5 C 9 9.5, 15 9.5, 18.5 12.5" /><path d="M9 16 C 10.8 14.6, 13.2 14.6, 15 16" /><circle cx="12" cy="19.5" r="1.2" fill="currentColor" /><path d="M3 3 L21 21" /></svg>
);
export const LockIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11 V8 A4 4 0 0 1 16 8 V11" /></svg>
);
