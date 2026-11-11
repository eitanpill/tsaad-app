import type { SVGProps } from "react";
import { paint } from "@/components/paint";

type P = SVGProps<SVGSVGElement>;
const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true, focusable: "false" } as const;

export const CupIcon = (p: P) => (
  <svg {...base} strokeLinejoin="round" {...p}><path d="M5 4 L19 4 L17 20 L7 20 Z" /><path d="M6 12 Q9 10 12 12 T18 12" /></svg>
);
export const PathIcon = (p: P) => (
  <svg {...base} strokeLinecap="round" {...p}><ellipse cx="6" cy="18" rx="3" ry="1.6" /><ellipse cx="12" cy="12" rx="3" ry="1.6" /><ellipse cx="18" cy="6" rx="3" ry="1.6" /></svg>
);
export const LiveIcon = (p: P) => (
  <svg {...base} strokeLinejoin="round" {...p}><rect x="3" y="6" width="13" height="12" rx="3" /><path d="M16 10 L21 7 L21 17 L16 14 Z" /></svg>
);
export const BellIcon = (p: P) => (
  <svg {...base} strokeLinejoin="round" {...p}><path d="M6 16 L6 11 A6 6 0 0 1 18 11 L18 16 L20 18 L4 18 Z" /><path d="M10 21 L14 21" strokeLinecap="round" /></svg>
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
