"use client";

import { useId, useState, type ChangeEvent, type CSSProperties, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/InputField";
import { CONTACT, CONTACT_EMAIL } from "@/lib/content";
import { rise } from "./blockReveal";
import styles from "./ContactForm.module.css";

// The contact form. Nothing is posted anywhere: a valid submit writes a
// mailto: link and hands it to the visitor's own mail client, which decides
// whether anything is sent.

type Field = "name" | "email" | "message";
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;

export type ContactFormReveal = {
  /** Eased 0..1 per row, in reading order. */
  name: number;
  email: number;
  message: number;
  submit: number;
};

type ContactFormProps = {
  reveal: ContactFormReveal;
  reduced?: boolean;
};

const FIELDS: Field[] = ["name", "email", "message"];
const SUBJECT = "ClearSign: what it missed";
// A local part, an @, a domain and a dot-TLD of two or more characters.
const EMAIL_PATTERN = "[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}";
// At least one character that is not whitespace.
const NOT_BLANK = ".*\\S.*";

type FormControl = HTMLInputElement | HTMLTextAreaElement;

// Constraint validation decides; the site's copy words it. A blank name fails
// its pattern, which reads as missing; a malformed email fails its type or pattern.
function errorFor(control: FormControl): string | undefined {
  const v = control.validity;
  if (v.valid) return undefined;
  if (v.valueMissing) return CONTACT.errors.required;
  if (control.type === "email") return CONTACT.errors.email;
  return CONTACT.errors.required;
}

function mailtoHref({ name, email, message }: Values) {
  const body = [
    `${CONTACT.fields.name.label}: ${name}`,
    `${CONTACT.fields.email.label}: ${email}`,
    "",
    message,
  ].join("\r\n");
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`;
}

export function ContactForm({ reveal, reduced = false }: ContactFormProps) {
  const uid = useId();
  const [values, setValues] = useState<Values>({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  const idFor = (field: Field) => `${uid}-${field}`;

  const handleChange = (field: Field) => (event: ChangeEvent<FormControl>) => {
    const control = event.currentTarget;
    setValues((prev) => ({ ...prev, [field]: control.value }));
    setSent(false);
    // Once a field has shown an error, it re-checks as it is edited.
    if (errors[field] !== undefined) {
      setErrors((prev) => ({ ...prev, [field]: errorFor(control) }));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const next: Errors = {};
    let firstInvalid: FormControl | null = null;
    for (const field of FIELDS) {
      const control = form.elements.namedItem(field) as FormControl | null;
      const error = control ? errorFor(control) : undefined;
      if (!control || !error) continue;
      next[field] = error;
      firstInvalid ??= control;
    }
    setErrors(next);
    if (firstInvalid) {
      setSent(false);
      firstInvalid.focus();
      return;
    }
    const trimmed: Values = {
      name: values.name.trim(),
      email: values.email.trim(),
      message: values.message.trim(),
    };
    window.location.href = mailtoHref(trimmed);
    setSent(true);
  };

  const cellStyle = (show: number, offsetY: number): CSSProperties => rise(show, offsetY, reduced);

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <div className={styles.row}>
        <div className={styles.cell} style={cellStyle(reveal.name, 24)}>
          <InputField
            id={idFor("name")}
            name="name"
            type="text"
            label={CONTACT.fields.name.label}
            placeholder={CONTACT.fields.name.placeholder}
            value={values.name}
            onChange={handleChange("name")}
            required
            pattern={NOT_BLANK}
            autoComplete="name"
            error={errors.name}
            className={styles.field}
          />
        </div>
        <div className={styles.cell} style={cellStyle(reveal.email, 24)}>
          <InputField
            id={idFor("email")}
            name="email"
            type="email"
            label={CONTACT.fields.email.label}
            placeholder={CONTACT.fields.email.placeholder}
            value={values.email}
            onChange={handleChange("email")}
            required
            pattern={EMAIL_PATTERN}
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            error={errors.email}
            className={styles.field}
          />
        </div>
      </div>

      <div className={`${styles.cell} ${styles.wide}`} style={cellStyle(reveal.message, 28)}>
        <InputField
          id={idFor("message")}
          name="message"
          type="text"
          label={CONTACT.fields.message.label}
          placeholder={CONTACT.fields.message.placeholder}
          value={values.message}
          onChange={handleChange("message")}
          autoComplete="off"
          error={errors.message}
          className={styles.field}
        />
      </div>

      <div
        className={styles.submit}
        style={{
          opacity: reveal.submit,
          clipPath: `inset(0 ${((1 - reveal.submit) * 100).toFixed(2)}% 0 0)`,
        }}
      >
        <Button label={CONTACT.submit} type="submit" variant="accent" cursorLabel={CONTACT.submitCursor} />
        <p className={styles.status} role="status">
          {sent ? CONTACT.sentNote : ""}
        </p>
      </div>
    </form>
  );
}
