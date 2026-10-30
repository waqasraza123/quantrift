import type { ReactNode } from "react";

export function WorkspaceStats({ items }: { items: { label: string; value: ReactNode; detail?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 divide-x divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] sm:flex">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 flex-1 px-5 py-4">
          <dt className="text-xs text-[var(--muted)]">{item.label}</dt>
          <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--strong)]">
            {item.value}
            {item.detail && <span className="mt-1 block text-[11px] font-normal tracking-normal text-[var(--muted)]">{item.detail}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
