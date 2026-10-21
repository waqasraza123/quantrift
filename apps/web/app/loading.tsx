import { BrandMark } from "@/components/brand/BrandMark";

export default function AppLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#061416] px-6 text-white">
      <div className="flex items-center gap-3" role="status" aria-label="Loading QuantRift">
        <BrandMark className="h-10 w-10 text-white" />
        <div>
          <p className="text-base font-black tracking-[-0.02em]">QuantRift</p>
          <p className="mt-0.5 text-xs font-medium text-white/45">Loading secure workspace…</p>
        </div>
      </div>
    </main>
  );
}
