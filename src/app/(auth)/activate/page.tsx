import type { Metadata } from "next";
import { Suspense } from "react";
import { copy } from "@/content/copy.he";
import { getDb } from "@/db";
import { peekToken } from "@/lib/auth/tokens";
import { ActivateForm } from "../_components/ActivateForm";
import { ExpiredLink } from "../_components/ExpiredLink";

export const metadata: Metadata = { title: `${copy.activate.title} | ${copy.brand.name}` };

type Props = { searchParams: Promise<{ token?: string | string[] }> };

async function ActivateBody({ searchParams }: Props) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  // בדיקה בלבד (בלי ניצול): כניסה לדף, או סורק קישורים, לא שורפים את הקישור.
  const peeked = value ? await peekToken(getDb(), value) : null;
  if (!peeked) return <ExpiredLink />;
  return (
    <section className="tile tile--white" aria-label={copy.activate.title}>
      <ActivateForm token={value} username={peeked.username} />
    </section>
  );
}

export default function ActivatePage({ searchParams }: Props) {
  return (
    <>
      <section className="tile tile--sky">
        <p className="eyebrow">{copy.activate.greeting}</p>
        <h1 className="auth-title">{copy.activate.title}</h1>
      </section>
      <Suspense fallback={null}>
        <ActivateBody searchParams={searchParams} />
      </Suspense>
    </>
  );
}
