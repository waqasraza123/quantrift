"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

export function TerminalDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="qt-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close.current();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="qt-icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="qt-dialog-body">{children}</div>
    </dialog>
  );
}
