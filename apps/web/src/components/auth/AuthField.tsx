"use client";

import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import styles from "./auth.module.css";

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  error?: string;
  help?: string;
};

export function AuthField({ label, error, help, id, ...props }: AuthFieldProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const descriptionId = `${inputId}-description`;
  return (
    <div>
      <label className={styles.field} htmlFor={inputId}>
        {label}
        <input {...props} id={inputId} aria-invalid={Boolean(error)} aria-describedby={error || help ? descriptionId : undefined} />
      </label>
      {(error || help) && <p id={descriptionId} className={error ? styles.fieldError : styles.fieldHelp}>{error || help}</p>}
    </div>
  );
}
