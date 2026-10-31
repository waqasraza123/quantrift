# Research terminal

`/terminal` is the primary authenticated chart workspace. Existing overview, market, scanner,
signal detail, and journal routes remain available. The public website retains its existing theme.

## UI and charting

- Scoped dark and light themes, compact navigation, drawing toolbar, central chart, AI Analyst,
  watchlist/details panel, and collapsible analysis tabs.
- Keyboard-accessible panel dividers, fullscreen, symbol search, context menu, screenshots,
  reduced-motion support, and narrow-screen panel drawers.
- Lightweight Charts 5.2.1 uses public series, panes, markers, and series primitives. Its attribution
  link is enabled; the required notice is available through the status bar.
- Candlestick, OHLC bar, line, and area views with a separate volume pane. EMA, SMA, rolling-average
  RSI, MACD, and population-deviation Bollinger Bands are calculated from loaded final candles.
  Browser arithmetic and warmup inputs can differ from persisted backend indicator snapshots.
- Drawing tools create trendlines, horizontal levels, rectangles, and support/resistance zones.
  Drawings can be selected, deleted, undone, and redone. Moving existing anchors is not implemented.

## Existing API integration

- Real candle reads use an explicit workspace/symbol/source/timeframe. Adjacent historical windows
  load on left pan or through History, capped at ten older pages. An empty adjacent window ends
  automatic loading; this does not prove the database contains no older history beyond a gap.
- Recent final candles refresh every 15 seconds while visible. Historical views do not poll.
  This release does not implement browser WebSockets or partial-candle streaming.
- Saved watchlists reuse the scanner APIs. Favorites, layouts, drawings, and private research notes
  are stored in browser localStorage, scoped by user/workspace. Notes contain chart selection links;
  they are not immutable evidence snapshots or synchronized workspace records.
- Saved signals, analysis runs, setup zones, and evidence link back to full setup review. Scanner
  results and setup headers can open the terminal. Symbol/timeframe/source selection clears
  incompatible signal context.
- AI Analyst reads existing saved intelligence runs and generates signal analysis only on request,
  using existing permissions, grounding status, and billing. Free-form chart Q&A and visible-range
  AI analysis require a backend extension and are explicitly identified in the interface.

## Authentication

The terminal authenticates before its server bootstrap and does not mount the legacy shell's
duplicate identity/workspace consumers. Client queries are deduplicated and do not retry failures.
On session 401, the terminal cancels queries, clears the invalid first-party cookie through the
origin-protected `/api/auth/expire` route, and returns to login once. A 403 remains an access error.
This is not a repository-wide session-provider migration.

Production must build with `NEXT_PUBLIC_AUTH_MODE=session`; otherwise existing client behavior
uses direct dev-mode API reads. See `docs/deployment.md` at the repository root.

## Verification status

Tests are provided in `tests/e2e/terminal-calculations.spec.ts` and `tests/e2e/terminal.spec.ts`.
No tests, builds, browser checks, migrations, or deployment commands were run for this task,
following the user's instruction. TypeScript and targeted ESLint checks are static validation only.

Next implementation slices: authenticated streaming service; backend chart indicator series;
range-grounded Q&A; private server-persisted layouts/research with explicit sharing; anchor editing;
broader session bootstrap consolidation. No execution or autonomous trading is included.
