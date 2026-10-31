"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type CSSProperties } from "react";
import {
  QueryCache,
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { StarterContentGate } from "@/components/onboarding/StarterContentGate";
import { BrandMark } from "@/components/brand/BrandMark";
import { switchWorkspace } from "@/lib/api/billing";
import { getPublicEnv } from "@/config/env";
import type { SymbolRead, Workspace } from "@/lib/api/types";
import { TerminalApiError } from "@/lib/terminal/api";
import {
  timeframes,
  toolNames,
  type Timeframe,
  type WorkspacePreferences,
} from "@/lib/terminal/types";
import { Icon } from "./Icon";
import { ResizeHandle } from "./ResizeHandle";
import { AnalystPanel } from "./AnalystPanel";
import { useTerminalWorkspace } from "./useTerminalWorkspace";
import { MarketPanel } from "./MarketPanel";
import { AnalysisPanel } from "./AnalysisPanel";
import { WorkspaceDialogs } from "./WorkspaceDialogs";

const Chart = dynamic(
  () => import("./TerminalChart").then((module) => module.TerminalChart),
  {
    ssr: false,
    loading: () => (
      <div className="qt-chart-loading" role="status">
        Loading chart engine…
      </div>
    ),
  },
);
type Props = {
  workspaces: Workspace[];
  symbols: SymbolRead[];
  userId: string;
  initialError: string | null;
};

export function TerminalWorkspace(props: Props) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (
              error instanceof TerminalApiError &&
              error.status === 401 &&
              getPublicEnv().authMode === "session"
            )
              window.dispatchEvent(new Event("quantrift:session-expired"));
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            if (
              error instanceof TerminalApiError &&
              error.status === 401 &&
              getPublicEnv().authMode === "session"
            )
              window.dispatchEvent(new Event("quantrift:session-expired"));
          },
        }),
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 30000,
            gcTime: 300000,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Workspace {...props} />
    </QueryClientProvider>
  );
}

function Workspace({ workspaces, symbols, userId, initialError }: Props) {
  const params = useSearchParams();
  const workspace =
    workspaces.find((item) => item.id === params.get("workspaceId")) ||
    workspaces[0];
  const selectedSymbol =
    symbols.find((item) => item.id === params.get("symbolId")) ||
    symbols.find((item) => item.market_type === "crypto") ||
    symbols[0];
  const timeframe = (timeframes.find(
    (item) => item === params.get("timeframe"),
  ) || "1h") as Timeframe;
  const scope = `${userId}:${workspace?.id || "none"}`;
  return (
    <StarterContentGate workspaceId={workspace?.id} terminal>
      <WorkspaceContent
        key={scope}
        workspace={workspace}
        selectedSymbol={selectedSymbol}
        timeframe={timeframe}
        workspaces={workspaces}
        symbols={symbols}
        scope={scope}
        initialError={initialError}
        navigate={(changes) => {
          const next = new URLSearchParams(params.toString());
          Object.entries(changes).forEach(([key, value]) => {
            if (value) next.set(key, value);
            else next.delete(key);
          });
          window.history.pushState(null, "", `/terminal?${next}`);
        }}
      />
    </StarterContentGate>
  );
}

function WorkspaceContent(props: Parameters<typeof useTerminalWorkspace>[0]) {
  const state = useTerminalWorkspace(props);
  const {
    workspace,
    selectedSymbol,
    timeframe,
    workspaces,
    navigate,
    preferences,
    hydrated,
    setDialog,
    tool,
    setTool,
    setBottomTab,
    range,
    notice,
    setNotice,
    fullscreen,
    menu,
    setMenu,
    redo,
    setRedo,
    selectedDrawing,
    setSelectedDrawing,
    chart,
    root,
    contextKey,
    drawings,
    update,
    sourceQuery,
    sources,
    source,
    enabled,
    recent,
    older,
    loadOlder,
    candles,
    latest,
    classification,
    evidence,
    zones,
    setDrawings,
    undoDrawing,
    redoDrawing,
    toggleFullscreen,
    onRange,
    onInspect,
    error,
    priceChange,
    percentage,
    price,
    fresh,
    tools,
  } = state;
  return (
    <div
      ref={root}
      className="qt-terminal"
      data-terminal-theme={preferences.theme}
      style={
        {
          "--qt-right-width": `${preferences.rightWidth}px`,
          "--qt-ai-width": `${preferences.analystWidth}px`,
          "--qt-bottom-height": `${preferences.bottomHeight}px`,
        } as CSSProperties
      }
    >
      <header className="qt-topbar">
        <Link href="/" className="qt-brand" aria-label="QuantRift home">
          <BrandMark className="h-6 w-6" />
          <span>
            QuantRift<span className="qt-brand-dot">.</span>
          </span>
        </Link>
        <nav aria-label="Terminal navigation" className="qt-main-nav">
          <Link className="is-active" href="/terminal">
            Terminal
          </Link>
          <Link href={`/scanner?workspaceId=${workspace?.id || ""}`}>
            Scanner
          </Link>
          <Link href={`/triage?workspaceId=${workspace?.id || ""}`}>
            Setups
          </Link>
          <Link href={`/journal?workspaceId=${workspace?.id || ""}`}>
            Journal
          </Link>
          <details className="qt-more">
            <summary>
              More <Icon name="down" size={12} />
            </summary>
            <div>
              <Link href="/command-center">Overview</Link>
              <Link href="/dashboard">Markets</Link>
              <Link href="/data/onboarding">Market data</Link>
              <Link href="/account">Account</Link>
              <Link href="/billing">Plan & billing</Link>
            </div>
          </details>
        </nav>
        <div className="qt-topbar-end">
          <span className="qt-workspace-label">WORKSPACE</span>
          <select
            aria-label="Workspace"
            value={workspace?.id || ""}
            onChange={async (event) => {
              const id = event.target.value;
              if (getPublicEnv().authMode === "session") {
                const result = await switchWorkspace(id);
                if (!result.ok) {
                  setNotice(result.error.message);
                  return;
                }
              }
              window.location.assign(
                `/terminal?${new URLSearchParams({ workspaceId: id })}`,
              );
            }}
          >
            {!workspaces.length && <option value="">No workspace</option>}
            {workspaces.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button
            className="qt-icon-button"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            onClick={() => setDialog("shortcuts")}
          >
            <Icon name="help" size={17} />
          </button>
          <Link
            href="/account"
            className="qt-avatar"
            aria-label="Account settings"
          >
            Q
          </Link>
        </div>
      </header>
      <div className="qt-toolbar" role="toolbar" aria-label="Chart controls">
        <button
          className="qt-symbol-control"
          onClick={() => setDialog("symbol")}
        >
          <Icon name="search" size={16} />
          <strong>{selectedSymbol?.symbol || "Search markets"}</strong>
          <Icon name="down" size={12} />
        </button>
        <span className="qt-toolbar-divider" />
        <div className="qt-timeframes" aria-label="Chart timeframe">
          {timeframes.map((item) => (
            <button
              key={item}
              className={timeframe === item ? "is-active" : ""}
              aria-pressed={timeframe === item}
              onClick={() =>
                navigate({
                  timeframe: item,
                  signalId: null,
                  analysisRunId: null,
                  endTime: null,
                })
              }
            >
              {item}
            </button>
          ))}
        </div>
        <span className="qt-toolbar-divider" />
        <select
          className="qt-chart-type"
          aria-label="Chart type"
          value={preferences.chartType}
          onChange={(event) =>
            update({
              chartType: event.target
                .value as WorkspacePreferences["chartType"],
            })
          }
        >
          <option value="candles">Candles</option>
          <option value="bars">OHLC bars</option>
          <option value="line">Line</option>
          <option value="area">Area</option>
        </select>
        <button
          className="qt-toolbar-button"
          onClick={() => setDialog("settings")}
        >
          <Icon name="settings" size={16} />
          <span>Indicators</span>
        </button>
        <div className="qt-toolbar-spacer" />
        <button
          className="qt-toolbar-button qt-ai-toggle"
          aria-pressed={preferences.analystOpen}
          onClick={() => update({ analystOpen: !preferences.analystOpen })}
        >
          <Icon name="ai" size={16} />
          <span>AI Analyst</span>
        </button>
        <button
          className="qt-icon-button"
          onClick={() => chart.current?.screenshot()}
          title="Download chart image"
          aria-label="Download chart image"
          disabled={!candles.length}
        >
          <Icon name="screenshot" />
        </button>
        <button
          className="qt-icon-button"
          aria-label="Toggle theme"
          title="Toggle dark / light theme"
          onClick={() =>
            update({ theme: preferences.theme === "dark" ? "light" : "dark" })
          }
        >
          <Icon name={preferences.theme === "dark" ? "sun" : "moon"} />
        </button>
        <button
          className="qt-icon-button"
          aria-label="Toggle market panel"
          title="Watchlist & market details"
          aria-pressed={preferences.rightOpen}
          onClick={() => update({ rightOpen: !preferences.rightOpen })}
        >
          <Icon name="panel" />
        </button>
        <button
          className="qt-icon-button"
          aria-label="Fullscreen chart workspace"
          title="Fullscreen (F)"
          onClick={() => void toggleFullscreen()}
        >
          <Icon name="fullscreen" />
        </button>
        <button className="qt-save-button" onClick={() => setDialog("save")}>
          <Icon name="save" size={15} />
          <span>Save research</span>
        </button>
      </div>
      {notice && (
        <div className="qt-banner" role="status">
          <span>{notice}</span>
          <button
            className="qt-icon-button"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      <main className="qt-main">
        <aside className="qt-drawing-toolbar" aria-label="Drawing tools">
          {tools.map((item) => (
            <button
              key={item}
              className={`qt-icon-button ${tool === item ? "is-active" : ""}`}
              onClick={() => setTool(item)}
              title={toolNames[item]}
              aria-label={toolNames[item]}
              aria-pressed={tool === item}
            >
              <Icon name={item} size={20} />
            </button>
          ))}
          <span className="qt-drawing-divider" />
          <button
            className="qt-icon-button"
            aria-label="Undo drawing"
            title="Undo drawing (Ctrl / Cmd Z)"
            onClick={undoDrawing}
            disabled={!drawings.length}
          >
            <Icon name="undo" />
          </button>
          <button
            className="qt-icon-button"
            aria-label="Redo drawing"
            title="Redo drawing"
            onClick={redoDrawing}
            disabled={!redo.length}
          >
            <Icon name="redo" />
          </button>
          <button
            className="qt-icon-button"
            aria-label="Delete selected drawing"
            title="Delete selected drawing"
            disabled={!drawings.some((item) => item.id === selectedDrawing)}
            onClick={() => {
              setDrawings(
                drawings.filter((item) => item.id !== selectedDrawing),
              );
              setSelectedDrawing("");
            }}
          >
            <Icon name="trash" />
          </button>
          <div className="qt-toolbar-spacer" />
          <button
            className="qt-icon-button"
            aria-label="Fit chart to data"
            title="Fit chart to data"
            onClick={() => chart.current?.fit()}
          >
            <Icon name="fullscreen" />
          </button>
        </aside>
        <div className="qt-center">
          <section
            className="qt-chart-workspace"
            aria-label={`${selectedSymbol?.symbol || "Market"} chart`}
            onContextMenu={(event) => {
              if (event.target instanceof HTMLCanvasElement) {
                event.preventDefault();
                setMenu({
                  x: Math.min(event.clientX, window.innerWidth - 220),
                  y: Math.min(event.clientY, window.innerHeight - 180),
                });
              }
            }}
          >
            <div className="qt-chart-heading">
              <div>
                <h1>
                  {selectedSymbol?.display_name || "Your market workspace"}
                  <span>
                    · {timeframe} · {source?.name || "Select a data source"}
                  </span>
                </h1>
                <div className="qt-market-price">
                  {latest ? (
                    <>
                      <strong>{price(latest.close)}</strong>
                      <span
                        className={
                          priceChange !== null && priceChange >= 0
                            ? "qt-up"
                            : "qt-down"
                        }
                      >
                        {priceChange !== null &&
                          `${priceChange >= 0 ? "+" : ""}${price(priceChange)}`}{" "}
                        {percentage !== null &&
                          `(${percentage >= 0 ? "+" : ""}${percentage.toFixed(2)}%)`}
                        <small>last candle</small>
                      </span>
                    </>
                  ) : (
                    <span className="qt-muted">
                      Real market data · no simulated prices
                    </span>
                  )}
                </div>
              </div>
              <button
                className="qt-chart-context-button"
                onClick={() => setDialog("settings")}
                title="Chart settings"
              >
                <Icon name="settings" size={16} />
              </button>
            </div>
            <div className="qt-indicator-legend">
              {(["ema", "sma", "bollinger", "rsi", "macd", "volume"] as const)
                .filter((name) => preferences.indicators[name])
                .map((name) => (
                  <button
                    key={name}
                    onClick={() =>
                      update({
                        indicators: {
                          ...preferences.indicators,
                          [name]: false,
                        },
                      })
                    }
                    title={`Hide ${name.toUpperCase()}`}
                  >
                    {name.toUpperCase()}
                    {name === "ema"
                      ? ` ${preferences.indicators.emaPeriod}`
                      : name === "sma"
                        ? ` ${preferences.indicators.smaPeriod}`
                        : name === "rsi"
                          ? ` ${preferences.indicators.rsiPeriod}`
                          : ""}
                    <Icon name="close" size={10} />
                  </button>
                ))}
              <span className="qt-calculation-label">
                Calculated from loaded final candles
              </span>
            </div>
            {hydrated && (
              <Chart
                key={`${contextKey}:${state.params.get("endTime") || "recent"}`}
                ref={chart}
                candles={candles}
                theme={preferences.theme}
                chartType={preferences.chartType}
                indicators={preferences.indicators}
                drawings={drawings}
                tool={tool}
                zones={zones}
                sampleData={source?.provider === "quantrift_sample"}
                precision={Math.min(10, selectedSymbol?.price_precision ?? 2)}
                signalTime={evidence.data?.analysisRun?.end_time || undefined}
                onDraw={(drawing) => {
                  if (drawings.length >= 100) {
                    setNotice("This chart has reached its 100 drawing limit.");
                    return;
                  }
                  setDrawings([...drawings, drawing]);
                  setRedo([]);
                  setTool("cursor");
                }}
                onEvidence={onInspect}
                onRange={onRange}
                onOlder={loadOlder}
              />
            )}
            {(!workspace ||
              !selectedSymbol ||
              (!sourceQuery.isPending && !source) ||
              (!recent.isPending && !candles.length) ||
              error) && (
              <div className="qt-chart-state">
                <div className="qt-empty-icon">
                  <Icon name="candles" size={30} />
                </div>
                <h2>
                  {error
                    ? "Market data unavailable"
                    : !workspace
                      ? "Create your workspace"
                      : !selectedSymbol
                        ? "Add your first market"
                        : !source
                          ? "Connect a market data source"
                          : "No candles for this market"}
                </h2>
                <p>
                  {error?.message ||
                    "Choose a symbol, data source, and timeframe with ingested candle history to start researching."}
                </p>
                <div>
                  <Link
                    className="qt-primary-button"
                    href={`/data/onboarding?workspaceId=${workspace?.id || ""}`}
                  >
                    Manage market data <Icon name="arrow" size={14} />
                  </Link>
                  {error && (
                    <button
                      className="qt-toolbar-button"
                      onClick={() => {
                        void sourceQuery.refetch();
                        void recent.refetch();
                      }}
                    >
                      Retry connection
                    </button>
                  )}
                </div>
              </div>
            )}
            {recent.isPending && enabled && (
              <div className="qt-chart-state qt-loading-state" role="status">
                <div className="qt-loading-bars">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <p>Loading final candles…</p>
              </div>
            )}
            {older.isFetching && (
              <div className="qt-history-loading" role="status">
                Loading earlier candles…
              </div>
            )}
          </section>
          {preferences.bottomOpen && (
            <ResizeHandle
              axis="vertical"
              reverse
              label="Resize analysis panel"
              value={preferences.bottomHeight}
              min={120}
              max={480}
              onChange={(bottomHeight) => update({ bottomHeight })}
            />
          )}
          <AnalysisPanel state={state} />
        </div>
        {preferences.analystOpen && (
          <>
            <ResizeHandle
              axis="horizontal"
              reverse
              label="Resize AI Analyst"
              value={preferences.analystWidth}
              min={270}
              max={500}
              onChange={(analystWidth) => update({ analystWidth })}
            />
            <div className="qt-ai-slot">
              <AnalystPanel
                key={classification?.signal.id || contextKey}
                classification={classification}
                symbol={selectedSymbol?.symbol || ""}
                timeframe={timeframe}
                range={range}
                onClose={() => update({ analystOpen: false })}
                onInspect={() => {
                  setBottomTab("Evidence");
                  update({ bottomOpen: true });
                }}
              />
            </div>
          </>
        )}
        {preferences.rightOpen && (
          <>
            <ResizeHandle
              axis="horizontal"
              reverse
              label="Resize watchlist"
              value={preferences.rightWidth}
              min={230}
              max={440}
              onChange={(rightWidth) => update({ rightWidth })}
            />
            <MarketPanel state={state} />
          </>
        )}
      </main>
      <footer className="qt-statusbar">
        <div>
          <span
            className={`qt-status-dot ${error ? "is-error" : fresh ? "" : "is-stale"}`}
          />
          <span>
            {error
              ? "Disconnected"
              : recent.isFetching
                ? "Refreshing candles"
                : latest
                  ? fresh
                    ? "Final candle data"
                    : "Historical / stale data"
                  : "Waiting for market data"}
          </span>
          <span className="qt-status-separator">|</span>
          <span>
            {source?.provider === "quantrift_sample"
              ? "Sample history"
              : state.params.get("endTime")
                ? "Historical view"
                : "15s refresh"}
          </span>
        </div>
        <div>
          <select
            aria-label="Chart data source"
            value={source?.id || ""}
            onChange={(event) =>
              navigate({
                sourceId: event.target.value,
                signalId: null,
                analysisRunId: null,
              })
            }
          >
            {!sources.length && <option value="">No data source</option>}
            {sources.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <span>UTC</span>
          <a
            href="/third-party-notices.txt"
            target="_blank"
            rel="noreferrer"
            title="TradingView Lightweight Charts™ · Copyright (с) 2025 TradingView, Inc."
            aria-label="Chart library attribution"
          >
            © TradingView
          </a>
          <span className="qt-status-separator">|</span>
          <span>{hydrated ? "Local workspace layout" : "Opening layout"}</span>
          <button
            onClick={() => setDialog("shortcuts")}
            aria-label="Keyboard shortcuts"
          >
            <Icon name="help" size={13} />
          </button>
        </div>
      </footer>
      {menu && (
        <>
          <button
            className="qt-menu-backdrop"
            aria-label="Close chart menu"
            onClick={() => setMenu(null)}
          />
          <div
            className="qt-context-menu"
            role="menu"
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              role="menuitem"
              onClick={() => {
                chart.current?.fit();
                setMenu(null);
              }}
            >
              Reset chart view
            </button>
            <button
              role="menuitem"
              onClick={() => {
                chart.current?.screenshot();
                setMenu(null);
              }}
            >
              Download chart image
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setDialog("settings");
                setMenu(null);
              }}
            >
              Indicators & settings
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setDialog("save");
                setMenu(null);
              }}
            >
              Save research note
            </button>
          </div>
        </>
      )}
      <WorkspaceDialogs state={state} />
      {fullscreen && (
        <span className="qt-sr-only" role="status">
          Fullscreen workspace. Press Escape to exit.
        </span>
      )}
    </div>
  );
}
