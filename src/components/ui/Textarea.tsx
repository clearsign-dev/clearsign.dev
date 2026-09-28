"use client";

import { useRef, type ChangeEvent, type FocusEvent, type Ref } from "react";
import { useCtaResonance } from "./useCtaResonance";
import styles from "./Textarea.module.css";

// The multi-line sibling of InputField: the same glass box, with the label on
// top and a fixed-height, non-resizable text area filling the rest.

export type TextareaProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  hasError?: boolean;
  /** Error message shown under the box; also sets the error styling. */
  error?: string;
  minLength?: number;
  maxLength?: number;
  spellCheck?: boolean;
  onBlur?: (event: FocusEvent<HTMLTextAreaElement>) => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
  className?: string;
  errorClassName?: string;
};

export function Textarea({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  required,
  hasError = false,
  error,
  minLength,
  maxLength,
  spellCheck,
  onBlur,
  textareaRef,
  className = "",
  errorClassName = "",
}: TextareaProps) {
  const ref = useRef<HTMLDivElement>(null);
  useCtaResonance(ref, { maxShift: 4.5, maxRotate: 1.3, maxGlow: 0.14, pressKeys: false });

  const invalid = hasError || Boolean(error);
  const errorId = `${id}-error`;

  return (
    <>
      <div
        ref={ref}
        className={`${styles.field} ${className}`}
        data-filled={value ? "" : undefined}
        data-error={invalid ? "" : undefined}
      >
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          spellCheck={spellCheck}
          aria-invalid={invalid || undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      {error ? (
        <p id={errorId} className={`${styles.error} ${errorClassName}`}>
          {error}
        </p>
      ) : null}
    </>
  );
}
