"use client";

import Link from "next/link";
import { Icon } from "./Icon";
import type { TerminalWorkspaceState } from "./useTerminalWorkspace";
import { TerminalDialog } from "./TerminalDialog";

export function WorkspaceDialogs({ state }: { state: TerminalWorkspaceState }) {
  const {
    workspace,
    selectedSymbol,
    timeframe,
    symbols,
    preferences,
    search,
    setSearch,
    dialog,
    setDialog,
    note,
    setNote,
    update,
    selectSymbol,
    saveNote,
  } = state;
  return (
    <>
      {dialog === "symbol" && (
        <TerminalDialog title="Search markets" onClose={() => setDialog(null)}>
          <label className="qt-symbol-search">
            <Icon name="search" size={20} />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Symbol, asset, or market"
              aria-label="Search symbols"
            />
          </label>
          <div className="qt-section-label">
            AVAILABLE MARKETS<span>{symbols.length}</span>
          </div>
          <div className="qt-symbol-results">
            {symbols
              .filter((symbol) =>
                `${symbol.symbol} ${symbol.display_name}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .slice(0, 100)
              .map((symbol) => (
                <button key={symbol.id} onClick={() => selectSymbol(symbol)}>
                  <span className="qt-coin-icon">{symbol.symbol[0]}</span>
                  <strong>{symbol.symbol}</strong>
                  <span>{symbol.display_name}</span>
                  <small>{symbol.market_type}</small>
                </button>
              ))}
          </div>
        </TerminalDialog>
      )}
      {dialog === "settings" && (
        <TerminalDialog
          title="Indicators & chart settings"
          onClose={() => setDialog(null)}
        >
          <p className="qt-muted">
            Calculated locally from loaded final candles. Older history changes
            the warmup window. Persisted signal indicators remain separate.
          </p>
          <div className="qt-settings-list">
            {(
              ["ema", "sma", "bollinger", "rsi", "macd", "volume"] as const
            ).map((name) => (
              <label key={name}>
                <span>
                  <strong>
                    {name === "bollinger"
                      ? "Bollinger Bands"
                      : name.toUpperCase()}
                  </strong>
                  <small>
                    {name === "rsi"
                      ? "Rolling average RSI · matches backend formula"
                      : name === "macd"
                        ? "12 / 26 / 9 · SMA-seeded EMA"
                        : name === "volume"
                          ? "Separate pane · source volume units"
                          : "SMA-seeded EMA / population deviation"}
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={preferences.indicators[name]}
                  onChange={(event) =>
                    update({
                      indicators: {
                        ...preferences.indicators,
                        [name]: event.target.checked,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="qt-period-settings">
            {(
              [
                "emaPeriod",
                "smaPeriod",
                "rsiPeriod",
                "bollingerPeriod",
                "deviation",
              ] as const
            ).map((name) => (
              <label key={name}>
                {
                  {
                    emaPeriod: "EMA period",
                    smaPeriod: "SMA period",
                    rsiPeriod: "RSI period",
                    bollingerPeriod: "Bands period",
                    deviation: "Bands deviation",
                  }[name]
                }
                <input
                  type="number"
                  min={name === "deviation" ? 0.1 : 2}
                  max={name === "deviation" ? 5 : 200}
                  step={name === "deviation" ? 0.1 : 1}
                  value={preferences.indicators[name]}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (
                      value >= (name === "deviation" ? 0.1 : 2) &&
                      value <= (name === "deviation" ? 5 : 200)
                    )
                      update({
                        indicators: {
                          ...preferences.indicators,
                          [name]:
                            name === "deviation" ? value : Math.floor(value),
                        },
                      });
                  }}
                />
              </label>
            ))}
          </div>
          <p className="qt-fineprint">
            Periods and visibility are saved in this browser, per user and
            workspace. Drawing anchors are saved per market, source, and
            timeframe.
          </p>
        </TerminalDialog>
      )}
      {dialog === "shortcuts" && (
        <TerminalDialog
          title="Make the terminal yours"
          onClose={() => setDialog(null)}
        >
          <div className="qt-shortcuts">
            {[
              ["Search symbols", "/"],
              ["Toggle AI Analyst", "A"],
              ["Fullscreen workspace", "F"],
              ["Cancel drawing / close menu", "Esc"],
              ["Undo last drawing", "Ctrl / ⌘ Z"],
              ["Delete selected drawing", "Delete"],
              ["Show shortcuts", "?"],
            ].map(([label, key]) => (
              <div key={key}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <p className="qt-fineprint">
            Drag panel dividers to resize. Focus a divider and use arrow keys to
            resize with the keyboard. Click two chart points to create a
            trendline, rectangle, or zone.
          </p>
        </TerminalDialog>
      )}
      {dialog === "save" && (
        <TerminalDialog title="Save research" onClose={() => setDialog(null)}>
          <div className="qt-save-context">
            <Icon name="candles" />
            <strong>
              {selectedSymbol?.symbol || "Market"} · {timeframe}
            </strong>
            <span>Private browser note</span>
          </div>
          <label className="qt-note-label">
            Your observation
            <textarea
              autoFocus
              value={note}
              maxLength={8000}
              rows={6}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What stands out? Record the evidence and what you want to revisit."
            />
          </label>
          <p className="qt-fineprint">
            Stored on this device with a link to the chart selection. Notes are
            not synchronized or shared. Use Journal for workspace records.
          </p>
          <div className="qt-dialog-actions">
            <Link
              href={`/journal?workspaceId=${workspace?.id || ""}`}
              className="qt-text-button"
            >
              Open journal
            </Link>
            <button
              className="qt-primary-button"
              disabled={!note.trim()}
              onClick={saveNote}
            >
              <Icon name="save" size={15} />
              Save privately
            </button>
          </div>
        </TerminalDialog>
      )}
    </>
  );
}
