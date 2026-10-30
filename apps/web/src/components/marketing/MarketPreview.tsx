"use client";

import { useState } from "react";
import { ProductIcon } from "@/components/ui/ProductIcon";

type PreviewMarket = {
  symbol: string;
  name: string;
  price: string;
  timeframe: string;
  decision: "BUY" | "WAIT";
  entry: string;
  stop: string;
  target: string;
  reason: string;
  review: string;
  closes: number[];
};

const markets: PreviewMarket[] = [
  {
    symbol: "BTC / USD", name: "Bitcoin", price: "67,420.00", timeframe: "1h", decision: "BUY",
    entry: "66,800 – 67,000", stop: "66,400", target: "68,200",
    reason: "A higher low holds above support. Consider the setup only if the next closed candle confirms the level.",
    review: "First target clears 2:1 at the upper entry bound. A close below support invalidates the idea.",
    closes: [42, 46, 44, 51, 49, 54, 59, 56, 61, 66, 63, 60, 65, 70, 67, 72, 78, 74, 71, 76, 80, 78, 82, 87, 83, 79, 84, 88, 86, 91],
  },
  {
    symbol: "ETH / USD", name: "Ethereum", price: "3,510.00", timeframe: "1h", decision: "WAIT",
    entry: "No entry proposed", stop: "—", target: "—",
    reason: "Price is moving inside a range. The candles do not yet support a clear directional setup.",
    review: "Wait for a closed-candle breakout and a defensible invalidation level before reconsidering.",
    closes: [60, 66, 70, 64, 56, 60, 67, 73, 69, 61, 55, 59, 64, 72, 68, 62, 57, 63, 70, 66, 60, 56, 62, 69, 72, 65, 59, 62, 67, 64],
  },
];

export function MarketPreview() {
  const [marketIndex, setMarketIndex] = useState(0);
  const [showLevels, setShowLevels] = useState(true);
  const market = markets[marketIndex];

  return (
    <div className="market-preview" aria-label="Interactive sample of the QuantRift setup workspace">
      <div className="preview-toolbar">
        <span className="preview-workspace"><span className="preview-avatar">Q</span>My research</span>
        <span className="preview-sample">Illustrative demo</span>
      </div>
      <div className="preview-body">
        <div className="preview-watchlist">
          <p className="preview-eyebrow">Watchlist</p>
          {markets.map((item, index) => (
            <button key={item.symbol} type="button" aria-pressed={marketIndex === index} className={marketIndex === index ? "preview-market is-selected" : "preview-market"} onClick={() => setMarketIndex(index)}>
              <span>{item.symbol}<small>{item.name}</small></span><ProductIcon name="chevron" className="h-3 w-3" />
            </button>
          ))}
          <div className="preview-note"><ProductIcon name="shield" className="h-4 w-4" /><span>Research first.<br />Your decision.</span></div>
        </div>
        <div className="preview-main">
          <div className="preview-chart-heading">
            <div><span className="preview-eyebrow">{market.name} · {market.timeframe}</span><p>{market.symbol}<span>{market.price}</span></p></div>
            <span className="preview-closed"><span />Closed candles</span>
          </div>
          <div className="preview-chart">
            <svg viewBox="0 0 490 210" role="img" aria-label={`Sample ${market.name} candlestick chart`}>
              {[35, 75, 115, 155, 195].map((y) => <line key={y} x1="0" x2="490" y1={y} y2={y} stroke="currentColor" className="preview-gridline" />)}
              {[80, 160, 240, 320, 400].map((x) => <line key={x} x1={x} x2={x} y1="10" y2="200" stroke="currentColor" className="preview-gridline" />)}
              {showLevels && market.decision === "BUY" && (
                <g>
                  <rect x="0" y="104" width="490" height="18" fill="#5ad3ad" fillOpacity=".10" />
                  <line x1="0" x2="490" y1="104" y2="104" stroke="#71d6b6" strokeDasharray="5 4" />
                  <line x1="0" x2="490" y1="161" y2="161" stroke="#e2a594" strokeDasharray="5 4" />
                  <line x1="0" x2="490" y1="29" y2="29" stroke="#71d6b6" strokeDasharray="5 4" />
                  <text x="9" y="97" fill="#9be8d0" fontSize="9">ENTRY ZONE</text>
                  <text x="9" y="153" fill="#e2a594" fontSize="9">STOP</text>
                  <text x="9" y="23" fill="#9be8d0" fontSize="9">TARGET</text>
                </g>
              )}
              {market.closes.map((close, index) => {
                const open = market.closes[Math.max(0, index - 1)] - (index % 3 === 0 ? 3 : -2);
                const rising = close >= open;
                const x = index * 15 + 18;
                const yOpen = 225 - open * 2;
                const yClose = 225 - close * 2;
                return <g key={index} stroke={rising ? "#6bd5b0" : "#d59789"} fill={rising ? "#6bd5b0" : "#d59789"}><line x1={x} x2={x} y1={Math.min(yOpen, yClose) - 7} y2={Math.max(yOpen, yClose) + 6} /><rect x={x - 3.5} y={Math.min(yOpen, yClose)} width="7" height={Math.max(2, Math.abs(yClose - yOpen))} strokeWidth="0" /></g>;
              })}
            </svg>
            <div className="preview-chart-footer"><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span></div>
          </div>
          <div className="preview-assessment">
            <div className="preview-assessment-title"><span><ProductIcon name="sparkles" className="h-3.5 w-3.5" />AI assessment</span><strong className={market.decision === "WAIT" ? "preview-wait" : ""}>{market.decision}</strong></div>
            <p>{market.reason}</p>
            <div className="preview-levels"><div><small>Entry zone</small><span>{market.entry}</span></div><div><small>Stop loss</small><span>{market.stop}</span></div><div><small>First target</small><span>{market.target}</span></div></div>
            <div className="preview-review"><ProductIcon name="shield" className="h-4 w-4" /><p><strong>Risk reviewer</strong>{market.review}</p></div>
          </div>
          <div className="preview-bottom"><span>Sample data · paper setup</span><label><input type="checkbox" checked={showLevels} onChange={(event) => setShowLevels(event.target.checked)} />Show levels</label></div>
        </div>
      </div>
    </div>
  );
}
