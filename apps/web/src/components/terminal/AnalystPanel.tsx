"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/client";
import { unwrap } from "@/lib/terminal/api";
import type { SignalClassification } from "@/lib/api/types";
import { Icon } from "./Icon";

type AnalystRun = {
  id: string;
  status: string;
  created_at: string;
  grounding_status: string;
};
type AnalystResponse = {
  run: AnalystRun;
  summary: string;
  limitations: string[];
  insights: {
    id: string;
    title: string;
    summary: string;
    rationale: string;
    evidence_refs_json: {
      artifact_type: string;
      artifact_id: string;
      label?: string;
    }[];
  }[];
};

export function AnalystPanel({
  classification,
  symbol,
  timeframe,
  range,
  onClose,
  onInspect,
}: {
  classification: SignalClassification | null;
  symbol: string;
  timeframe: string;
  range: { start: number; end: number } | null;
  onClose: () => void;
  onInspect: () => void;
}) {
  const signal = classification?.signal;
  const client = useQueryClient();
  const runs = useQuery({
    queryKey: ["terminal-ai-runs", signal?.workspace_id, signal?.id],
    enabled: !!signal,
    queryFn: async () =>
      unwrap(
        await apiGet<AnalystRun[]>(
          `/ai-intelligence/signals/${signal!.id}/runs`,
          { query: { limit: 1 } },
        ),
      ),
  });
  const runId = runs.data?.[0]?.id;
  const analysis = useQuery({
    queryKey: ["terminal-ai", signal?.workspace_id, runId],
    enabled: !!runId,
    queryFn: async () =>
      unwrap(await apiGet<AnalystResponse>(`/ai-intelligence/runs/${runId}`)),
  });
  const generate = useMutation({
    mutationFn: async () =>
      unwrap(
        await apiPost<AnalystResponse>(
          `/ai-intelligence/signals/${signal!.id}/analyze`,
          {},
          { timeoutMs: 60000 },
        ),
      ),
    onSuccess: (response) => {
      client.setQueryData(
        ["terminal-ai", signal?.workspace_id, response.run.id],
        response,
      );
      void client.invalidateQueries({
        queryKey: ["terminal-ai-runs", signal?.workspace_id, signal?.id],
      });
    },
  });
  const response = generate.data || analysis.data;
  const grounded =
    response?.run.status === "completed" &&
    response.run.grounding_status === "grounded";
  return (
    <aside className="qt-analyst" aria-label="AI Analyst">
      <header className="qt-panel-header">
        <span className="qt-panel-title">
          <Icon name="ai" /> AI Analyst{" "}
          <span className="qt-tag">QuantRift</span>
        </span>
        <button
          className="qt-icon-button"
          onClick={onClose}
          aria-label="Collapse AI Analyst"
        >
          <Icon name="close" size={15} />
        </button>
      </header>
      <div className="qt-analyst-scroll">
        <div className="qt-context-card">
          <span className="qt-eyebrow">RESEARCH CONTEXT</span>
          <strong>
            {symbol || "Select a market"}
            <span>{timeframe}</span>
          </strong>
          <p>
            {range
              ? `${new Date(range.start * 1000).toLocaleDateString()} — ${new Date(range.end * 1000).toLocaleDateString()}`
              : "Visible chart range"}
          </p>
          <small>Signal analysis uses its saved evidence window.</small>
        </div>
        <div className="qt-analyst-intro">
          <div className="qt-ai-orb">
            <Icon name="ai" size={26} />
          </div>
          <h2>
            A second perspective.
            <br />
            Grounded in evidence.
          </h2>
          <p>
            Review the selected setup with QuantRift’s analyst. Deterministic
            signals and AI interpretations stay separate.
          </p>
        </div>
        <button
          className="qt-analyze-button"
          disabled={!signal || generate.isPending}
          onClick={() => generate.mutate()}
        >
          <Icon name={generate.isPending ? "refresh" : "ai"} size={16} />
          {generate.isPending
            ? "Analyzing evidence…"
            : "Analyze selected setup"}
          <Icon name="arrow" size={15} />
        </button>
        <p className="qt-fineprint">
          Runs only when requested. Your workspace AI allowance applies.
        </p>
        {!signal && (
          <div className="qt-notice">
            Open a scanner signal or choose a recent setup below to enable
            evidence-backed analysis.
          </div>
        )}
        {(generate.error || analysis.error || runs.error) && (
          <div className="qt-notice" role="alert">
            {(generate.error || analysis.error || runs.error)?.message}
          </div>
        )}
        {(runs.isFetching || analysis.isFetching) && (
          <p className="qt-muted" role="status">
            Loading saved research…
          </p>
        )}
        {response && (
          <section className="qt-ai-results">
            <div className="qt-section-label">
              {grounded ? "AI INTERPRETATION" : "ANALYSIS STATUS"}
              <span>{response.run.status.replaceAll("_", " ")}</span>
            </div>
            <p>{response.summary}</p>
            {grounded &&
              response.insights.map((insight) => (
                <details key={insight.id} className="qt-insight">
                  <summary>{insight.title}</summary>
                  <p>{insight.summary}</p>
                  <p>{insight.rationale}</p>
                  <button className="qt-text-button" onClick={onInspect}>
                    Inspect source evidence <Icon name="arrow" size={13} />
                  </button>
                  {insight.evidence_refs_json.map((evidence) => (
                    <a
                      key={`${evidence.artifact_type}-${evidence.artifact_id}`}
                      href={`/signals/${signal?.id}#evidence`}
                      className="qt-evidence-ref"
                    >
                      {evidence.label || evidence.artifact_type} ·{" "}
                      {evidence.artifact_id.slice(0, 8)}
                    </a>
                  ))}
                </details>
              ))}
            {response.limitations.map((limitation) => (
              <p className="qt-fineprint" key={limitation}>
                {limitation}
              </p>
            ))}
            <time className="qt-fineprint">
              Saved {new Date(response.run.created_at).toLocaleString()}
            </time>
          </section>
        )}
        <div className="qt-analyst-boundary">
          <Icon name="help" size={16} />
          <p>
            Free-form chart questions and range-specific AI require the next
            backend integration. This panel analyzes existing signals today.
          </p>
        </div>
      </div>
      <footer className="qt-analyst-footer">
        <span className="qt-status-dot" /> Evidence first. Interpretation
        second.
      </footer>
    </aside>
  );
}
