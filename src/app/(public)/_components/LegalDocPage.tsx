import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { getConfig } from "@/config";
import { LEGAL, RETENTION } from "@/config/constants";
import { copy } from "@/content/copy.he";
import { legal, type LegalBlock, type LegalKey } from "@/content/legal.he";
import { SESSION_POLICY } from "@/lib/auth/config";
import { fill } from "@/lib/format";
import { fillTokens, formatLegalDate, parseContact, splitContacts, type ContactKey } from "@/lib/legal/render";

/** ערכי האסימונים מקבועי הקוד (שמירת מידע, תפוגת התחברות, תאריכים). */
export function legalTokens(): Record<string, string | number> {
  return {
    sessionAbsoluteDays: SESSION_POLICY.absoluteDays,
    sessionIdleDays: SESSION_POLICY.idleDays,
    webhookEventsDays: RETENTION.webhookEventsDays,
    syncSentDays: RETENTION.syncSentDays,
    syncDeadDays: RETENTION.syncDeadDays,
    reminderLogDays: RETENTION.reminderLogDays,
    accessibilityDate: formatLegalDate(LEGAL.accessibilityLastChecked),
  };
}

function Contact({ which }: { which: ContactKey }) {
  const c = parseContact(getConfig().env[which]);
  if (!c) return <>{copy.legal.contactTba}</>;
  if (c.kind === "text") return <>{c.value}</>;
  return (
    <a href={c.href} className="ltr">
      {c.value}
    </a>
  );
}

function Text({ text, tokens }: { text: string; tokens: Record<string, string | number> }) {
  return (
    <>
      {splitContacts(fillTokens(text, tokens)).map((seg, i) => (
        <Fragment key={i}>{"contact" in seg ? <Contact which={seg.contact} /> : seg.text}</Fragment>
      ))}
    </>
  );
}

function Block({ block, tokens }: { block: LegalBlock; tokens: Record<string, string | number> }): ReactNode {
  if (typeof block === "string") {
    return (
      <p>
        <Text text={block} tokens={tokens} />
      </p>
    );
  }
  return (
    <ul>
      {block.list.map((item) => (
        <li key={item}>
          <Text text={item} tokens={tokens} />
        </li>
      ))}
    </ul>
  );
}

/** עמוד מסמך משפטי: כותרות לפי סדר, תוכן עניינים, שורת אורך קריאה. הטקסט מ־src/content/legal.he.ts (טיוטה, ממתין לבדיקה משפטית). */
export function LegalDocPage({ doc }: { doc: LegalKey }) {
  const d = legal[doc];
  const tokens = legalTokens();
  return (
    <>
      <div className="doc-bar">
        <Link href="/tsaad" className="logo" aria-label={`${copy.a11y.logo}, ${copy.legal.home}`}>
          <Logo labelled={false} height={22} />
        </Link>
      </div>
      <main id="main" className="doc-main">
        <h1>{d.title}</h1>
        <p className="doc-updated">{fill(copy.legal.updated, { date: formatLegalDate(LEGAL.draftDate) })}</p>
        <p>{d.lead}</p>
        <nav className="doc-toc" aria-labelledby="doc-toc-h">
          <h2 id="doc-toc-h">{copy.legal.toc}</h2>
          <ol>
            {d.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.heading}</a>
              </li>
            ))}
          </ol>
        </nav>
        {d.sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
            <h2 id={`${s.id}-h`}>{s.heading}</h2>
            {s.body.map((b, i) => (
              <Block key={i} block={b} tokens={tokens} />
            ))}
          </section>
        ))}
        <Link href="/legal" className="doc-back">
          {copy.legal.back}
        </Link>
      </main>
    </>
  );
}
