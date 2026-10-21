import Link from "next/link";
import type { ReactNode } from "react";
import { getProductConfig } from "@/config/product";

const capabilities = [
  ["See what matters", "Turn market data into ranked, review-ready setups.", <SignalIcon key="signal" />],
  ["Trust the evidence", "Trace every signal to its data, context, and quality checks.", <EvidenceIcon key="evidence" />],
  ["Stay in control", "Use AI for research and paper plans while decisions stay human.", <ControlIcon key="control" />],
];

export function LandingPage() {
  const product = getProductConfig();

  return (
    <main className="landing-grid min-h-screen overflow-hidden bg-[#050811] text-slate-100">
      <div className="landing-glow pointer-events-none fixed inset-0" />
      <header className="relative z-20 border-b border-white/10 bg-[#050811]/85 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link className="flex items-center gap-3 font-semibold tracking-tight" href="/"><BrandMark /><span>{product.name}</span></Link>
          <nav className="flex items-center gap-2" aria-label="Primary navigation">
            <Link className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white" href="/login">Sign in</Link>
            <Link className="rounded-lg bg-teal-300 px-3.5 py-2 text-sm font-bold text-slate-950 transition hover:bg-teal-200" href="/register">Get started</Link>
          </nav>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1fr_0.95fr] lg:items-center lg:pb-28">
        <div className="motion-reveal motion-reveal-up">
          <p className="mb-5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Quantitative market intelligence</p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">Find the signal.<br />Review the evidence.</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">QuantRift turns market data into clear, evidence-backed setups for faster, more disciplined research.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-300 px-5 text-sm font-bold text-slate-950 shadow-[0_18px_60px_rgba(45,212,191,0.2)] transition hover:-translate-y-0.5 hover:bg-teal-200" href="/register">Start researching <ArrowIcon /></Link>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-bold text-white transition hover:border-white/30 hover:bg-white/10" href="/demo">Explore the demo</Link>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-500">
            <span>Evidence-backed</span><span aria-hidden="true">·</span><span>Human-reviewed</span><span aria-hidden="true">·</span><span>No broker execution</span>
          </div>
        </div>
        <DashboardPreview />
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-px bg-white/10 sm:grid-cols-3">
          {capabilities.map(([title, description, icon]) => (
            <article className="bg-[#070b14] px-6 py-8 sm:px-8" key={title as string}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-300/20 bg-teal-300/5 text-teal-300">{icon}</div>
              <h2 className="mt-5 text-xl font-semibold tracking-tight text-white">{title}</h2>
              <p className="mt-2 max-w-sm leading-6 text-slate-400">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 lg:py-28">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Your research command center</p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">One clear view of the market.</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-400">Monitor data quality, prioritize opportunities, inspect supporting evidence, and record your review in one workspace.</p>
        <Link className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-300 px-6 text-sm font-bold text-slate-950 transition hover:bg-teal-200" href="/register">Create your workspace <ArrowIcon /></Link>
      </section>

      <footer className="relative z-10 border-t border-white/10 bg-[#03050a]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-slate-300"><BrandMark /><span>{product.name}</span></div>
          <p>Market intelligence for human decision-making. Not financial advice.</p>
          <Link className="w-fit hover:text-white" href="/login">Sign in</Link>
        </div>
      </footer>
    </main>
  );
}

function DashboardPreview() {
  return (
    <div className="motion-reveal motion-reveal-scale relative mx-auto w-full max-w-xl [animation-delay:140ms]">
      <div className="absolute -inset-10 -z-10 bg-[radial-gradient(circle,rgba(45,212,191,0.12),transparent_65%)]" />
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#080d17]/95 shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" /><span className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-400">Market overview · Illustrative</span></div>
          <span className="font-mono text-[10px] text-slate-600">UTC 09:42</span>
        </div>
        <div className="grid grid-cols-3 gap-px bg-white/10">
          <PreviewMetric label="Readiness" value="92%" tone="text-emerald-300" />
          <PreviewMetric label="Review first" value="07" tone="text-white" />
          <PreviewMetric label="Data health" value="GOOD" tone="text-teal-300" />
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="mb-4 flex items-center justify-between"><span className="text-xs font-semibold text-slate-300">BTC / USD · 15m</span><span className="text-[10px] text-emerald-300">+2.41%</span></div>
            <CandleChart />
          </div>
          <div className="space-y-2">
            {["Evidence aligned", "Data is current", "Review required"].map((item, index) => (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3" key={item}>
                <div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${index === 2 ? "bg-amber-300" : "bg-teal-300"}`} /><span className="text-[10px] font-semibold text-slate-300">{item}</span></div>
                <div className="mt-2 h-1 rounded-full bg-white/10"><div className="h-1 rounded-full bg-teal-300/60" style={{ width: `${86 - index * 17}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-3 font-mono text-[10px] text-slate-500">Signal · evidence · human review</div>
      </div>
    </div>
  );
}

function CandleChart() {
  const candles = [38, 52, 44, 65, 58, 76, 62, 84, 73, 91, 82, 100, 88, 110];
  return (
    <div className="relative flex h-40 items-end justify-between gap-1 overflow-hidden rounded-lg bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:28px_28px] px-2 pb-3">
      <div className="absolute inset-x-0 top-[38%] border-t border-dashed border-teal-300/20" />
      {candles.map((height, index) => {
        const positive = index === 0 || height >= candles[index - 1];
        return <span className={`relative w-2 rounded-sm ${positive ? "bg-teal-300" : "bg-rose-400"} opacity-90 before:absolute before:left-1/2 before:top-[-9px] before:h-[calc(100%+18px)] before:w-px before:-translate-x-1/2 before:bg-current before:opacity-50`} key={`${height}-${index}`} style={{ height }} />;
      })}
    </div>
  );
}

function PreviewMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="bg-[#080d17] p-4"><p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">{label}</p><p className={`mt-2 text-lg font-semibold ${tone}`}>{value}</p></div>;
}

function BrandMark() {
  return <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-teal-300/30 bg-teal-300/10 text-teal-200"><svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M3 17h4l3-9 4 6 3-9h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg></span>;
}

function SignalIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M4 16l4-5 4 3 7-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /><path d="M16 6h3v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function EvidenceIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M8 4h8l3 3v13H5V4h3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="M9 11h6M9 15h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function ControlIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="m9 12 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function ArrowIcon(): ReactNode {
  return <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
}
