"use client";

import Link from "next/link";
import { ContactForm } from "@/components/contact/ContactForm";
import { blockReveal, rise } from "@/components/contact/blockReveal";
import { Heading } from "@/components/reveal/Heading";
import type { SectionProps } from "@/components/stage/Stage";
import { SocialLinks } from "@/components/ui/SocialLinks";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import { playSfx } from "@/lib/audio/sfx";
import { CONTACT } from "@/lib/content";
import { CONTACT_TIMING } from "@/lib/motion/timing";
import { clamp01, lerp, linearBeatProgress, type Beat } from "@/lib/motion/progress";
import { useLayoutFlags } from "@/lib/stage/useLayoutFlags";
import styles from "./Contact.module.css";

// 7 — Contact. A dark panel rises from the bottom edge: heading and lead on the
// left with the credit and socials pinned under them; the form and the footer
// row on the right. Everything is scrubbed by the section's scroll progress,
// in reading order on desktop and top-to-bottom once the panel stacks.

const HEADING_LINES = [...CONTACT.heading];

const easeOutCubic = (x: number) => 1 - (1 - clamp01(x)) ** 3;
const easeOutQuart = (x: number) => 1 - (1 - clamp01(x)) ** 4;

const hoverSound = () => playSfx("hover");

export function Contact({ progress }: SectionProps) {
  const { isContactStacked } = useLayoutFlags();
  const reduced = useReducedMotion();
  const timing = isContactStacked ? CONTACT_TIMING.mobile : CONTACT_TIMING.desktop;
  const { beats } = timing;

  const sectionProgress = clamp01(progress);
  const clock = clamp01(sectionProgress / timing.revealWindow);
  const slice = (b: Beat) => linearBeatProgress(clock, b);

  const panelShow = easeOutCubic(sectionProgress / timing.panelRevealEnd);
  const headingSlice = slice(beats.heading);
  const headingShow = easeOutCubic(headingSlice);
  const leadShow = easeOutCubic(slice(beats.lead));
  const socialsShow = easeOutCubic(slice(beats.socials));

  const panelStyle = {
    opacity: panelShow,
    transform: reduced
      ? undefined
      : `translate3d(0, ${((1 - panelShow) * 18).toFixed(2)}px, 0) scale(${lerp(0.955, 1, panelShow).toFixed(4)})`,
  };

  return (
    <div className={styles.contact}>
      <div className={styles.panel} style={panelStyle}>
        <div className={styles.content}>
          <div className={styles.intro}>
            <div>
              <div className={styles.headingWrap} style={rise(headingShow, 24, reduced)}>
                <Heading
                  lines={HEADING_LINES}
                  progress={headingSlice}
                  motion={timing.headingMotion}
                  className={styles.heading}
                  lineClassName={styles.headingLine}
                />
              </div>
              <p className={styles.lead} style={rise(leadShow, 28, reduced)}>
                {CONTACT.lead}
              </p>
            </div>

            <div className={styles.leftMeta}>
              <a
                className={styles.credit}
                href={CONTACT.credit.href}
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={hoverSound}
                style={blockReveal(slice(beats.credit), 32, reduced)}
              >
                {CONTACT.credit.prefix} <span className={styles.creditName}>{CONTACT.credit.name}</span>
              </a>
              <div className={styles.socials} style={rise(socialsShow, 40, reduced)}>
                <SocialLinks compact />
              </div>
            </div>
          </div>

          <div className={styles.right}>
            <div className={styles.form}>
              <ContactForm
                reduced={reduced}
                reveal={{
                  name: easeOutCubic(slice(beats.nameField)),
                  email: easeOutCubic(slice(beats.emailField)),
                  message: easeOutCubic(slice(beats.message)),
                  submit: easeOutQuart(slice(beats.submit)),
                }}
              />
            </div>

            <footer className={styles.footer}>
              <p style={blockReveal(slice(beats.footerPrimary), 72, reduced)}>{CONTACT.licence}</p>
              <p style={blockReveal(slice(beats.footerSecondary), 80, reduced)}>
                <Link className={styles.footerLink} href="/privacy" onMouseEnter={hoverSound}>
                  {CONTACT.privacy}
                </Link>
              </p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
