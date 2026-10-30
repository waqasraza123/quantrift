"use client";

import { useEffect, useRef, useState } from "react";

import { Panel } from "@/components/layout/panel";
import { Button } from "@/components/ui/Button";
import {
  createTradeSuggestion,
  getTradeSuggestion,
  getTradeSuggestionAvailability,
  listTradeSuggestions,
  type TradeSuggestion,
  type TradeSuggestionAvailability,
} from "@/lib/api/tradeSuggestions";
import { formatDateTime } from "@/lib/formatting/dates";
import { TradeSuggestionResult } from "./TradeSuggestionResult";

type TradeSuggestionPanelProps = { signalId: string; workspaceId: string };

const stageLabels: Record<string, string> = {
  queued: "Preparing your assessment",
  context: "Gathering chart context",
  analyst: "Analyst is assessing the chart",
  validation: "Validating prices and evidence",
  risk_reviewer: "Risk reviewer is challenging the setup",
};

const activePollMilliseconds = 2000;
const completedPollMilliseconds = 10000;

export function TradeSuggestionPanel({ signalId, workspaceId }: TradeSuggestionPanelProps) {
  const [availability, setAvailability] = useState<TradeSuggestionAvailability | null>(null);
  const [runs, setRuns] = useState<TradeSuggestion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLevels, setShowLevels] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const requestId = useRef<string | null>(null);
  const mounted = useRef(false);
  const selected = runs.find((run) => run.id === selectedId) || runs[0] || null;
  const active = runs.find((run) => run.status === "queued" || run.status === "running");

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    setLoading(true);
    setError(null);
    setRuns([]);
    setSelectedId(null);
    setAvailability(null);
    requestId.current = null;
    void Promise.all([
      getTradeSuggestionAvailability(), listTradeSuggestions(workspaceId, signalId),
    ]).then(([available, history]) => {
      if (disposed) return;
      setAvailability(available.ok ? available.data : { enabled: false, reason: available.error.message });
      if (history.ok) {
        setRuns(history.data);
        setSelectedId(history.data[0]?.id || null);
      } else if (!history.error.missing) {
        setError(history.error.message);
      }
      setLoading(false);
    });
    return () => { disposed = true; mounted.current = false; };
  }, [signalId, workspaceId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), activePollMilliseconds);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const refreshId = active?.id || selected?.id;
    if (!refreshId || (selected?.status !== "completed" && !active)) return;
    const id = refreshId;
    const pollMilliseconds = active ? activePollMilliseconds : completedPollMilliseconds;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const result = await getTradeSuggestion(id);
      if (disposed) return;
      if (result.ok) {
        setRuns((previous) => previous.map((run) => run.id === result.data.id ? result.data : run));
        setError(null);
      } else {
        setError(result.error.message);
      }
      timer = setTimeout(refresh, pollMilliseconds);
    }
    timer = setTimeout(refresh, pollMilliseconds);
    return () => { disposed = true; clearTimeout(timer); };
  }, [active?.id, selected?.id, selected?.status]);

  async function generate() {
    if (submitting || active) return;
    setSubmitting(true);
    setError(null);
    requestId.current ||= crypto.randomUUID();
    const result = await createTradeSuggestion(signalId, {
      requestId: requestId.current, regenerate: runs.some((run) => run.status === "completed"),
    });
    if (!mounted.current) return;
    if (result.ok) {
      setRuns((previous) => [result.data, ...previous.filter((run) => run.id !== result.data.id)].slice(0, 10));
      setSelectedId(result.data.id);
      requestId.current = null;
    } else {
      setError(result.error.message);
      if (result.error.status > 0) requestId.current = null;
    }
    setSubmitting(false);
  }

  return (
    <Panel title="AI assessment" eyebrow="Analyst + risk reviewer">
      <div className="space-y-4" data-ai-trade-suggestions>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">Get a second perspective on the latest closed candles. Review a conditional BUY, SELL, or WAIT idea, its proposed levels, and the risk reviewer’s response.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="primary" loading={submitting || Boolean(active)} loadingText={submitting ? "Submitting" : stageLabels[active?.stage || "queued"] || "Generating"} disabled={loading || !availability?.enabled} onClick={() => void generate()}>
            {runs.length ? "Analyze again with AI" : "Analyze with AI"}
          </Button>
          {loading && <span role="status" className="text-sm text-slate-500">Loading saved suggestions…</span>}
          {!loading && !availability?.enabled && <span className="text-sm text-slate-500">{availability?.reason || "AI suggestions are unavailable."}</span>}
        </div>
        {active && <p role="status" aria-live="polite" className="text-sm text-slate-500">{stageLabels[active.stage] || "Generating suggestion"}. You can leave this page and return to the saved run.</p>}
        {error && <p role="alert" className="rounded-lg border border-amber-500/40 p-3 text-sm">{error}</p>}
        {runs.length > 1 && (
          <label className="block text-sm">Saved runs
            <select value={selected?.id || ""} onChange={(event) => setSelectedId(event.target.value)} className="premium-control mt-2 block w-full rounded-lg p-2">
              {runs.map((run) => <option key={run.id} value={run.id}>{formatDateTime(run.created_at)} · {run.result_json?.decision || run.status}</option>)}
            </select>
          </label>
        )}
        {selected?.result_json && selected.result_json.decision !== "WAIT" && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showLevels} onChange={(event) => setShowLevels(event.target.checked)} /> Show AI levels</label>
        )}
        {selected && <TradeSuggestionResult suggestion={selected} showLevels={showLevels} now={now} />}
        <p className="text-xs text-slate-500">Conditional paper setups for human review. No orders are placed. A suggestion can differ from the original deterministic signal.</p>
      </div>
    </Panel>
  );
}
