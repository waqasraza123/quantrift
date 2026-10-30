import type { SVGProps } from "react";

export type ProductIconName = "overview" | "chart" | "setups" | "scanner" | "journal" | "arrow" | "chevron" | "check" | "layers" | "shield" | "settings" | "sparkles";

const paths: Record<ProductIconName, string> = {
  overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  chart: "M4 4v16h16M8 14V8m4 9V5m4 10V9M6 10h4m0 3h4m0-2h4",
  setups: "M4 6h16M4 12h10M4 18h6m6-2 2 2 4-5",
  scanner: "M8 3H4v4m12-4h4v4M4 17v4h4m12-4v4h-4M3 12h18M8 8h8v8H8z",
  journal: "M5 3h13a1 1 0 0 1 1 1v17H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm-1 15h15M8 7h7m-7 4h5",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  check: "m5 12 4 4L19 6",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  shield: "m12 3 8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Zm-4 9 3 3 5-6",
  settings: "M4 7h16M4 17h16M8 4v6m8 4v6",
  sparkles: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
};

export function ProductIcon({ name, className = "h-5 w-5", ...props }: SVGProps<SVGSVGElement> & { name: ProductIconName }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d={paths[name]} />
    </svg>
  );
}
