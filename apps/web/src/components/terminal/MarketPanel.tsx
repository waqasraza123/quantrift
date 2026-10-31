"use client";

import Link from "next/link";
import { Icon } from "./Icon";
import type { TerminalWorkspaceState } from "./useTerminalWorkspace";

export function MarketPanel({ state }: { state: TerminalWorkspaceState }) {
  const {
    workspace,
    selectedSymbol,
    timeframe,
    preferences,
    marketSearch,
    setMarketSearch,
    marketTab,
    setMarketTab,
    watchlistId,
    setWatchlistId,
    marketLimit,
    setMarketLimit,
    update,
    latest,
    watchlists,
    watchlistItems,
    filteredSymbols,
    selectSymbol,
    price,
  } = state;
  return (
    <aside
      className="qt-market-panel"
      aria-label="Watchlist and market details"
    >
      <header className="qt-panel-header">
        <span className="qt-panel-title">Watchlist</span>
        <button
          className="qt-icon-button"
          aria-label="Collapse watchlist"
          onClick={() => update({ rightOpen: false })}
        >
          <Icon name="close" size={14} />
        </button>
      </header>
      <div className="qt-watchlist-controls">
        <div className="qt-watchlist-tabs">
          {["All markets", "Favorites"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setMarketTab(tab);
                setWatchlistId("");
              }}
              className={marketTab === tab ? "is-active" : ""}
            >
              {tab === "Favorites" && <Icon name="star" size={12} />}
              {tab}
            </button>
          ))}
        </div>
        <label className="qt-search-field">
          <Icon name="search" size={14} />
          <input
            aria-label="Filter watchlist"
            value={marketSearch}
            onChange={(event) => {
              setMarketSearch(event.target.value);
              setMarketLimit(60);
            }}
            placeholder="Filter markets"
          />
          <kbd>/</kbd>
        </label>
        {!!watchlists.data?.length && (
          <select
            className="qt-watchlist-select"
            aria-label="Saved watchlist"
            value={watchlistId}
            onChange={(event) => setWatchlistId(event.target.value)}
          >
            <option value="">All saved watchlists</option>
            {watchlists.data.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="qt-market-columns">
        <span>Symbol</span>
        <span>Market</span>
        <span>★</span>
      </div>
      <div className="qt-market-list">
        {filteredSymbols.slice(0, marketLimit).map((symbol) => (
          <div
            key={symbol.id}
            className={`qt-market-row ${symbol.id === selectedSymbol?.id ? "is-active" : ""}`}
          >
            <button
              className="qt-market-select"
              onClick={() => selectSymbol(symbol)}
            >
              <span
                className={`qt-coin-icon ${symbol.market_type === "crypto" ? "is-crypto" : ""}`}
              >
                {(symbol.base_asset || symbol.symbol).slice(0, 1)}
              </span>
              <span>
                <strong>{symbol.symbol}</strong>
                <small>{symbol.display_name}</small>
              </span>
            </button>
            <span className="qt-market-type">{symbol.market_type}</span>
            <button
              className={`qt-favorite ${preferences.favorites.includes(symbol.id) ? "is-active" : ""}`}
              title="Favorite in this browser"
              aria-label={`${preferences.favorites.includes(symbol.id) ? "Remove" : "Add"} ${symbol.symbol} favorite`}
              aria-pressed={preferences.favorites.includes(symbol.id)}
              onClick={() =>
                update({
                  favorites: preferences.favorites.includes(symbol.id)
                    ? preferences.favorites.filter((id) => id !== symbol.id)
                    : [...preferences.favorites, symbol.id],
                })
              }
            >
              <Icon name="star" size={13} />
            </button>
          </div>
        ))}
        {filteredSymbols.length === 0 && (
          <p className="qt-market-empty">
            {watchlistItems.isPending && watchlistId
              ? "Loading watchlist…"
              : "No markets match this view."}
          </p>
        )}
        {filteredSymbols.length > marketLimit && (
          <button
            className="qt-load-markets"
            onClick={() => setMarketLimit((value) => value + 60)}
          >
            Show more markets
          </button>
        )}
      </div>
      <section className="qt-market-details">
        <div className="qt-details-title">
          <span className="qt-coin-icon is-crypto">
            {(
              selectedSymbol?.base_asset ||
              selectedSymbol?.symbol ||
              "Q"
            ).slice(0, 1)}
          </span>
          <div>
            <h2>{selectedSymbol?.symbol || "Market details"}</h2>
            <p>{selectedSymbol?.display_name || "Select a symbol"}</p>
          </div>
        </div>
        <div className="qt-detail-price">
          {latest ? price(latest.close) : "—"}
          <small>{selectedSymbol?.quote_asset || ""}</small>
        </div>
        <div className="qt-section-label">
          MARKET SNAPSHOT<span>{timeframe}</span>
        </div>
        <dl>
          {[
            ["Open", latest?.open],
            ["High", latest?.high],
            ["Low", latest?.low],
            ["Close", latest?.close],
            ["Volume", latest?.volume],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{typeof value === "number" ? price(value) : "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="qt-fineprint">
          Latest final candle ·{" "}
          {latest
            ? new Date(latest.timestamp).toLocaleString()
            : "Waiting for data"}
        </p>
        <Link
          className="qt-text-button"
          href={
            selectedSymbol
              ? `/symbols/${selectedSymbol.id}?workspaceId=${workspace?.id}`
              : "/dashboard"
          }
        >
          Market research <Icon name="arrow" size={13} />
        </Link>
      </section>
      <Link
        className="qt-manage-watchlists"
        href={`/scanner?workspaceId=${workspace?.id || ""}#scanner-configuration`}
      >
        <Icon name="settings" size={14} /> Manage watchlists
      </Link>
    </aside>
  );
}
