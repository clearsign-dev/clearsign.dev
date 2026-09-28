import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY } from "@/lib/content";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy — ClearSign",
  description: PRIVACY.paragraphs[0],
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <article className={`${styles.column} selectable`}>
        <Link className={styles.back} href="/">
          ← Back to home
        </Link>

        <header className={styles.head}>
          <h1 className={styles.title}>
            {PRIVACY.title.map((line) => (
              <span key={line} className={styles.titleLine}>
                {line}
              </span>
            ))}
          </h1>
          <p className={styles.subtitle}>ClearSign</p>
          <p className={styles.updated}>Last updated: {PRIVACY.updated}</p>
        </header>

        <section className={styles.section}>
          {PRIVACY.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      </article>
    </main>
  );
}
