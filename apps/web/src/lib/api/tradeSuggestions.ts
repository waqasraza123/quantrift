import { apiGet, apiPost } from "./client";
import type { ApiResult, UUID } from "./types";

export type TradeSuggestionProposal = {
  decision: "BUY" | "SELL" | "WAIT";
  entry_lower: number | null;
  entry_upper: number | null;
  stop_loss: number | null;
  targets: number[];
  rationale: string;
  evidence_refs: string[];
  invalidation: string;
  risks: string[];
};

export type TradeSuggestionReview = {
  verdict: "approve" | "revise" | "wait";
  summary: string;
  evidence_refs: string[];
};

export type TradeSuggestionCandle = {
  id: UUID;
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string | null;
};

export type TradeSuggestion = {
  id: UUID;
  workspace_id: UUID;
  signal_id: UUID;
  status: "queued" | "running" | "completed" | "blocked" | "failed";
  stage: string;
  result_json: TradeSuggestionProposal | null;
  review_json: TradeSuggestionReview | null;
  reward_risk: string | null;
  context_json: {
    timeframe?: string;
    source_id?: UUID;
    cutoff?: string;
    as_of?: string;
    candles?: TradeSuggestionCandle[];
    original_signal?: { bias: string };
  };
  model: string;
  prompt_version: string;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  is_outdated: boolean;
  actionable: boolean;
};

export type TradeSuggestionAvailability = { enabled: boolean; reason: string | null };

export function getTradeSuggestionAvailability(): Promise<ApiResult<TradeSuggestionAvailability>> {
  return apiGet<TradeSuggestionAvailability>("/trade-agent/suggestions/availability", { optional: true });
}

export function listTradeSuggestions(workspaceId: UUID, signalId: UUID): Promise<ApiResult<TradeSuggestion[]>> {
  return apiGet<TradeSuggestion[]>("/trade-agent/suggestions", {
    optional: true,
    query: { workspaceId, signalId, limit: 10 },
  });
}

export function getTradeSuggestion(id: UUID): Promise<ApiResult<TradeSuggestion>> {
  return apiGet<TradeSuggestion>(`/trade-agent/suggestions/${id}`);
}

export function createTradeSuggestion(
  signalId: UUID,
  payload: { requestId: UUID; regenerate: boolean },
): Promise<ApiResult<TradeSuggestion>> {
  return apiPost<TradeSuggestion>(`/trade-agent/suggestions/from-signal/${signalId}`, payload);
}
