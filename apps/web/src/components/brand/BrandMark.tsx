import { cn } from "@/lib/ui/cn";

type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", className)} aria-hidden="true">
      <svg className="h-full w-full" fill="none" viewBox="0 0 48 48">
        <path d="M23.9 5.5 42.5 24 24 42.5 5.5 24 23.9 5.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="6" />
        <path d="m12.5 33.8 23-23" stroke="#ff7658" strokeLinecap="round" strokeWidth="6" />
      </svg>
    </span>
  );
}
