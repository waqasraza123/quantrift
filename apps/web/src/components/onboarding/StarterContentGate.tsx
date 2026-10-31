"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { apiGet, apiPost } from "@/lib/api/client";
import { BrandMark } from "@/components/brand/BrandMark";
import styles from "./starter-content.module.css";

type StarterState = {
  status: "pending" | "ready" | "disabled" | "existing_data";
  step: number;
  total_steps: number;
  can_initialize: boolean;
  sample_data: boolean;
  source_id: string | null;
  symbol_id: string | null;
  timeframe: string;
  busy: boolean;
};

const completed = new Map<string, StarterState>();

export function StarterContentGate({
  workspaceId,
  children,
  terminal = false,
}: {
  workspaceId?: string | null;
  children: ReactNode;
  terminal?: boolean;
}) {
  const [state, setState] = useState<StarterState | null>(null);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [continuing, setContinuing] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    const cached = completed.get(workspaceId);
    if (cached) {
      setState(cached);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const path = `/workspaces/${workspaceId}/starter-content`;
    setLoading(true);
    setError("");
    void (async () => {
      const initial = await apiGet<StarterState>(path, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!initial.ok) {
        setLoading(false);
        setError(
          initial.error.status === 404
            ? ""
            : "Sample research is unavailable. Your existing workspace is still accessible.",
        );
        return;
      }
      let current = initial.data;
      setState(current);
      if (current.status !== "pending" || !current.can_initialize) {
        if (current.status !== "pending") completed.set(workspaceId, current);
        setLoading(false);
        return;
      }
      setWorking(true);
      for (
        let attempt = 0;
        attempt < 90 && !controller.signal.aborted;
        attempt++
      ) {
        const result = await apiPost<StarterState>(
          path,
          { action: "prepare" },
          { timeoutMs: 60000, signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (!result.ok) {
          setError(
            "Sample setup paused. Retry to resume, or continue with your workspace.",
          );
          setWorking(false);
          setLoading(false);
          return;
        }
        current = result.data;
        setState(current);
        if (current.status !== "pending") {
          completed.set(workspaceId, current);
          if (current.status === "ready") {
            const destination = new URL(window.location.href);
            if (
              terminal &&
              !destination.searchParams.has("symbolId") &&
              current.symbol_id
            )
              destination.searchParams.set("symbolId", current.symbol_id);
            if (
              terminal &&
              !destination.searchParams.has("sourceId") &&
              current.source_id
            )
              destination.searchParams.set("sourceId", current.source_id);
            if (terminal && !destination.searchParams.has("timeframe"))
              destination.searchParams.set("timeframe", current.timeframe);
            window.location.replace(destination.toString());
            return;
          }
          setWorking(false);
          setLoading(false);
          return;
        }
        if (current.busy)
          await new Promise<void>((resolve) => {
            const finish = () => {
              clearTimeout(timer);
              controller.signal.removeEventListener("abort", finish);
              resolve();
            };
            const timer = setTimeout(finish, 1500);
            controller.signal.addEventListener("abort", finish, { once: true });
          });
      }
      if (!controller.signal.aborted) {
        setError(
          "Sample setup is taking longer than expected. Retry to resume.",
        );
        setWorking(false);
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [workspaceId, terminal, retry]);

  async function disable() {
    if (!workspaceId) return;
    setContinuing(true);
    const result = await apiPost<StarterState>(
      `/workspaces/${workspaceId}/starter-content`,
      { action: "disable" },
    );
    if (result.ok) {
      completed.set(workspaceId, result.data);
      window.location.reload();
    } else {
      setError("Could not save your preference. Please try again.");
      setContinuing(false);
    }
  }

  if ((loading || working) && workspaceId)
    return (
      <section
        className={`${styles.preparing} ${terminal ? styles.fullscreen : ""}`}
        aria-label="Preparing sample research"
      >
        <BrandMark className="h-10 w-10" />
        <span className={styles.eyebrow}>YOUR RESEARCH STARTS HERE</span>
        <h1>
          {working
            ? "Setting up your sample workspace"
            : "Opening your research workspace"}
        </h1>
        <p>
          Explore charts, signals, watchlists, and research notes from the first
          visit. Everything is labeled as sample data and can be changed later.
        </p>
        <div className={styles.preview}>
          <span>
            BTC / USDT <small>Charts & indicators</small>
          </span>
          <span>
            ETH / USDT <small>Signals & evidence</small>
          </span>
          <span>
            Your research <small>Watchlist & journal</small>
          </span>
        </div>
        <progress
          aria-label="Sample research preparation"
          max={state?.total_steps || 22}
          value={state?.step || 0}
        />
        <p className={styles.progress} role="status">
          {working
            ? `Preparing examples · ${Math.round(((state?.step || 0) / (state?.total_steps || 22)) * 100)}%`
            : "Checking your workspace…"}
        </p>
        {state?.can_initialize && (
          <button onClick={() => void disable()} disabled={continuing}>
            {continuing ? "Saving preference…" : "I’ll start with my own data"}
          </button>
        )}
      </section>
    );

  return (
    <div className={terminal ? styles.terminalFrame : styles.frame}>
      {state?.sample_data && (
        <aside className={styles.banner} aria-label="Sample research notice">
          <div>
            <strong>Sample content included</strong>
            <span>
              Records from “Sample market history” are synthetic. Your connected
              sources are separate. Edit or replace the examples at any time.
            </span>
          </div>
          <Link href={`/data/onboarding?workspaceId=${workspaceId}`}>
            Connect market data ↗
          </Link>
        </aside>
      )}
      {error && (
        <aside className={styles.error} role="status">
          <span>{error}</span>
          <button onClick={() => setRetry((value) => value + 1)}>
            Retry sample setup
          </button>
          {state?.can_initialize && (
            <button onClick={() => void disable()} disabled={continuing}>
              Continue without samples
            </button>
          )}
        </aside>
      )}
      <div className={styles.content}>{children}</div>
    </div>
  );
}
