"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  createChart,
  createTextWatermark,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";
import { calculateChartIndicators } from "@/lib/terminal/indicators";
import type {
  TerminalChartHandle,
  TerminalChartProps,
} from "@/lib/terminal/types";
import { DrawingPrimitive } from "./DrawingPrimitive";

const stamp = (timestamp: string) =>
  Math.floor(Date.parse(timestamp) / 1000) as UTCTimestamp;

export const TerminalChart = forwardRef<
  TerminalChartHandle,
  TerminalChartProps
>(function TerminalChart(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<SeriesType> | null>(null);
  const primitive = useRef<DrawingPrimitive | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [hover, setHover] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const firstPoint = useRef<{ time: number; price: number } | null>(null);
  const updateData = useRef<(() => void) | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      fit: () => chart.current?.timeScale().fitContent(),
      screenshot: () => {
        const canvas = chart.current?.takeScreenshot(true);
        if (!canvas) return;
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `quantrift-chart-${new Date().toISOString().slice(0, 10)}.png`;
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
      },
    }),
    [],
  );

  useEffect(() => {
    if (!container.current) return;
    const dark = props.theme === "dark";
    const text = dark ? "#8796a8" : "#657386";
    const grid = dark ? "#1b2632" : "#edf0f4";
    const instance = createChart(container.current, {
      autoSize: true,
      layout: {
        background: {
          type: ColorType.Solid,
          color: dark ? "#101720" : "#ffffff",
        },
        textColor: text,
        fontFamily: "Inter, sans-serif",
        fontSize: 11,
        attributionLogo: true,
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid, minimumWidth: 72 },
      timeScale: {
        borderColor: grid,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 8,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#687d92", labelBackgroundColor: "#344456" },
        horzLine: { color: "#687d92", labelBackgroundColor: "#344456" },
      },
    });
    chart.current = instance;
    if (props.sampleData)
      createTextWatermark(instance.panes()[0], {
        horzAlign: "center",
        vertAlign: "center",
        lines: [
          {
            text: "SAMPLE DATA",
            color: dark ? "#a4b8c52b" : "#52647530",
            fontSize: 30,
          },
          {
            text: "Synthetic market history",
            color: dark ? "#a4b8c550" : "#52647560",
            fontSize: 12,
          },
        ],
      });
    const priceFormat = {
      type: "price" as const,
      precision: props.precision,
      minMove: 10 ** -props.precision,
    };
    const main =
      props.chartType === "line"
        ? instance.addSeries(LineSeries, {
            color: "#4bb8aa",
            lineWidth: 2,
            priceFormat,
          })
        : props.chartType === "area"
          ? instance.addSeries(AreaSeries, {
              lineColor: "#4bb8aa",
              topColor: "rgba(75,184,170,.25)",
              bottomColor: "rgba(75,184,170,0)",
              priceFormat,
            })
          : props.chartType === "bars"
            ? instance.addSeries(BarSeries, {
                upColor: "#4bb8aa",
                downColor: "#e68079",
                priceFormat,
              })
            : instance.addSeries(CandlestickSeries, {
                upColor: "#4bb8aa",
                downColor: "#e68079",
                borderVisible: false,
                wickUpColor: "#4bb8aa",
                wickDownColor: "#e68079",
                priceFormat,
              });
    series.current = main;
    const drawings = new DrawingPrimitive();
    main.attachPrimitive(drawings);
    primitive.current = drawings;
    const markers = createSeriesMarkers(main);
    let pane = 1;
    const volume = props.indicators.volume
      ? instance.addSeries(
          HistogramSeries,
          {
            priceFormat: { type: "volume" },
            priceLineVisible: false,
            lastValueVisible: false,
          },
          pane++,
        )
      : null;
    const lines: {
      key: keyof ReturnType<typeof calculateChartIndicators>;
      series: ISeriesApi<"Line">;
    }[] = [];
    const add = (
      key: keyof ReturnType<typeof calculateChartIndicators>,
      color: string,
      paneIndex = 0,
    ) => {
      lines.push({
        key,
        series: instance.addSeries(
          LineSeries,
          {
            color,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          },
          paneIndex,
        ),
      });
    };
    if (props.indicators.ema) add("ema", "#d6af69");
    if (props.indicators.sma) add("sma", "#889bda");
    if (props.indicators.bollinger) {
      add("upper", "#6e8fc0");
      add("middle", "#8a9bad");
      add("lower", "#6e8fc0");
    }
    if (props.indicators.rsi) {
      const index = pane++;
      add("rsi", "#b69cdb", index);
      lines.at(-1)!.series.createPriceLine({
        price: 70,
        color: "#758297",
        lineWidth: 1,
        axisLabelVisible: false,
        title: "RSI 70",
      });
      lines.at(-1)!.series.createPriceLine({
        price: 30,
        color: "#758297",
        lineWidth: 1,
        axisLabelVisible: false,
        title: "RSI 30",
      });
    }
    const macdPane = props.indicators.macd ? pane++ : null;
    const histogram =
      macdPane !== null
        ? instance.addSeries(
            HistogramSeries,
            { priceLineVisible: false, lastValueVisible: false },
            macdPane,
          )
        : null;
    if (macdPane !== null) {
      add("macd", "#6c9cdb", macdPane);
      add("signal", "#d6af69", macdPane);
    }
    let initialized = false;
    let previousStart = "";
    let previousLength = 0;
    updateData.current = () => {
      const current = latest.current;
      const candles = current.candles;
      const priceData = candles.map((candle) => ({
        time: stamp(candle.timestamp),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        value: candle.close,
      }));
      const range = instance.timeScale().getVisibleLogicalRange();
      if (
        initialized &&
        candles[0]?.timestamp === previousStart &&
        candles.length === previousLength &&
        priceData.length
      )
        main.update(priceData.at(-1)!);
      else main.setData(priceData);
      volume?.setData(
        candles
          .filter((candle) => candle.volume !== null)
          .map((candle) => ({
            time: stamp(candle.timestamp),
            value: candle.volume!,
            color: candle.close >= candle.open ? "#4bb8aa70" : "#e6807970",
          })),
      );
      const calculated = calculateChartIndicators(candles, current.indicators);
      lines.forEach((line) =>
        line.series.setData(
          calculated[line.key].map((point) => ({
            ...point,
            time: point.time as UTCTimestamp,
          })),
        ),
      );
      histogram?.setData(
        calculated.histogram.map((point) => ({
          ...point,
          time: point.time as UTCTimestamp,
          color: point.value >= 0 ? "#4bb8aa80" : "#e6807980",
        })),
      );
      drawings.setData(current.drawings, current.zones);
      const signalStamp = current.signalTime ? stamp(current.signalTime) : null;
      const signalCandle = signalStamp
        ? candles.find((candle) => stamp(candle.timestamp) >= signalStamp)
        : null;
      markers.setMarkers(
        signalCandle
          ? [
              {
                time: stamp(signalCandle.timestamp),
                position: "aboveBar",
                color: "#d6af69",
                shape: "circle",
                text: "Signal",
                id: "signal",
              },
            ]
          : [],
      );
      if (!initialized && candles.length) {
        instance.timeScale().setVisibleLogicalRange({
          from: Math.max(0, candles.length - 100),
          to: candles.length + 5,
        });
        instance.panes().forEach((item, index) => {
          if (index > 0) item.setHeight(index === 1 && volume ? 80 : 100);
        });
        initialized = true;
      } else if (range && candles[0]?.timestamp !== previousStart) {
        const added = candles.length - previousLength;
        instance.timeScale().setVisibleLogicalRange({
          from: range.from + Math.max(0, added),
          to: range.to + Math.max(0, added),
        });
      }
      previousStart = candles[0]?.timestamp || "";
      previousLength = candles.length;
    };
    updateData.current();
    instance.subscribeCrosshairMove((event) => {
      if (!event.time) {
        setHover(null);
        return;
      }
      const candle = latest.current.candles.find(
        (item) => stamp(item.timestamp) === event.time,
      );
      setHover(candle || null);
    });
    instance.subscribeClick((event) => {
      const current = latest.current;
      if (current.tool === "cursor") {
        if (event.hoveredObjectId)
          current.onEvidence(String(event.hoveredObjectId));
        return;
      }
      if (
        !event.time ||
        !event.point ||
        (event.paneIndex !== undefined && event.paneIndex !== 0)
      )
        return;
      const price = main.coordinateToPrice(event.point.y);
      if (price === null || typeof event.time !== "number") return;
      const point = { time: event.time, price };
      if (current.tool === "horizontal")
        current.onDraw({
          id: crypto.randomUUID(),
          tool: current.tool,
          points: [point],
        });
      else if (!firstPoint.current) {
        firstPoint.current = point;
        setPending(true);
      } else {
        current.onDraw({
          id: crypto.randomUUID(),
          tool: current.tool,
          points: [firstPoint.current, point],
        });
        firstPoint.current = null;
        setPending(false);
      }
    });
    instance.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range && range.from < 15 && initialized) latest.current.onOlder();
      const visible = instance.timeScale().getVisibleRange();
      if (
        visible &&
        typeof visible.from === "number" &&
        typeof visible.to === "number"
      )
        latest.current.onRange(visible.from, visible.to);
    });
    return () => {
      updateData.current = null;
      markers.detach();
      main.detachPrimitive(drawings);
      instance.remove();
      chart.current = null;
      series.current = null;
      primitive.current = null;
      firstPoint.current = null;
    };
  }, [
    props.theme,
    props.chartType,
    props.indicators,
    props.precision,
    props.sampleData,
  ]);

  useEffect(() => {
    updateData.current?.();
  }, [props.candles, props.drawings, props.zones, props.signalTime]);
  useEffect(() => {
    firstPoint.current = null;
    setPending(false);
    chart.current?.applyOptions({
      handleScroll: props.tool === "cursor",
      handleScale: props.tool === "cursor",
    });
  }, [props.tool]);
  const candle = hover || props.candles.at(-1);
  return (
    <div className={`qt-chart ${props.tool !== "cursor" ? "qt-drawing" : ""}`}>
      <div className="qt-ohlc" aria-live="off">
        {candle &&
          (["open", "high", "low", "close"] as const).map((key) => (
            <span key={key}>
              {key[0].toUpperCase()}{" "}
              <b className={candle.close >= candle.open ? "qt-up" : "qt-down"}>
                {candle[key].toLocaleString(undefined, {
                  maximumFractionDigits: props.precision,
                })}
              </b>
            </span>
          ))}
      </div>
      <div ref={container} className="qt-chart-canvas" />
      {props.tool !== "cursor" && (
        <div className="qt-chart-hint">
          {pending
            ? "Click the second anchor"
            : "Click to place the first anchor"}{" "}
          · Esc to cancel
        </div>
      )}
    </div>
  );
});
