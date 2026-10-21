import { getPublicEnv } from "@/config/env";
import { apiGet, apiPost } from "@/lib/api/client";
import { listWorkspaces } from "@/lib/api/market";
import type { ApiResult, JsonRecord, UUID, Workspace } from "@/lib/api/types";

export type TradeAgentPlanStatus =
  | "draft"
  | "ready_for_review"
  | "paper_followed"
  | "observed_only"
  | "dismissed"
  | "expired"
  | "reviewed";

export type TradeAgentReviewDecision =
  | "paper_follow"
  | "observe_only"
  | "dismiss"
  | "needs_more_context"
  | "no_action";

export type TradeAgentPlan = {
  id: UUID;
  workspace_id: UUID;
  signal_id: UUID;
  analysis_run_id: UUID;
  symbol_id: UUID;
  setup_context_id: UUID | null;
  status: TradeAgentPlanStatus;
  plan_version: string;
  directional_bias: string;
  readiness_label: string | null;
  readiness_score: string | null;
  thesis: string;
  summary: string;
  supporting_evidence_json: JsonRecord[];
  blocker_json: JsonRecord[];
  warning_json: JsonRecord[];
  risk_notes_json: JsonRecord[];
  observation_zones_json: JsonRecord[];
  invalidation_context_json: JsonRecord[];
  target_context_zones_json: JsonRecord[];
  scenario_context_json: JsonRecord[];
  outcome_context_json: JsonRecord[];
  historical_context_json: JsonRecord[];
  safety_json: JsonRecord;
  metadata_json: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type TradeAgentReview = {
  id: UUID;
  workspace_id: UUID;
  plan_id: UUID;
  user_id: UUID | null;
  journal_entry_id: UUID | null;
  review_decision: TradeAgentReviewDecision;
  notes: string;
  metadata_json: JsonRecord;
  created_at: string;
};

export type TradeAgentObservation = {
  id: UUID;
  workspace_id: UUID;
  plan_id: UUID;
  outcome_id: UUID | null;
  observation_label: string;
  reflection_notes: string;
  metadata_json: JsonRecord;
  created_at: string;
};

export type TradeAgentData = {
  appName: string;
  workspace: Workspace | null;
  workspaces: Workspace[];
  plans: TradeAgentPlan[];
  failures: TradeAgentFailure[];
  lastLoadedAt: string;
};

export type TradeAgentFailure = {
  label: string;
  status: number;
  message: string;
  missing: boolean;
};

export function createTradeAgentPlan(signalId: UUID, forceRecompute = false): Promise<ApiResult<TradeAgentPlan>> {
  return apiPost<TradeAgentPlan>(
    `/trade-agent/plans/from-signal/${signalId}`,
    { forceRecompute },
    { optional: true },
  );
}

export function listTradeAgentPlans(params: {
  workspaceId: UUID;
  signalId?: UUID;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ApiResult<TradeAgentPlan[]>> {
  return apiGet<TradeAgentPlan[]>("/trade-agent/plans", {
    optional: true,
    query: {
      workspaceId: params.workspaceId,
      signalId: params.signalId,
      status: params.status,
      limit: params.limit || 100,
      offset: params.offset || 0,
    },
  });
}

export function getTradeAgentPlan(planId: UUID): Promise<ApiResult<TradeAgentPlan>> {
  return apiGet<TradeAgentPlan>(`/trade-agent/plans/${planId}`, { optional: true });
}

export function reviewTradeAgentPlan(
  planId: UUID,
  payload: { reviewDecision: TradeAgentReviewDecision; userId?: UUID; notes?: string; metadataJson?: JsonRecord },
): Promise<ApiResult<TradeAgentReview>> {
  return apiPost<TradeAgentReview>(
    `/trade-agent/plans/${planId}/review`,
    {
      reviewDecision: payload.reviewDecision,
      userId: payload.userId,
      notes: payload.notes || "",
      metadataJson: payload.metadataJson || {},
    },
    { optional: true },
  );
}

export function observeTradeAgentPlan(
  planId: UUID,
  payload: { outcomeId?: UUID; metadataJson?: JsonRecord } = {},
): Promise<ApiResult<TradeAgentObservation>> {
  return apiPost<TradeAgentObservation>(
    `/trade-agent/plans/${planId}/observe`,
    {
      outcomeId: payload.outcomeId,
      metadataJson: payload.metadataJson || {},
    },
    { optional: true },
  );
}

export async function getTradeAgentData(params: Record<string, string | undefined>): Promise<TradeAgentData> {
  const env = getPublicEnv();
  const failures: TradeAgentFailure[] = [];
  const workspacesResult = await listWorkspaces();
  const workspaces = readResult("Workspaces", workspacesResult, [], failures);
  const workspace = workspaces.find((item) => item.id === params.workspaceId) || workspaces[0] || null;
  const plansResult = workspace
    ? await listTradeAgentPlans({
        workspaceId: workspace.id,
        status: params.status,
        signalId: params.signalId,
        limit: 200,
      })
    : null;
  const plans = plansResult ? readResult("Paper plans", plansResult, [], failures) : [];
  return {
    appName: env.appName,
    workspace,
    workspaces,
    plans,
    failures,
    lastLoadedAt: new Date().toISOString(),
  };
}

function readResult<T>(
  label: string,
  result: ApiResult<T>,
  fallback: T,
  failures: TradeAgentFailure[],
): T {
  if (result.ok) {
    return result.data;
  }
  failures.push({
    label,
    status: result.error.status,
    message: result.error.missing ? "Endpoint not available yet" : result.error.message,
    missing: result.error.missing,
  });
  return fallback;
}
