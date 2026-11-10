import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@/content/copy.he";
import { requireUser } from "@/lib/auth/dal";
import { DeleteAccountForm } from "./DeleteAccountForm";

export const metadata: Metadata = { title: `${copy.account.title} | ${copy.brand.name}` };

export default async function AccountPage() {
  const user = await requireUser();
  const A = copy.account;
  return (
    <>
      <section className="t t-hero" aria-labelledby="acc-h">
        <h1 id="acc-h">{A.title}</h1>
        <dl className="acc-dl">
          <div>
            <dt>{A.details.displayName}</dt>
            <dd>{user.displayName}</dd>
          </div>
          <div>
            <dt>{A.details.username}</dt>
            <dd dir="ltr" className="acc-ltr">
              {user.username}
            </dd>
          </div>
        </dl>
      </section>

      <section className="t t-acc-legal" aria-labelledby="acc-legal-h">
        <h2 id="acc-legal-h">{A.legal.heading}</h2>
        <ul>
          <li>
            <Link href="/legal/privacy">{A.legal.privacy}</Link>
          </li>
          <li>
            <Link href="/legal/accessibility">{A.legal.accessibility}</Link>
          </li>
          <li>
            <Link href="/legal/terms">{A.legal.terms}</Link>
          </li>
        </ul>
      </section>

      <section className="t t-acc-del" aria-labelledby="acc-del-h">
        <h2 id="acc-del-h">{A.delete.heading}</h2>
        <p>{A.delete.lead}</p>
        <h3>{A.delete.whatHeading}</h3>
        <ul className="acc-list">
          {A.delete.whatItems.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <p>{A.delete.remains}</p>
        <DeleteAccountForm />
      </section>
    </>
  );
}
