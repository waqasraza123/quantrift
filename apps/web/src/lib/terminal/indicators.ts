import type { ChartCandle } from "@/lib/charts/types";
import type { IndicatorOptions } from "./types";

type Point = { time: number; value: number };

export function ema(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = values.map(() => null);
  if (period < 1 || values.length < period) return result;
  let previous =
    values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = previous;
  for (let index = period; index < values.length; index++) {
    previous += ((values[index] - previous) * 2) / (period + 1);
    result[index] = previous;
  }
  return result;
}

export function calculateChartIndicators(
  candles: ChartCandle[],
  options: IndicatorOptions,
) {
  const values = candles.map((candle) => candle.close);
  const points = (series: (number | null)[]): Point[] =>
    series.flatMap((value, index) =>
      value === null || !Number.isFinite(value)
        ? []
        : [{ time: Date.parse(candles[index].timestamp) / 1000, value }],
    );
  const average = (period: number) =>
    values.map((_, index) =>
      index + 1 < period
        ? null
        : values
            .slice(index + 1 - period, index + 1)
            .reduce((sum, value) => sum + value, 0) / period,
    );
  const middle = average(options.bollingerPeriod);
  const deviation = middle.map((value, index) =>
    value === null
      ? null
      : Math.sqrt(
          values
            .slice(index + 1 - options.bollingerPeriod, index + 1)
            .reduce((sum, close) => sum + (close - value) ** 2, 0) /
            options.bollingerPeriod,
        ) * options.deviation,
  );
  const rsi = values.map((_, index) => {
    if (index < options.rsiPeriod) return null;
    let gain = 0;
    let loss = 0;
    for (
      let position = index - options.rsiPeriod + 1;
      position <= index;
      position++
    ) {
      const delta = values[position] - values[position - 1];
      gain += Math.max(0, delta);
      loss += Math.max(0, -delta);
    }
    return loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
  });
  const fast = ema(values, 12);
  const slow = ema(values, 26);
  const macd = fast.map((value, index) =>
    value !== null && slow[index] !== null ? value - slow[index]! : null,
  );
  const available = macd.filter((value): value is number => value !== null);
  const signal = [
    ...Array<null>(Math.min(25, values.length)).fill(null),
    ...ema(available, 9),
  ];
  return {
    ema: points(ema(values, options.emaPeriod)),
    sma: points(average(options.smaPeriod)),
    middle: points(middle),
    upper: points(
      middle.map((value, index) =>
        value === null ? null : value + deviation[index]!,
      ),
    ),
    lower: points(
      middle.map((value, index) =>
        value === null ? null : value - deviation[index]!,
      ),
    ),
    rsi: points(rsi),
    macd: points(macd),
    signal: points(signal),
    histogram: points(
      macd.map((value, index) =>
        value === null || signal[index] == null ? null : value - signal[index]!,
      ),
    ),
  };
}
