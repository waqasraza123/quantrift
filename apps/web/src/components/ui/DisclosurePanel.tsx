import type { ReactNode } from "react";

export function DisclosurePanel({ title, description, children, open = false, id }: {
  title: string;
  description?: string;
  children: ReactNode;
  open?: boolean;
  id?: string;
}) {
  return (
    <details id={id} open={open} className="group rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold text-[var(--strong)]">{title}</span>
          {description && <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{description}</span>}
        </span>
        <span aria-hidden="true" className="text-xl text-[var(--muted)] transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="space-y-5 border-t border-[var(--line)] p-4 sm:p-5">{children}</div>
    </details>
  );
}
