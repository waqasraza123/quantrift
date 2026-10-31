import {
  defaultPreferences,
  defaultIndicators,
  type Drawing,
  type WorkspacePreferences,
} from "./types";

const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function parsePreferences(value: unknown): WorkspacePreferences {
  if (!record(value) || value.version !== 1) return defaultPreferences;
  const indicators = { ...defaultIndicators };
  if (record(value.indicators)) {
    for (const name of [
      "ema",
      "sma",
      "rsi",
      "bollinger",
      "macd",
      "volume",
    ] as const)
      if (typeof value.indicators[name] === "boolean")
        indicators[name] = value.indicators[name];
    for (const name of [
      "emaPeriod",
      "smaPeriod",
      "rsiPeriod",
      "bollingerPeriod",
    ] as const)
      indicators[name] = Math.round(
        bounded(value.indicators[name], defaultIndicators[name], 2, 200),
      );
    indicators.deviation = bounded(value.indicators.deviation, 2, 0.1, 5);
  }
  const drawings: Record<string, Drawing[]> = Object.create(null);
  if (record(value.drawings))
    for (const [key, items] of Object.entries(value.drawings).slice(0, 100)) {
      if (!Array.isArray(items)) continue;
      drawings[key] = items
        .filter(
          (item): item is Drawing =>
            record(item) &&
            typeof item.id === "string" &&
            ["trendline", "horizontal", "rectangle", "zone"].includes(
              String(item.tool),
            ) &&
            Array.isArray(item.points) &&
            item.points.length === (item.tool === "horizontal" ? 1 : 2) &&
            item.points.every(
              (point: unknown) =>
                record(point) &&
                typeof point.time === "number" &&
                Number.isFinite(point.time) &&
                typeof point.price === "number" &&
                Number.isFinite(point.price),
            ),
        )
        .slice(0, 100);
    }
  return {
    ...defaultPreferences,
    theme: value.theme === "light" ? "light" : "dark",
    chartType: (["candles", "bars", "line", "area"].includes(
      String(value.chartType),
    )
      ? value.chartType
      : "candles") as WorkspacePreferences["chartType"],
    rightWidth: bounded(value.rightWidth, 280, 230, 440),
    analystWidth: bounded(value.analystWidth, 320, 270, 500),
    bottomHeight: bounded(value.bottomHeight, 220, 120, 480),
    rightOpen: typeof value.rightOpen === "boolean" ? value.rightOpen : true,
    analystOpen:
      typeof value.analystOpen === "boolean" ? value.analystOpen : true,
    bottomOpen: typeof value.bottomOpen === "boolean" ? value.bottomOpen : true,
    indicators,
    favorites: Array.isArray(value.favorites)
      ? value.favorites
          .filter((item): item is string => typeof item === "string")
          .slice(0, 500)
      : [],
    drawings,
  };
}
