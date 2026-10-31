import { apiGet } from "@/lib/api/client";
import type { ApiResult } from "@/lib/api/types";
import type { CandleRead } from "@/lib/data-onboarding/types";
import { timeframeToMilliseconds } from "@/lib/charts/candles";
import type { Timeframe } from "./types";
import type {
  AdvancedFeatureSnapshot,
  AnalysisRun,
  SignalClassification,
} from "@/lib/api/types";
import { getSignalSetupContext } from "@/lib/api/setup-context";
import { listSignalOutcomes } from "@/lib/api/outcomes";
import { buildChartOverlays } from "@/lib/charts/overlays";

export class TerminalApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok)
    throw new TerminalApiError(result.error.status, result.error.message);
  return result.data;
}
export type CandleContext = {
  workspaceId: string;
  symbolId: string;
  sourceId: string;
  timeframe: Timeframe;
};

export async function candlePage(
  context: CandleContext,
  before?: string,
  signal?: AbortSignal,
): Promise<CandleRead[]> {
  let end = before;
  if (!end) {
    const latest = await apiGet<CandleRead>("/candles/latest", {
      signal,
      query: {
        workspace_id: context.workspaceId,
        symbol_id: context.symbolId,
        source_id: context.sourceId,
        timeframe: context.timeframe,
        is_final: true,
      },
    });
    if (!latest.ok && latest.error.status === 404) return [];
    end = unwrap(latest).timestamp;
  }
  const endMs = Date.parse(end) - (before ? 1 : 0);
  const startMs =
    endMs - (timeframeToMilliseconds(context.timeframe) || 3600000) * 499;
  return unwrap(
    await apiGet<CandleRead[]>("/candles", {
      signal,
      query: {
        workspace_id: context.workspaceId,
        symbol_id: context.symbolId,
        source_id: context.sourceId,
        timeframe: context.timeframe,
        start_time: new Date(startMs).toISOString(),
        end_time: new Date(endMs).toISOString(),
        is_final: true,
        limit: 500,
      },
    }),
  );
}

export async function signalChartEvidence(
  classification: SignalClassification,
) {
  const signal = classification.signal;
  const [setup, outcomes, analysis, advanced] = await Promise.all([
    getSignalSetupContext(signal.id),
    listSignalOutcomes(signal.id),
    apiGet<AnalysisRun>(`/analysis-runs/${signal.analysis_run_id}`),
    apiGet<AdvancedFeatureSnapshot>(`/signals/${signal.id}/advanced-features`, {
      optional: true,
    }),
  ]);
  for (const result of [setup, outcomes, analysis, advanced]) {
    if (!result.ok && result.error.status === 401)
      throw new TerminalApiError(401, result.error.message);
  }
  const analysisRun = analysis.ok ? analysis.data : null;
  return {
    analysisRun,
    overlays: buildChartOverlays({
      setupContext: setup.ok ? setup.data : null,
      analysisRun,
      signal,
      outcomes: outcomes.ok ? outcomes.data : [],
      supportResistance: advanced.ok
        ? advanced.data.support_resistance_json
        : null,
    }),
  };
}
