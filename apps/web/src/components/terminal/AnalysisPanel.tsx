"use client";

import Link from "next/link";
import { Icon } from "./Icon";
import type { TerminalWorkspaceState } from "./useTerminalWorkspace";
import { toolNames } from "@/lib/terminal/types";

export function AnalysisPanel({ state }: { state: TerminalWorkspaceState }) {
  const {
    workspace,
    navigate,
    preferences,
    setDialog,
    bottomTab,
    setBottomTab,
    setNotice,
    notes,
    setNotes,
    selectedDrawing,
    setSelectedDrawing,
    storageKey,
    drawings,
    update,
    source,
    older,
    loadOlder,
    candles,
    latest,
    runs,
    matchingRuns,
    selectedRun,
    signalQuery,
    classification,
    zones,
    setDrawings,
  } = state;
  return (
    <section
      className={`qt-bottom-panel ${preferences.bottomOpen ? "is-open" : ""}`}
      aria-label="Analysis and research"
    >
      <header className="qt-bottom-header">
        <div
          role="tablist"
          aria-label="Analysis tabs"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const tabs = ["Overview", "Evidence", "History", "Research"];
            const current = tabs.indexOf(bottomTab);
            const index =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? 3
                  : (current + (event.key === "ArrowRight" ? 1 : 3)) % 4;
            setBottomTab(tabs[index]);
            update({ bottomOpen: true });
            document.getElementById(`qt-tab-${tabs[index]}`)?.focus();
          }}
        >
          {["Overview", "Evidence", "History", "Research"].map((tab) => (
            <button
              key={tab}
              role="tab"
              id={`qt-tab-${tab}`}
              aria-controls="qt-analysis-content"
              aria-selected={bottomTab === tab}
              tabIndex={bottomTab === tab ? 0 : -1}
              className={bottomTab === tab ? "is-active" : ""}
              onClick={() => {
                setBottomTab(tab);
                update({ bottomOpen: true });
              }}
            >
              {tab}
              {tab === "Evidence" && classification && (
                <span>{classification.evidence.length}</span>
              )}
              {tab === "Research" && notes.length > 0 && (
                <span>{notes.length}</span>
              )}
            </button>
          ))}
        </div>
        <button
          className="qt-icon-button"
          aria-label={
            preferences.bottomOpen
              ? "Collapse analysis panel"
              : "Expand analysis panel"
          }
          onClick={() => update({ bottomOpen: !preferences.bottomOpen })}
        >
          <Icon name="bottom" size={16} />
        </button>
      </header>
      {preferences.bottomOpen && (
        <div
          className="qt-bottom-body"
          role="tabpanel"
          id="qt-analysis-content"
          aria-labelledby={`qt-tab-${bottomTab}`}
        >
          {bottomTab === "Overview" && (
            <div className="qt-overview-grid">
              <section>
                <div className="qt-section-label">
                  SELECTED SETUP<span>Deterministic</span>
                </div>
                {signalQuery.error && (
                  <p role="alert">{signalQuery.error.message}</p>
                )}
                {classification ? (
                  <>
                    <div className="qt-signal-summary">
                      <span
                        className={`qt-bias ${classification.signal.bias === "bullish" ? "qt-up" : classification.signal.bias === "bearish" ? "qt-down" : ""}`}
                      >
                        {classification.signal.bias}
                      </span>
                      <span>
                        {classification.signal.pattern_type || "No pattern"}
                      </span>
                      <time>
                        {new Date(
                          classification.signal.created_at,
                        ).toLocaleString()}
                      </time>
                    </div>
                    <p>{classification.signal.summary}</p>
                    <Link
                      className="qt-text-button"
                      href={`/signals/${classification.signal.id}?workspaceId=${workspace?.id}`}
                    >
                      Full setup review <Icon name="arrow" size={13} />
                    </Link>
                  </>
                ) : (
                  <p className="qt-muted">
                    {signalQuery.isPending && selectedRun
                      ? "Loading setup…"
                      : "No saved setup matches this symbol, source, and timeframe. Run a scanner to find evidence-backed signals."}
                  </p>
                )}
              </section>
              <section>
                <div className="qt-section-label">DATA COVERAGE</div>
                <div className="qt-data-stats">
                  <div>
                    <span>Final candles</span>
                    <b>{candles.length.toLocaleString()}</b>
                  </div>
                  <div>
                    <span>Latest candle</span>
                    <b>
                      {latest
                        ? new Date(latest.timestamp).toLocaleString()
                        : "Unavailable"}
                    </b>
                  </div>
                  <div>
                    <span>Chart source</span>
                    <b>{source?.name || "Not connected"}</b>
                  </div>
                </div>
                <p className="qt-fineprint">
                  Display indicators use loaded candles and browser arithmetic.
                  Persisted signal calculations retain their original backend
                  inputs.
                </p>
              </section>
            </div>
          )}
          {bottomTab === "Evidence" && (
            <div className="qt-evidence-list">
              {selectedDrawing &&
                drawings.some((item) => item.id === selectedDrawing) && (
                  <div className="qt-notice">
                    Selected drawing ·{" "}
                    {
                      toolNames[
                        drawings.find((item) => item.id === selectedDrawing)!
                          .tool
                      ]
                    }{" "}
                    · User annotation{" "}
                    <button
                      className="qt-text-button"
                      onClick={() => {
                        setDrawings(
                          drawings.filter(
                            (item) => item.id !== selectedDrawing,
                          ),
                        );
                        setSelectedDrawing("");
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              {zones
                .filter((zone) => zone.id === selectedDrawing)
                .map((zone) => (
                  <div className="qt-notice" key={zone.id}>
                    <strong>{zone.label}</strong>
                    <p>{zone.detail}</p>
                    <small>
                      {zone.source || "Persisted setup context"} ·{" "}
                      {zone.lower ?? zone.level} — {zone.upper ?? zone.level}
                    </small>
                  </div>
                ))}
              {classification?.evidence.length ? (
                classification.evidence.map((item) => (
                  <div className="qt-evidence-row" key={item.id}>
                    <span className="qt-evidence-dot" />
                    <div>
                      <strong>{item.evidence_type.replaceAll("_", " ")}</strong>
                      <p>{item.message}</p>
                    </div>
                    <Link
                      href={`/signals/${classification.signal.id}#evidence`}
                    >
                      Inspect <Icon name="arrow" size={12} />
                    </Link>
                  </div>
                ))
              ) : (
                <p className="qt-muted">
                  Select a saved setup or chart annotation to inspect its
                  underlying evidence.
                </p>
              )}
            </div>
          )}
          {bottomTab === "History" && (
            <div>
              <div className="qt-section-label">
                SAVED ANALYSIS RUNS<span>{matchingRuns.length} available</span>
              </div>
              {runs.error && <p role="alert">{runs.error.message}</p>}
              {matchingRuns.length ? (
                <table className="qt-history-table">
                  <thead>
                    <tr>
                      <th>Recorded</th>
                      <th>Timeframe</th>
                      <th>Status</th>
                      <th>Research window</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {matchingRuns.map((run) => (
                      <tr key={run.id}>
                        <td>{new Date(run.created_at).toLocaleString()}</td>
                        <td>{run.timeframe}</td>
                        <td>
                          <span className="qt-tag">{run.status}</span>
                        </td>
                        <td>
                          {run.start_time
                            ? new Date(run.start_time).toLocaleDateString()
                            : "Unavailable"}{" "}
                          —{" "}
                          {run.end_time
                            ? new Date(run.end_time).toLocaleDateString()
                            : "Unavailable"}
                        </td>
                        <td>
                          <button
                            className="qt-text-button"
                            onClick={() =>
                              navigate({
                                analysisRunId: run.id,
                                signalId: null,
                                endTime:
                                  run.end_time || run.lookback_end || null,
                              })
                            }
                          >
                            Inspect <Icon name="arrow" size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="qt-muted">
                  No analysis runs match this chart. Historical comparisons
                  remain available in full setup review.
                </p>
              )}
              <button
                className="qt-text-button"
                disabled={
                  older.isFetching ||
                  (!!older.data && !older.hasNextPage) ||
                  !candles.length
                }
                onClick={loadOlder}
              >
                Load earlier chart candles <Icon name="arrow" size={13} />
              </button>
              {older.error && <p role="alert">{older.error.message}</p>}
            </div>
          )}
          {bottomTab === "Research" && (
            <div>
              <div className="qt-section-label">
                YOUR RESEARCH<span>Private · this browser</span>
              </div>
              {notes.length ? (
                notes.map((item) => (
                  <article className="qt-research-note" key={item.id}>
                    <div>
                      <Link href={item.href}>{item.title}</Link>
                      <time>{new Date(item.created).toLocaleString()}</time>
                      <p>{item.note}</p>
                    </div>
                    <button
                      className="qt-icon-button"
                      aria-label={`Delete research ${item.title}`}
                      onClick={() => {
                        const next = notes.filter(
                          (note) => note.id !== item.id,
                        );
                        try {
                          localStorage.setItem(
                            `${storageKey}:research`,
                            JSON.stringify(next),
                          );
                          setNotes(next);
                        } catch {
                          setNotice(
                            "Research could not be removed from browser storage.",
                          );
                        }
                      }}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </article>
                ))
              ) : (
                <p className="qt-muted">
                  Save a chart observation to revisit it here. Browser notes are
                  not synchronized or shared with your workspace.
                </p>
              )}
              <button
                className="qt-text-button"
                onClick={() => setDialog("save")}
              >
                New research note <Icon name="arrow" size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
