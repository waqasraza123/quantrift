import type { ChartCandle, ChartZone } from "@/lib/charts/types";

export const timeframes = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as const;
export type Timeframe = (typeof timeframes)[number];
export type ChartType = "candles" | "bars" | "line" | "area";
export type DrawingTool =
  "cursor" | "trendline" | "horizontal" | "rectangle" | "zone";
export type Drawing = {
  id: string;
  tool: Exclude<DrawingTool, "cursor">;
  points: { time: number; price: number }[];
};
export type IndicatorOptions = {
  ema: boolean;
  sma: boolean;
  bollinger: boolean;
  rsi: boolean;
  macd: boolean;
  volume: boolean;
  emaPeriod: number;
  smaPeriod: number;
  rsiPeriod: number;
  bollingerPeriod: number;
  deviation: number;
};
export const defaultIndicators: IndicatorOptions = {
  ema: true,
  sma: false,
  bollinger: false,
  rsi: false,
  macd: false,
  volume: true,
  emaPeriod: 21,
  smaPeriod: 20,
  rsiPeriod: 14,
  bollingerPeriod: 20,
  deviation: 2,
};
export type WorkspacePreferences = {
  version: 1;
  theme: "dark" | "light";
  chartType: ChartType;
  rightWidth: number;
  analystWidth: number;
  bottomHeight: number;
  rightOpen: boolean;
  analystOpen: boolean;
  bottomOpen: boolean;
  indicators: IndicatorOptions;
  favorites: string[];
  drawings: Record<string, Drawing[]>;
};
export const defaultPreferences: WorkspacePreferences = {
  version: 1,
  theme: "dark",
  chartType: "candles",
  rightWidth: 280,
  analystWidth: 320,
  bottomHeight: 220,
  rightOpen: true,
  analystOpen: true,
  bottomOpen: true,
  indicators: defaultIndicators,
  favorites: [],
  drawings: {},
};
export type TerminalChartHandle = { fit: () => void; screenshot: () => void };
export type TerminalChartProps = {
  candles: ChartCandle[];
  chartType: ChartType;
  theme: "dark" | "light";
  indicators: IndicatorOptions;
  drawings: Drawing[];
  tool: DrawingTool;
  zones: ChartZone[];
  signalTime?: string;
  precision: number;
  sampleData?: boolean;
  onDraw: (drawing: Drawing) => void;
  onEvidence: (id: string) => void;
  onRange: (start: number, end: number) => void;
  onOlder: () => void;
};

export const toolNames: Record<DrawingTool, string> = {
  cursor: "Crosshair",
  trendline: "Trendline",
  horizontal: "Horizontal level",
  rectangle: "Rectangle",
  zone: "Support / resistance zone",
};
