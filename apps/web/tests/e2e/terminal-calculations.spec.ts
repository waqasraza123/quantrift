import { expect, test } from "@playwright/test";
import {
  ema,
  calculateChartIndicators,
} from "../../src/lib/terminal/indicators";
import { parsePreferences } from "../../src/lib/terminal/preferences";
import { defaultIndicators } from "../../src/lib/terminal/types";
import { safeAuthDestination } from "../../src/lib/auth/redirects";
import type { ChartCandle } from "../../src/lib/charts/types";

function candle(close: number, index: number): ChartCandle {
  return {
    id: String(index),
    timestamp: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
    open: close,
    high: close,
    low: close,
    close,
    volume: null,
    isFinal: true,
    qualityScore: null,
  };
}

test("EMA uses an SMA seed and keeps insufficient warmup empty", () => {
  expect(ema([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  expect(ema([1, 2], 3)).toEqual([null, null]);
});

test("flat prices produce neutral RSI, zero MACD and zero-width bands", () => {
  const candles = Array.from({ length: 60 }, (_, index) => candle(100, index));
  const result = calculateChartIndicators(candles, defaultIndicators);
  expect(result.rsi.at(-1)?.value).toBe(50);
  expect(result.upper.at(-1)?.value).toBe(100);
  expect(result.lower.at(-1)?.value).toBe(100);
  expect(result.macd.at(-1)?.value).toBe(0);
  expect(result.signal.at(-1)?.value).toBe(0);
  expect(result.histogram.at(-1)?.value).toBe(0);
});

test("RSI follows the existing rolling-average formula", () => {
  const values = [10, 12, 11, 13, 12, 16];
  const result = calculateChartIndicators(values.map(candle), {
    ...defaultIndicators,
    rsiPeriod: 3,
  });
  expect(result.rsi.at(-1)?.value).toBeCloseTo(85.71428571428571);
});

test("malformed stored preferences cannot inject chart types or drawing coordinates", () => {
  const result = parsePreferences({
    version: 1,
    theme: "invalid",
    chartType: "invalid",
    rightWidth: 99999,
    indicators: { emaPeriod: -10, deviation: 9 },
    drawings: {
      chart: [
        {
          id: "bad",
          tool: "rectangle",
          points: [{ time: "yesterday", price: 20 }],
        },
      ],
    },
  });
  expect(result.theme).toBe("dark");
  expect(result.chartType).toBe("candles");
  expect(result.rightWidth).toBe(440);
  expect(result.indicators.emaPeriod).toBe(2);
  expect(result.indicators.deviation).toBe(5);
  expect(result.drawings.chart).toEqual([]);
});

test("terminal is the safe default after authentication", () => {
  expect(safeAuthDestination()).toBe("/terminal");
  expect(safeAuthDestination("https://outside.example")).toBe("/terminal");
  expect(safeAuthDestination("/login")).toBe("/terminal");
  expect(safeAuthDestination("/terminal?symbolId=btc")).toBe(
    "/terminal?symbolId=btc",
  );
});
