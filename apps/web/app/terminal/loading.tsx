import { BrandMark } from "@/components/brand/BrandMark";

export default function TerminalLoading() {
  return (
    <main
      className="flex min-h-screen items-center justify-center gap-3 bg-[#101720] text-[#dbe4ee]"
      role="status"
    >
      <BrandMark className="h-8 w-8" />
      <span>Opening your research terminal…</span>
    </main>
  );
}
