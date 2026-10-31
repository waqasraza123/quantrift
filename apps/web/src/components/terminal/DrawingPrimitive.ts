import type {
  IPrimitivePaneRenderer,
  ISeriesApi,
  ISeriesPrimitive,
  IChartApi,
  SeriesType,
  Time,
} from "lightweight-charts";
import type { ChartZone } from "@/lib/charts/types";
import type { Drawing } from "@/lib/terminal/types";

export class DrawingPrimitive implements ISeriesPrimitive<Time> {
  private requestUpdate: (() => void) | undefined;
  private chart: IChartApi | undefined;
  private series: ISeriesApi<SeriesType> | undefined;
  private drawings: Drawing[] = [];
  private zones: ChartZone[] = [];

  attached(
    parameters: Parameters<NonNullable<ISeriesPrimitive<Time>["attached"]>>[0],
  ) {
    this.chart = parameters.chart;
    this.series = parameters.series;
    this.requestUpdate = parameters.requestUpdate;
  }
  detached() {
    this.chart = undefined;
    this.series = undefined;
    this.requestUpdate = undefined;
  }
  setData(drawings: Drawing[], zones: ChartZone[]) {
    this.drawings = drawings;
    this.zones = zones;
    this.requestUpdate?.();
  }
  private coordinates(drawing: Drawing) {
    return drawing.points.map((point) => ({
      x: this.chart?.timeScale().timeToCoordinate(point.time as Time) ?? null,
      y: this.series?.priceToCoordinate(point.price) ?? null,
    }));
  }
  hitTest(x: number, y: number) {
    for (const zone of this.zones) {
      const upper = this.series?.priceToCoordinate(
        zone.upper ?? zone.level ?? NaN,
      );
      const lower = this.series?.priceToCoordinate(
        zone.lower ?? zone.level ?? NaN,
      );
      if (
        upper != null &&
        lower != null &&
        y >= Math.min(upper, lower) - 5 &&
        y <= Math.max(upper, lower) + 5
      )
        return {
          externalId: zone.id,
          zOrder: "normal" as const,
          cursorStyle: "pointer",
        };
    }
    for (const drawing of [...this.drawings].reverse()) {
      const [start, end] = this.coordinates(drawing);
      if (!start || start.y === null) continue;
      if (drawing.tool === "horizontal" && Math.abs(y - start.y) < 7)
        return {
          externalId: drawing.id,
          zOrder: "normal" as const,
          cursorStyle: "pointer",
        };
      if (start.x === null || !end || end.x === null || end.y === null)
        continue;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const fraction = Math.max(
        0,
        Math.min(
          1,
          ((x - start.x) * dx + (y - start.y) * dy) / (dx * dx + dy * dy || 1),
        ),
      );
      const near =
        drawing.tool === "trendline"
          ? Math.hypot(
              x - start.x - dx * fraction,
              y - start.y - dy * fraction,
            ) < 7
          : x >= Math.min(start.x, end.x) - 5 &&
            x <= Math.max(start.x, end.x) + 5 &&
            y >= Math.min(start.y, end.y) - 5 &&
            y <= Math.max(start.y, end.y) + 5;
      if (near)
        return {
          externalId: drawing.id,
          zOrder: "normal" as const,
          cursorStyle: "pointer",
        };
    }
    return null;
  }
  paneViews() {
    return [
      {
        zOrder: () => "normal" as const,
        renderer: () => ({
          draw: (target: Parameters<IPrimitivePaneRenderer["draw"]>[0]) => {
            target.useBitmapCoordinateSpace(
              ({
                context,
                horizontalPixelRatio: rx,
                verticalPixelRatio: ry,
                bitmapSize,
              }) => {
                context.save();
                context.scale(rx, ry);
                context.lineWidth = 1.3;
                const width = bitmapSize.width / rx;
                for (const zone of this.zones) {
                  const upper = this.series?.priceToCoordinate(
                    zone.upper ?? zone.level ?? NaN,
                  );
                  const lower = this.series?.priceToCoordinate(
                    zone.lower ?? zone.level ?? NaN,
                  );
                  if (
                    upper == null ||
                    lower == null ||
                    !Number.isFinite(upper + lower)
                  )
                    continue;
                  context.strokeStyle = "#4bb8aa";
                  context.fillStyle = "rgba(75,184,170,0.08)";
                  context.fillRect(
                    0,
                    Math.min(upper, lower),
                    width,
                    Math.max(2, Math.abs(lower - upper)),
                  );
                  context.setLineDash([5, 4]);
                  context.beginPath();
                  context.moveTo(0, upper);
                  context.lineTo(width, upper);
                  context.stroke();
                  context.setLineDash([]);
                  context.fillStyle = "#4bb8aa";
                  context.font = "10px sans-serif";
                  context.fillText(zone.label, 12, Math.min(upper, lower) - 5);
                }
                for (const drawing of this.drawings) {
                  const [start, end] = this.coordinates(drawing);
                  if (!start || start.y === null) continue;
                  context.strokeStyle =
                    drawing.tool === "zone" ? "#c6a765" : "#4bb8aa";
                  context.fillStyle =
                    drawing.tool === "zone"
                      ? "rgba(198,167,101,0.10)"
                      : "rgba(75,184,170,0.10)";
                  context.beginPath();
                  if (drawing.tool === "horizontal") {
                    context.moveTo(0, start.y);
                    context.lineTo(width, start.y);
                  } else if (
                    start.x !== null &&
                    end?.x != null &&
                    end.y !== null
                  ) {
                    if (drawing.tool === "trendline") {
                      context.moveTo(start.x, start.y);
                      context.lineTo(end.x, end.y);
                    } else {
                      context.rect(
                        start.x,
                        start.y,
                        end.x - start.x,
                        end.y - start.y,
                      );
                      context.fill();
                    }
                    for (const point of [start, end]) {
                      context.fillRect(point.x! - 2, point.y! - 2, 4, 4);
                    }
                  }
                  context.stroke();
                }
                context.restore();
              },
            );
          },
        }),
      },
    ];
  }
}
