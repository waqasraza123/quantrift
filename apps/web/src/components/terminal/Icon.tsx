import type { CSSProperties } from "react";

const paths: Record<string, string> = {
  search: "m21 21-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  candles: "M6 3v18M3 7h6v8H3zM17 2v20M14 5h6v12h-6z",
  bars: "M6 3v18M2 8h4m0 8h4M17 2v20m-4-16h4m0 11h4",
  line: "m2 18 5-7 5 3 5-10 5 3",
  area: "m2 18 5-7 5 3 5-10 5 3v15H2z",
  cursor: "m5 3 14 10-7 1-3 7z",
  trendline: "m3 20 18-16M3 17v4h4M17 3h4v4",
  horizontal: "M2 12h20M5 9v6",
  rectangle: "M4 5h16v14H4z",
  zone: "M3 7h18v10H3zM3 12h18",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-5 0v6",
  fullscreen: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
  screenshot: "M3 7h4l2-3h6l2 3h4v13H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  ai: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
  close: "m6 6 12 12M6 18 18 6",
  panel: "M3 4h18v16H3zM15 4v16",
  bottom: "M3 4h18v16H3zM3 14h18",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  moon: "M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11",
  star: "m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  down: "m6 9 6 6 6-6",
  undo: "m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12",
  redo: "m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  save: "M4 3h13l4 4v14H3V3zM7 3v6h10V3M7 21v-8h10v8",
  help: "M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4m0 3v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  refresh:
    "M20 4v6h-6M4 20v-6h6M5 8a8 8 0 0 1 13-3l2 5M4 14l2 5a8 8 0 0 0 13-3",
};
export function Icon({
  name,
  size = 18,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.grid} />
    </svg>
  );
}
