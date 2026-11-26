import { copy } from "@/content/copy.he";
import { COMMUNITY_GROUP_URL } from "@/content/social";

/** בועת שיחה בקו של שאר האייקונים (לא הלוגו של ווטסאפ). */
const ChatIcon = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M4.5 18.5 L5.6 15.2 A8 7.4 0 1 1 8.8 18.1 Z" />
    <path d="M9 10.5 h6 M9 13.5 h3.5" />
  </svg>
);

/**
 * אריח ההצטרפות לקבוצת הווטסאפ של האתגר. מוצג לכל משתתף רשום בכל שלב (לפני ההתחלה, בזמן האתגר ואחריו).
 * הקישור נפתח בחלון חדש; ההודעה על כך נקראת בשם הנגיש של הכפתור.
 */
export function GroupJoin() {
  const G = copy.group;
  return (
    <section className="t t-group ar-group" aria-labelledby="group-h" data-testid="group-join">
      <h2 id="group-h">{G.title}</h2>
      <p>{G.body}</p>
      <a className="btn-group" href={COMMUNITY_GROUP_URL} target="_blank" rel="noopener noreferrer">
        <ChatIcon />
        <span>
          {G.cta}
          <span className="visually-hidden"> {G.newTab}</span>
        </span>
      </a>
    </section>
  );
}
