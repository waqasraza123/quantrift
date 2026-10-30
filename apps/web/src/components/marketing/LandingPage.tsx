import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { ProductIcon, type ProductIconName } from "@/components/ui/ProductIcon";
import { getProductConfig } from "@/config/product";
import { MarketPreview } from "./MarketPreview";

const workflow: { title: string; description: string; icon: ProductIconName }[] = [
  { title: "Find your focus", description: "Follow the symbols that matter to you and scan for setups worth a closer look.", icon: "scanner" },
  { title: "Read the chart", description: "See the candles, market structure, and evidence behind each setup in one place.", icon: "chart" },
  { title: "Get another perspective", description: "Ask AI for a conditional setup. Read the reasoning and the independent risk review.", icon: "sparkles" },
  { title: "Keep a record", description: "Save your observations and come back to see how the setup developed.", icon: "journal" },
];

const questions = [
  { question: "What does the AI actually suggest?", answer: "When enabled, an analyst proposes BUY, SELL, or WAIT from stored closed candles. BUY describes a long setup; SELL describes a short setup. An independent risk reviewer challenges the proposal, and code checks the prices and minimum 2:1 reward-to-risk before the result is shown." },
  { question: "Does QuantRift place trades?", answer: "No. QuantRift is a research workspace. It provides charts, evidence, conditional paper setups, and a journal. You make your own decisions; there is no broker execution or automatic order placement." },
  { question: "Is the preview showing live prices?", answer: "The preview on this page uses illustrative sample data. Inside your workspace, timestamps and data-quality checks show which stored candles each assessment uses. New data can make an earlier suggestion outdated." },
  { question: "What do I need to get started?", answer: "Create a workspace, choose symbols, and connect or import candle data. Self-hosted deployments need the API and database running. AI suggestions additionally require a server-side OpenAI key and the suggestion worker; your administrator can enable them." },
];

export function LandingPage() {
  const product = getProductConfig();
  return (
    <main className="marketing-page">
      <a href="#main-content" className="marketing-skip">Skip to content</a>
      <header className="marketing-nav">
        <div className="marketing-container marketing-nav-inner">
          <Link href="/" className="marketing-brand" aria-label={`${product.name} home`}><BrandMark className="h-8 w-8" />{product.name}</Link>
          <nav aria-label="Homepage navigation" className="marketing-links"><a href="#workflow">How it works</a><a href="#ai-research">AI research</a><a href="#questions">Questions</a></nav>
          <div className="marketing-nav-actions"><Link href="/login" className="marketing-signin">Sign in</Link><Link href="/register" className="marketing-button marketing-button-small">Get started<ProductIcon name="arrow" className="h-3.5 w-3.5" /></Link></div>
        </div>
      </header>

      <section className="marketing-hero marketing-container" id="main-content">
        <div className="marketing-hero-copy">
          <p className="marketing-kicker"><span />A clearer view of your next setup</p>
          <h1>See the setup.<br />Understand<br className="marketing-desktop-break" /> <em>the why.</em></h1>
          <p className="marketing-intro">Your charts, market evidence, and AI trade ideas in one focused workspace. Spend less time sorting through signals and more time understanding them.</p>
          <div className="marketing-hero-actions"><Link href="/register" className="marketing-button">Create your workspace<ProductIcon name="arrow" className="h-4 w-4" /></Link><a href="#product-preview" className="marketing-text-link">Take a closer look<span aria-hidden="true">↘</span></a></div>
          <p className="marketing-hero-caption"><ProductIcon name="check" className="h-3.5 w-3.5" />Open source <span>·</span> Evidence you can inspect <span>·</span> Your decision</p>
        </div>
        <div id="product-preview" className="marketing-hero-preview"><MarketPreview /><p className="marketing-preview-caption">Explore the preview: switch markets or toggle the chart levels.</p></div>
      </section>

      <div className="marketing-principles"><div className="marketing-container"><span><ProductIcon name="chart" />Charts with context</span><span><ProductIcon name="layers" />Evidence behind the idea</span><span><ProductIcon name="shield" />A separate risk review</span><span><ProductIcon name="journal" />A record of your thinking</span></div></div>

      <section className="marketing-section marketing-container" id="workflow">
        <div className="marketing-section-heading"><div><p className="marketing-eyebrow">A simpler research routine</p><h2>From market noise<br />to a considered decision.</h2></div><p>One connected workflow. Start with a watchlist, look closer at a setup, and keep the reasoning alongside your notes.</p></div>
        <ol className="marketing-workflow">{workflow.map((step, index) => <li key={step.title}><div className="marketing-step-top"><ProductIcon name={step.icon} className="h-6 w-6" /><span>0{index + 1}</span></div><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>
      </section>

      <section className="marketing-research" id="ai-research">
        <div className="marketing-container marketing-research-inner">
          <div className="marketing-research-copy"><p className="marketing-eyebrow">AI that shows its work</p><h2>An idea is only as useful<br />as the reasoning behind it.</h2><p>Go beyond a directional label. See the proposed entry, stop, targets, and what would invalidate the idea. Then read a second agent’s assessment before deciding what to do.</p><ul><li><ProductIcon name="check" />Based on your stored closed candles</li><li><ProductIcon name="check" />Independent analyst and risk reviewer</li><li><ProductIcon name="check" />WAIT when a setup does not qualify</li><li><ProductIcon name="check" />Saved context, timestamps, and expiry</li></ul><Link href="/register" className="marketing-text-link">Make room for a better research process<ProductIcon name="arrow" className="h-4 w-4" /></Link></div>
          <div className="marketing-agent-stack">
            <article className="marketing-agent"><div className="marketing-agent-heading"><span className="marketing-agent-icon"><ProductIcon name="sparkles" /></span><div><p>01 / Analyst</p><h3>Build the case.</h3></div><span className="marketing-agent-tag">Propose</span></div><p>Read the candles and technical context. Propose a conditional setup with specific levels and evidence references.</p><div className="marketing-agent-pills"><span>BUY</span><span>SELL</span><span>WAIT</span></div></article>
            <div className="marketing-agent-connector"><span />Then challenge it<span /></div>
            <article className="marketing-agent"><div className="marketing-agent-heading"><span className="marketing-agent-icon"><ProductIcon name="shield" /></span><div><p>02 / Risk reviewer</p><h3>Question the case.</h3></div><span className="marketing-agent-tag">Review</span></div><p>Look for conflicting evidence, weak levels, and unclear conditions. Approve, request a revision, or recommend waiting.</p><div className="marketing-validation"><ProductIcon name="check" className="h-4 w-4" />Price checks · evidence checks · minimum 2:1</div></article>
            <p className="marketing-agent-footnote">AI suggestions are optional and require backend configuration. These are conditional paper setups, not guaranteed outcomes.</p>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-container marketing-notebook">
        <div className="marketing-journal-preview"><div className="marketing-journal-top"><ProductIcon name="journal" className="h-5 w-5" /><span>Research journal</span><span className="marketing-journal-tag">Sample note</span></div><div className="marketing-journal-entry"><span className="marketing-eyebrow">BTC / USD · 1h</span><h3>A good reason to wait.</h3><p>The setup looked promising, but the next candle did not confirm support. Kept the idea on watch and recorded what would change my view.</p><div><span>Observation saved</span><ProductIcon name="check" className="h-4 w-4" /></div></div><div className="marketing-journal-lines"><span /><span /><span /></div></div>
        <div><p className="marketing-eyebrow">Close the loop</p><h2>Keep the thinking.<br />Learn from the follow-through.</h2><p className="marketing-body-copy">The useful part of a research session should not disappear when you close a tab. Keep your notes, paper plans, and observed outcomes together so the next review starts with context.</p><Link href="/register" className="marketing-text-link">Start your research journal<ProductIcon name="arrow" className="h-4 w-4" /></Link></div>
      </section>

      <section className="marketing-section marketing-container marketing-faq" id="questions"><div><p className="marketing-eyebrow">A few useful answers</p><h2>Know what’s<br />behind the workspace.</h2><a href={product.repositoryUrl} className="marketing-text-link" target="_blank" rel="noreferrer">Explore the source code ↗</a></div><div>{questions.map((item) => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>

      <section className="marketing-container marketing-final"><div><p className="marketing-eyebrow">Less noise. More context.</p><h2>Your next idea deserves<br />a closer look.</h2></div><div><Link href="/register" className="marketing-button">Get started with {product.name}<ProductIcon name="arrow" className="h-4 w-4" /></Link><p>Built for research. Decisions stay with you.</p></div></section>
      <footer className="marketing-footer marketing-container"><Link href="/" className="marketing-brand"><BrandMark className="h-7 w-7" />{product.name}</Link><p>Market research and conditional paper setups. Not financial advice.</p><div><a href={product.repositoryUrl} target="_blank" rel="noreferrer">GitHub ↗</a><Link href="/login">Sign in</Link></div></footer>
    </main>
  );
}
