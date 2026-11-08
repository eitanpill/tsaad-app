import { Logo } from "@/components/Logo";
import { copy } from "@/content/copy.he";
import { BottomNav } from "./BottomNav";

/** מה שמוצג בזמן שהסשן והיום נטענים (מצב "טעינה" של AppStates). הבלוקים מעוטרים בלבד. */
export function ShellLoading() {
  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">
          <Logo />
        </span>
      </header>
      <main className="app-main" aria-busy="true">
        <section className="t skel">
          <span className="status" role="status">
            {copy.states.loading}
          </span>
          <div className="bars" aria-hidden="true">
            <i className="w" />
            <i className="w" />
            <i />
            <i />
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
