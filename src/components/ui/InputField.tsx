"use client";

import { useRef, type ChangeEvent, type FocusEvent, type HTMLAttributes, type Ref } from "react";
import { useCtaResonance } from "./useCtaResonance";
import styles from "./InputField.module.css";

// A glass field box: the label sits above the value, the placeholder shows
// while it is empty. The box lifts on hover, takes a sheen and a pale ring on
// focus, and leans a little toward the pointer. An error message, when given,
// is rendered under the box and tied to the input for screen readers.

export type InputFieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url" | "search";
  required?: boolean;
  /** Error styling without a message. */
  hasError?: boolean;
  /** Error message shown under the box; also sets the error styling. */
  error?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  spellCheck?: boolean;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
  /** Class for the box. */
  className?: string;
  /** Class for the error message. */
  errorClassName?: string;
};

export function InputField({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  hasError = false,
  error,
  autoComplete,
  inputMode,
  pattern,
  minLength,
  maxLength,
  spellCheck,
  onBlur,
  inputRef,
  className = "",
  errorClassName = "",
}: InputFieldProps) {
  const ref = useRef<HTMLDivElement>(null);
  useCtaResonance(ref, { maxShift: 4.5, maxRotate: 1.4, maxGlow: 0.14, pressKeys: false });

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
        <input
          ref={inputRef}
          className={styles.input}
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          pattern={pattern}
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
