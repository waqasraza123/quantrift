import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { getProductConfig } from "@/config/product";

const capabilities = [
  {
    index: "01",
    title: "See what matters",
    description: "Turn noisy market data into ranked, review-ready setups.",
    icon: <SignalIcon key="signal" />,
  },
  {
    index: "02",
    title: "Trust the evidence",
    description: "Trace every signal to its data, context, and quality checks.",
    icon: <EvidenceIcon key="evidence" />,
  },
  {
    index: "03",
    title: "Stay in control",
    description: "Use AI for research and paper plans while decisions stay human.",
    icon: <ControlIcon key="control" />,
  },
];

const workflow = ["Ingest market data", "Rank the signal", "Review the evidence", "Make the call"];

export function LandingPage() {
  const product = getProductConfig();

  return (
    <main className="landing-grid min-h-screen overflow-hidden bg-[#061416] text-[#f7fbfa]">
      <div className="landing-glow pointer-events-none fixed inset-0" />

      <header className="relative z-20 border-b border-white/10 bg-[#061416]/80 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-20 max-w-[88rem] items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link className="flex items-center gap-3 text-base font-black tracking-[-0.02em]" href="/">
            <BrandMark className="h-9 w-9 text-[#dff7f2] drop-shadow-[0_0_18px_rgba(103,232,213,0.24)]" />
            <span>{product.name}</span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Primary navigation">
            <Link className="rounded-full px-4 py-2.5 text-sm font-bold text-white/65 transition hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-[#67e8d5]" href="/login">Sign in</Link>
            <Link className="rounded-full bg-[#ff7658] px-5 py-2.5 text-sm font-black text-white shadow-[0_0_35px_rgba(255,118,88,0.2)] transition hover:-translate-y-0.5 hover:bg-[#ff8c73] focus-visible:ring-4 focus-visible:ring-[#ff7658]/30" href="/register">Get started</Link>
          </nav>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-[88rem] px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:px-10 lg:pb-24 lg:pt-24">
        <div className="grid gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <div className="motion-reveal motion-reveal-up">
            <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-[#67e8d5]/35 bg-[#67e8d5]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#9cf2e6]">
              <span className="h-2 w-2 rounded-full bg-[#ff7658] shadow-[0_0_14px_#ff7658]" />
              Quantitative market intelligence
            </div>
            <h1 className="max-w-3xl text-[clamp(3.5rem,7vw,7.5rem)] font-black leading-[0.84] tracking-[-0.075em] text-white">
              Find the signal.
              <span className="mt-2 block bg-gradient-to-r from-[#ff7658] via-[#f8e5cf] to-[#67e8d5] bg-clip-text text-transparent">Review the evidence.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg font-medium leading-8 text-white/58 sm:text-xl">QuantRift turns market data into clear, evidence-backed setups for faster, more disciplined research.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-[#ff7658] px-6 text-sm font-black text-white shadow-[0_18px_60px_rgba(255,118,88,0.16)] transition hover:-translate-y-0.5 hover:bg-[#ff8c73] focus-visible:ring-4 focus-visible:ring-[#ff7658]/30" href="/register">Start researching <ArrowIcon /></Link>
              <Link className="inline-flex min-h-13 items-center justify-center rounded-full border border-white/15 bg-white/[0.055] px-6 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-[#67e8d5]/70 hover:bg-[#67e8d5]/10 focus-visible:ring-4 focus-visible:ring-[#67e8d5]/30" href="/demo">Explore the demo</Link>
            </div>
            <div className="mt-8 grid max-w-xl grid-cols-3 border-y border-white/10 py-5 text-xs font-bold uppercase tracking-[0.12em] text-white/42">
              <span>Evidence-backed</span>
              <span className="border-x border-white/10 px-4 text-center">Human-reviewed</span>
              <span className="text-right">No broker execution</span>
            </div>
          </div>

          <ProductShowcase />
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-[#0d0e19]/80">
        <div className="mx-auto grid max-w-[88rem] md:grid-cols-3">
          {capabilities.map(({ index, title, description, icon }, capabilityIndex) => (
            <article className={`group relative min-h-72 overflow-hidden px-7 py-9 sm:px-9 ${capabilityIndex < capabilities.length - 1 ? "border-b border-white/10 md:border-b-0 md:border-r" : ""}`} key={title}>
              <span className="absolute right-5 top-1 text-8xl font-black tracking-[-0.08em] text-white/[0.035] transition group-hover:text-[#67e8d5]/10">{index}</span>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0b4b4d] text-[#8ff1e3] shadow-[0_0_38px_rgba(103,232,213,0.18)]">{icon}</div>
              <p className="mt-12 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff8b72]">Signal layer {index}</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">{title}</h2>
              <p className="mt-3 max-w-sm text-base font-medium leading-7 text-white/50">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-[88rem] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-10 lg:py-28">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#f5f4ef] p-2 shadow-[0_36px_100px_rgba(0,0,0,0.3)]">
          <Image
            alt="QuantRift evidence analysis interface with a magnifying glass over market signals"
            className="h-auto w-full rounded-[1.5rem]"
            height={941}
            sizes="(max-width: 1024px) 100vw, 60vw"
            src="/quantrift-evidence.png"
            width={1672}
          />
        </div>
        <div className="lg:pl-4">
          <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-[#ff8b72]">Evidence before action</p>
          <h2 className="mt-5 text-4xl font-black leading-[0.96] tracking-[-0.055em] text-white sm:text-6xl">Signal over noise.</h2>
          <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-white/52">Inspect the context behind each setup, surface data-quality concerns, and keep the final decision with the reviewer.</p>
          <div className="mt-8 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em] text-[#9cf2e6]">
            <span className="rounded-full border border-[#67e8d5]/25 bg-[#67e8d5]/10 px-4 py-2">Traceable evidence</span>
            <span className="rounded-full border border-[#67e8d5]/25 bg-[#67e8d5]/10 px-4 py-2">Quality checks</span>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-[88rem] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.74fr_1.26fr] lg:items-end">
          <div>
            <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-[#67e8d5]">A sharper research loop</p>
            <h2 className="mt-5 max-w-xl text-4xl font-black leading-[0.96] tracking-[-0.055em] text-white sm:text-6xl">One clear view of the market.</h2>
          </div>
          <p className="max-w-2xl text-lg font-medium leading-8 text-white/52 lg:justify-self-end">Monitor data quality, prioritize opportunities, inspect supporting evidence, and record your review in one decisive workspace.</p>
        </div>
        <ol className="mt-14 grid overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] sm:grid-cols-2 lg:grid-cols-4">
          {workflow.map((step, index) => (
            <li className={`relative p-7 ${index < workflow.length - 1 ? "border-b border-white/10 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r" : ""}`} key={step}>
              <span className="font-mono text-xs font-black text-[#ff8b72]">0{index + 1}</span>
              <p className="mt-8 text-lg font-black tracking-[-0.025em] text-white">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="relative z-10 px-5 pb-20 sm:px-8 lg:px-10 lg:pb-28">
        <div className="relative mx-auto max-w-[88rem] overflow-hidden rounded-[2.5rem] bg-[#dff7f2] px-6 py-14 text-[#082b2e] sm:px-10 lg:flex lg:items-end lg:justify-between lg:px-16 lg:py-16">
          <div className="absolute -right-16 -top-28 h-80 w-80 rounded-full border-[60px] border-[#ff7658]/25" />
          <div className="relative max-w-3xl">
            <p className="font-mono text-xs font-black uppercase tracking-[0.2em]">The market moves fast. Your process should be clear.</p>
            <h2 className="mt-5 text-4xl font-black leading-[0.94] tracking-[-0.055em] sm:text-6xl">Research with context. Decide with conviction.</h2>
          </div>
          <Link className="relative mt-9 inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-[#ff7658] px-7 text-sm font-black text-white shadow-[0_20px_60px_rgba(7,8,17,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0b4b4d] lg:mt-0" href="/register">Create your workspace <ArrowIcon /></Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 bg-[#05060c]">
        <div className="mx-auto flex max-w-[88rem] flex-col gap-5 px-5 py-9 text-sm font-medium text-white/42 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div className="flex items-center gap-3 font-black text-white"><BrandMark className="h-9 w-9 text-[#dff7f2]" /><span>{product.name}</span></div>
          <p>Market intelligence for human decision-making. Not financial advice.</p>
          <Link className="w-fit font-bold transition hover:text-[#ff8b72]" href="/login">Sign in</Link>
        </div>
      </footer>
    </main>
  );
}

function ProductShowcase() {
  return (
    <div className="motion-reveal motion-reveal-scale relative mx-auto w-full max-w-4xl [animation-delay:140ms]">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-[#67e8d5]/14 blur-3xl" />
      <div className="absolute -left-3 -top-4 z-10 rounded-full bg-[#ff7658] px-4 py-2 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_12px_30px_rgba(255,118,88,0.2)] sm:-left-5">Research intelligence</div>
      <div className="absolute -bottom-5 right-3 z-10 rounded-2xl border border-white/15 bg-[#121420]/92 px-4 py-3 shadow-2xl backdrop-blur-xl sm:right-7">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">Decision model</p>
        <p className="mt-1 text-sm font-black text-[#67e8d5]">Human approval required</p>
      </div>
      <div className="overflow-hidden rounded-[1.7rem] border border-white/15 bg-[#0d101b] p-2 shadow-[0_40px_120px_rgba(0,0,0,0.58)] sm:rounded-[2rem] sm:p-3">
        <Image
          alt="QuantRift agentic market intelligence observatory with market research cards"
          className="h-auto w-full rounded-[1.25rem] border border-white/10"
          height={941}
          priority
          sizes="(max-width: 1024px) 100vw, 58vw"
          src="/quantrift-observatory.png"
          width={1672}
        />
      </div>
      <p className="mt-4 text-right font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Illustrative demo data · paper-only workflow</p>
    </div>
  );
}

function SignalIcon() {
  return <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24"><path d="M4 16l4-5 4 3 7-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /><path d="M16 6h3v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
}

function EvidenceIcon() {
  return <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24"><path d="M8 4h8l3 3v13H5V4h3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" /><path d="M9 11h6M9 15h4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
}

function ControlIcon() {
  return <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" /><path d="m9 12 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
}

function ArrowIcon(): ReactNode {
  return <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>;
}
