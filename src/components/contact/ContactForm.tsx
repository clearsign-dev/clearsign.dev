"use client";

import { Button } from "@/components/ui/Button";
import { CONTACT, ISSUES_URL, SECURITY_URL } from "@/lib/content";
import { rise } from "./blockReveal";
import styles from "./ContactForm.module.css";

export type ContactFormReveal = {
  name: number;
  email: number;
  message: number;
  submit: number;
};

type ContactFormProps = {
  reveal: ContactFormReveal;
  reduced?: boolean;
};

export function ContactForm({ reveal, reduced = false }: ContactFormProps) {
  return (
    <div className={styles.form}>
      <div className={`${styles.cell} ${styles.wide}`} style={rise(reveal.name, 24, reduced)}>
        <Button label={CONTACT.issueLabel} href={ISSUES_URL} variant="accent" cursorLabel="GitHub" />
        <p className={styles.status}>{CONTACT.issueNote}</p>
      </div>
      <div className={`${styles.cell} ${styles.wide}`} style={rise(reveal.message, 28, reduced)}>
        <Button label={CONTACT.securityLabel} href={SECURITY_URL} cursorLabel="Private report" />
        <p className={styles.status}>{CONTACT.securityNote}</p>
      </div>
    </div>
  );
}
