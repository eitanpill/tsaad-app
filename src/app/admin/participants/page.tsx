import Link from "next/link";
import { notFound } from "next/navigation";
import { getConfig } from "@/config";
import { copy } from "@/content/copy.he";
import { getDb } from "@/db";
import { findParticipant, listParticipants } from "@/lib/admin/participants";
import { verifySession } from "@/lib/auth/dal";
import { fill } from "@/lib/format";
import { activePreviewDay } from "@/lib/preview/context";
import { isAdminUsername } from "@/lib/stats/admin";
import "../stats/stats.css";
import { DeleteForm, DisableForm, AddForm, FocusOnMount, NewLinkForm, PreviewForm } from "./forms";
import { stopPreviewAction } from "./actions";

const P = copy.admin.participants;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * /admin/participants: ניהול משתתפים ותצוגה מקדימה של יום. רק מנהל (ADMIN_USERNAMES); כל השאר מקבלים את ה־404 הרגיל.
 * הדף מציג פרטים אישיים, ולכן no-store (דף דינמי, ללא מטמון) ו־noindex. כל שינוי הוא server action שבודק הרשאה מחדש.
 */
export default async function ParticipantsPage({ searchParams }: Props) {
  const cfg = getConfig();
  const user = await verifySession();
  if (!user || !isAdminUsername(user.username, cfg.env.ADMIN_USERNAMES)) notFound();
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 100);
  const pageNo = Number(one(sp.page)) || 1;
  const db = getDb();
  const [list, previewDay] = await Promise.all([listParticipants(db, { q, page: pageNo }), activePreviewDay()]);
  const deleteId = one(sp.delete);
  const toDelete = UUID.test(deleteId) && deleteId !== user.userId ? await findParticipant(db, deleteId) : null;
  const toDeleteRow = toDelete ? list.rows.find((r) => r.id === toDelete.id) : undefined;
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const fmt = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short", timeZone: cfg.timeZone });
  const fmtDay = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeZone: cfg.timeZone });
  const href = (page: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `/admin/participants${s ? `?${s}` : ""}`;
  };

  return (
    <main className="adm" id="main">
      <title>{`${P.title} | ${copy.brand.name}`}</title>
      <h1>{P.title}</h1>
      <p className="adm-lead">{P.lead}</p>
      {one(sp.deleted) === "1" ? (
        <FocusOnMount className="adm-msg">{P.done.deleted}</FocusOnMount>
      ) : null}

      <section aria-labelledby="adm-prev-h">
        <h2 id="adm-prev-h">{P.preview.heading}</h2>
        <p className="adm-lead">{P.preview.lead}</p>
        {previewDay !== null ? (
          <p role="status">
            {fill(P.preview.active, { n: previewDay })}{" "}
            <Link href="/today">{P.preview.toToday}</Link>
          </p>
        ) : null}
        <PreviewForm current={previewDay} />
        {previewDay !== null ? (
          <form action={stopPreviewAction}>
            <button className="adm-btn">{P.preview.stop}</button>
          </form>
        ) : null}
      </section>

      <section aria-labelledby="adm-add-h">
        <h2 id="adm-add-h">{P.add.heading}</h2>
        <p className="adm-lead">{P.add.note}</p>
        <AddForm />
      </section>

      {toDelete ? (
        <section className="adm-confirm" aria-labelledby="adm-del-h">
          <h2 id="adm-del-h">{P.remove.heading}</h2>
          <DeleteForm id={toDelete.id} name={toDeleteRow?.displayName ?? toDelete.username} username={toDelete.username} />
          <p>
            <Link href={href(list.page)}>{P.remove.cancel}</Link>
          </p>
        </section>
      ) : null}

      <section aria-labelledby="adm-list-h">
        <h2 id="adm-list-h">{P.list.heading}</h2>
        <form className="adm-search" role="search" method="get" action="/admin/participants">
          <label>
            {P.search.label}
            <input name="q" type="search" defaultValue={q} maxLength={100} />
          </label>
          <button className="adm-btn">{P.search.button}</button>
          {q ? (
            <Link className="adm-btn" href="/admin/participants" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              {P.search.clear}
            </Link>
          ) : null}
        </form>
        <p className="adm-lead" style={{ marginTop: 10 }}>
          {fill(P.list.count, { n: list.total })}
        </p>
        {list.rows.length === 0 ? (
          <p>{P.list.none}</p>
        ) : (
          <ul className="adm-list">
            {list.rows.map((r) => {
              const self = r.id === user.userId;
              return (
                <li key={r.id} className="adm-item" data-username={r.username}>
                  <h3>
                    {r.displayName}
                    {self ? <span className="adm-tag">{P.list.you}</span> : null}
                    {r.disabled ? <span className="adm-tag">{P.list.disabled}</span> : null}
                  </h3>
                  <dl>
                    <dt>{P.list.username}</dt>
                    <dd dir="ltr">{r.username}</dd>
                    <dt>{P.list.phone}</dt>
                    <dd dir="ltr">{r.phone ?? P.list.none2}</dd>
                    <dt>{P.list.email}</dt>
                    <dd dir="ltr">{r.email ?? P.list.none2}</dd>
                    <dt>{P.list.created}</dt>
                    <dd>{fmtDay.format(r.createdAt)}</dd>
                    <dt>{P.list.activated}</dt>
                    <dd>{r.activated ? P.list.yes : P.list.no}</dd>
                    <dt>{P.list.disabled}</dt>
                    <dd>{r.disabled ? P.list.yes : P.list.no}</dd>
                    <dt>{P.list.lastActivity}</dt>
                    <dd>{r.lastActivity ? fmt.format(r.lastActivity) : P.list.never}</dd>
                  </dl>
                  {self ? null : (
                    <div className="adm-actions">
                      {r.disabled ? null : <NewLinkForm id={r.id} name={r.displayName} activated={r.activated} />}
                      <DisableForm id={r.id} name={r.displayName} disabled={r.disabled} />
                      <Link className="adm-btn" href={`${href(list.page)}${href(list.page).includes("?") ? "&" : "?"}delete=${r.id}`} aria-label={fill(P.remove.buttonFor, { name: r.displayName })}>
                        {P.remove.button}
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {pages > 1 ? (
          <nav className="adm-pager" aria-label={P.list.pagination}>
            {list.page > 1 ? <Link href={href(list.page - 1)}>{P.list.prev}</Link> : null}
            <span>{fill(P.list.pageOf, { page: list.page, pages })}</span>
            {list.page < pages ? <Link href={href(list.page + 1)}>{P.list.next}</Link> : null}
          </nav>
        ) : null}
      </section>
      <p className="adm-note">{P.disable.hint}</p>
    </main>
  );
}
