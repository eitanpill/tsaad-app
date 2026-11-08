import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { copy } from "@/content/copy.he";
import { InfoIcon } from "../_components/icons";
import { LoginForm } from "../_components/LoginForm";
import { RedirectIfSignedIn } from "../_components/RedirectIfSignedIn";

export const metadata: Metadata = { title: `${copy.login.title} | ${copy.brand.name}` };

export default function LoginPage() {
  return (
    <>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <section className="tile tile--sky">
        <p className="eyebrow">{copy.brand.name}</p>
        <h1 className="auth-title">{copy.login.title}</h1>
        <p className="auth-lead">{copy.login.lead}</p>
      </section>
      <section className="tile tile--white">
        <LoginForm />
      </section>
      <section className="tile tile--sage" aria-labelledby="first-time-title">
        <div className="note-row">
          <span className="note-icon">
            <InfoIcon />
          </span>
          <div>
            <h2 id="first-time-title" className="note-title">
              {copy.login.firstTime.heading}
            </h2>
            <p className="note-body">{copy.login.firstTime.body}</p>
          </div>
        </div>
      </section>
      <section className="tile tile--sand">
        <div className="row-between">
          <b>{copy.login.notRegistered}</b>
          <Link href="/tsaad" className="link">
            {copy.login.toLanding}
          </Link>
        </div>
      </section>
    </>
  );
}
