"use client";

import { useEffect, useRef } from "react";

export function ResizeHandle({
  axis,
  value,
  min,
  max,
  label,
  onChange,
  reverse = false,
}: {
  axis: "horizontal" | "vertical";
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
  reverse?: boolean;
}) {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={axis === "horizontal" ? "vertical" : "horizontal"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      className={`qt-resize qt-resize-${axis}`}
      onKeyDown={(event) => {
        if (
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
            event.key,
          )
        )
          return;
        event.preventDefault();
        const direction = ["ArrowRight", "ArrowDown"].includes(event.key)
          ? 1
          : -1;
        onChange(clamp(value + direction * (reverse ? -1 : 1) * 20));
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        cleanup.current?.();
        const start = axis === "horizontal" ? event.clientX : event.clientY;
        const move = (moveEvent: PointerEvent) =>
          onChange(
            clamp(
              value +
                ((axis === "horizontal"
                  ? moveEvent.clientX
                  : moveEvent.clientY) -
                  start) *
                  (reverse ? -1 : 1),
            ),
          );
        const end = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", end);
          window.removeEventListener("pointercancel", end);
        };
        cleanup.current = end;
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
      }}
    />
  );
}
