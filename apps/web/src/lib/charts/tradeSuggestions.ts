import type { TradeSuggestion } from "@/lib/api/tradeSuggestions";
import { buildCandleSlots } from "./candles";
import type { ChartCandle, ChartOverlays, ChartZone } from "./types";

export function tradeSuggestionChart(suggestion: TradeSuggestion, showLevels: boolean) {
  const candles: ChartCandle[] = (suggestion.context_json.candles || []).flatMap((candle) => {
    const [open, high, low, close] = [candle.open, candle.high, candle.low, candle.close].map(Number);
    if (![open, high, low, close].every(Number.isFinite) || low <= 0 || high < low) {
      return [];
    }
    const volume = candle.volume === null ? null : Number(candle.volume);
    return [{
      id: candle.id, timestamp: candle.timestamp, open, high, low, close,
      volume: volume !== null && Number.isFinite(volume) ? volume : null,
      isFinal: true, qualityScore: null,
    }];
  });
  const proposal = suggestion.result_json;
  const zones: ChartZone[] = [];
  if (showLevels && proposal && proposal.decision !== "WAIT" && !suggestion.is_outdated) {
    zones.push({
      id: "ai-entry", label: `AI ${proposal.decision} entry`, detail: null,
      kind: "observation", tone: "info", lower: proposal.entry_lower,
      upper: proposal.entry_upper, level: null, source: suggestion.id,
    });
    zones.push({
      id: "ai-stop", label: "AI stop loss", detail: proposal.invalidation,
      kind: "invalidation", tone: "danger", lower: null,
      upper: null, level: proposal.stop_loss, source: suggestion.id,
    });
    proposal.targets.forEach((target, index) => zones.push({
      id: `ai-target-${index}`, label: `AI target ${index + 1}`, detail: null,
      kind: "target", tone: "good", lower: null, upper: null,
      level: target, source: suggestion.id,
    }));
  }
  const overlays: ChartOverlays = {
    zones, signalWindow: null, outcomeMarkers: [],
    patternMarker: proposal && proposal.decision !== "WAIT" && !suggestion.is_outdated && showLevels
      ? { timestamp: suggestion.context_json.cutoff || null, label: `AI ${proposal.decision}`, detail: proposal.rationale }
      : null,
  };
  return {
    slots: buildCandleSlots(candles, suggestion.context_json.timeframe || "", 240),
    latest: candles.at(-1) || null,
    overlays,
  };
}
