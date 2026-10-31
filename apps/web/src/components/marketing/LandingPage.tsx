import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { ProductIcon, type ProductIconName } from "@/components/ui/ProductIcon";
import { getProductConfig } from "@/config/product";
import { MarketPreview } from "./MarketPreview";

const features: { title: string; description: string; icon: ProductIconName }[] = [
  { title: "Watchlists & market scanner", description: "Track your chosen markets and scan your watchlist for setups, so you know where to focus your chart review.", icon: "scanner" },
  { title: "Charts with market context", description: "Read price action, market structure, and timeframe agreement together before forming your view.", icon: "chart" },
  { title: "Evidence behind every setup", description: "Review confidence, supporting signals, and conflicting evidence to understand what makes a setup worth watching.", icon: "layers" },
  { title: "AI trade ideas", description: "When enabled, explore conditional paper setups with proposed entry zones, stops, targets, and clear reasons to wait.", icon: "sparkles" },
  { title: "Independent risk review", description: "When AI ideas are enabled, check a second assessment for conflicting evidence, weak price levels, and reward-to-risk before deciding.", icon: "shield" },
  { title: "Journal & outcome review", description: "Record your reasoning, keep paper plans, and revisit observed outcomes to learn from how each setup developed.", icon: "journal" },
];

const questions = [
  { question: "How can AI help me review a setup?", answer: "When AI suggestions are enabled for your workspace, you can review a conditional BUY, SELL, or WAIT idea based on completed candles. BUY describes a potential long setup; SELL describes a potential short setup. You see the proposed levels, supporting evidence, and a separate risk review. Directional ideas must pass price checks and a minimum 2:1 reward-to-risk check." },
  { question: "Does QuantRift place trades?", answer: "No. QuantRift is a research workspace. It provides charts, evidence, conditional paper setups, and a journal. You make your own decisions; there is no broker execution or automatic order placement." },
  { question: "Is the preview showing live prices?", answer: "The preview on this page uses illustrative sample data. In your workspace, check timestamps and data-quality warnings to see how current an assessment is. New market data can make an earlier idea outdated." },
  { question: "How do I get started?", answer: "Create your account, choose the markets you follow, and set up or import market data in your workspace. Build a watchlist, scan for setups, and open a chart to review the evidence. AI ideas are optional and available when enabled for your workspace." },
];

export function LandingPage() {
  const product = getProductConfig();
  return (
    <main className="marketing-page">
      <a href="#main-content" className="marketing-skip">Skip to content</a>
      <header className="marketing-nav">
        <div className="marketing-container marketing-nav-inner">
          <Link href="/" className="marketing-brand" aria-label={`${product.name} home`}><BrandMark className="h-8 w-8" />{product.name}</Link>
          <nav aria-label="Homepage navigation" className="marketing-links"><a href="#features">Top features</a><a href="#ai-research">AI trade ideas</a><a href="#questions">Questions</a></nav>
          <div className="marketing-nav-actions"><Link href="/login" className="marketing-signin">Sign in</Link><Link href="/register" className="marketing-button marketing-button-small">Get started<ProductIcon name="arrow" className="h-3.5 w-3.5" /></Link></div>
        </div>
      </header>

      <section className="marketing-hero marketing-container" id="main-content">
        <div className="marketing-hero-copy">
          <p className="marketing-kicker"><span />Your daily trading research workspace</p>
          <h1>Find your setup.<br />Understand<br className="marketing-desktop-break" /> <em>your risk.</em></h1>
          <p className="marketing-intro">Scan your watchlist, review the evidence, and see what could invalidate a setup. Keep your charts, optional AI trade ideas, and journal together so you can make your own informed decisions.</p>
          <div className="marketing-hero-actions"><Link href="/register" className="marketing-button">Create your account<ProductIcon name="arrow" className="h-4 w-4" /></Link><a href="#product-preview" className="marketing-text-link">Try the chart preview<span aria-hidden="true">↘</span></a></div>
          <p className="marketing-hero-caption"><ProductIcon name="check" className="h-3.5 w-3.5" />Scan your markets <span>·</span> Review your setups <span>·</span> Track your thinking</p>
        </div>
        <div id="product-preview" className="marketing-hero-preview"><MarketPreview /><p className="marketing-preview-caption">Explore the preview: switch markets or toggle the chart levels.</p></div>
      </section>

      <div className="marketing-principles"><div className="marketing-container"><span><ProductIcon name="chart" />Charts with context</span><span><ProductIcon name="layers" />Evidence behind the idea</span><span><ProductIcon name="shield" />A separate risk review</span><span><ProductIcon name="journal" />A record of your thinking</span></div></div>

      <section className="marketing-section marketing-container" id="features">
        <div className="marketing-section-heading"><div><p className="marketing-eyebrow">Top features for traders</p><h2>Find what matters.<br />Review it in one place.</h2></div><p>Spend less time switching tools. Follow your markets, compare setups, check the risks, and keep a record of your decisions.</p></div>
        <ul className="marketing-features">{features.map((feature, index) => <li key={feature.title}><div className="marketing-step-top"><ProductIcon name={feature.icon} className="h-6 w-6" /><span>0{index + 1}</span></div><h3>{feature.title}</h3><p>{feature.description}</p></li>)}</ul>
      </section>

      <section className="marketing-research" id="ai-research">
        <div className="marketing-container marketing-research-inner">
          <div className="marketing-research-copy"><p className="marketing-eyebrow">Optional AI trade ideas</p><h2>Know the levels.<br />See the reasons to wait.</h2><p>Review a proposed entry, stop, and targets alongside the evidence. See what would invalidate the idea, then read an independent risk assessment before making your decision.</p><ul><li><ProductIcon name="check" />Review ideas based on completed candles</li><li><ProductIcon name="check" />Check the reward-to-risk and conflicting evidence</li><li><ProductIcon name="check" />See WAIT when conditions do not qualify</li><li><ProductIcon name="check" />Revisit saved ideas and see when they expire</li></ul><Link href="/register" className="marketing-text-link">Start reviewing your setups<ProductIcon name="arrow" className="h-4 w-4" /></Link></div>
          <div className="marketing-agent-stack">
            <article className="marketing-agent"><div className="marketing-agent-heading"><span className="marketing-agent-icon"><ProductIcon name="sparkles" /></span><div><p>01 / Your AI idea</p><h3>Understand the setup.</h3></div><span className="marketing-agent-tag">Analyst</span></div><p>See a conditional paper setup with proposed price levels and the chart evidence behind it.</p><div className="marketing-agent-pills"><span>BUY</span><span>SELL</span><span>WAIT</span></div></article>
            <div className="marketing-agent-connector"><span />See the risk review<span /></div>
            <article className="marketing-agent"><div className="marketing-agent-heading"><span className="marketing-agent-icon"><ProductIcon name="shield" /></span><div><p>02 / Your risk check</p><h3>Understand the risks.</h3></div><span className="marketing-agent-tag">Reviewer</span></div><p>See where evidence conflicts, levels look weak, or conditions remain unclear, including reasons to wait.</p><div className="marketing-validation"><ProductIcon name="check" className="h-4 w-4" />Price checks · evidence checks · minimum 2:1</div></article>
            <p className="marketing-agent-footnote">AI ideas and risk reviews are available when enabled for your workspace. Use these conditional paper setups to support your research; outcomes are not guaranteed.</p>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-container marketing-notebook">
        <div className="marketing-journal-preview"><div className="marketing-journal-top"><ProductIcon name="journal" className="h-5 w-5" /><span>Research journal</span><span className="marketing-journal-tag">Sample note</span></div><div className="marketing-journal-entry"><span className="marketing-eyebrow">BTC / USD · 1h</span><h3>A good reason to wait.</h3><p>The setup looked promising, but the next candle did not confirm support. Kept the idea on watch and recorded what would change my view.</p><div><span>Observation saved</span><ProductIcon name="check" className="h-4 w-4" /></div></div><div className="marketing-journal-lines"><span /><span /><span /></div></div>
        <div><p className="marketing-eyebrow">Your journal & outcome review</p><h2>Record your reasoning.<br />Learn from each setup.</h2><p className="marketing-body-copy">Save why you considered a setup, what made you wait, and how it developed. Review your notes, paper plans, and observed outcomes together before your next research session.</p><Link href="/register" className="marketing-text-link">Start your research journal<ProductIcon name="arrow" className="h-4 w-4" /></Link></div>
      </section>

      <section className="marketing-section marketing-container marketing-faq" id="questions"><div><p className="marketing-eyebrow">Your questions answered</p><h2>Get to know<br />your workspace.</h2><a href="#features" className="marketing-text-link">Explore the features ↑</a></div><div>{questions.map((item) => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>

      <section className="marketing-container marketing-final"><div><p className="marketing-eyebrow">Make time for your next setup</p><h2>Bring your trading research<br />into one workspace.</h2></div><div><Link href="/register" className="marketing-button">Get started with {product.name}<ProductIcon name="arrow" className="h-4 w-4" /></Link><p>Your markets. Your research. Your decision.</p></div></section>
      <footer className="marketing-footer marketing-container"><Link href="/" className="marketing-brand"><BrandMark className="h-7 w-7" />{product.name}</Link><p>Market research and conditional paper setups. Not financial advice.</p><div><a href={product.repositoryUrl} target="_blank" rel="noreferrer">GitHub ↗</a><Link href="/login">Sign in</Link></div></footer>
    </main>
  );
}
