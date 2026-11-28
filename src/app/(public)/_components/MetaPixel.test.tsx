import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { copy } from "@/content/copy.he";
import { META_CONSENT_KEY, META_SCRIPT_URL } from "@/lib/meta/pixel";
import { MetaPixel } from "./MetaPixel";

type W = Window & { fbq?: { queue: unknown[][] }; _fbq?: unknown };
const P = copy.landing.pixel;
const calls = () => (window as W).fbq?.queue ?? [];
const scripts = () => Array.from(document.head.querySelectorAll(`script[src="${META_SCRIPT_URL}"]`));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete (window as W).fbq;
  delete (window as W)._fbq;
  scripts().forEach((s) => s.remove());
  document.body.innerHTML = "";
});

describe("MetaPixel", () => {
  it("notice mode: loads the pixel once, sends PageView with autoConfig off, and shows the banner", () => {
    render(<MetaPixel pixelId="123456789" mode="notice" value={79} />);
    expect(scripts()).toHaveLength(1);
    expect(calls()).toEqual([
      ["set", "autoConfig", false, "123456789"],
      ["init", "123456789"],
      ["consent", "grant"],
      ["track", "PageView"],
    ]);
    expect(screen.getByRole("region", { name: P.region })).toHaveTextContent(P.notice);
    expect(document.documentElement.dataset.pixelBanner).toBe("open");
  });

  it("sends InitiateCheckout only for signup links (/go/challenge)", () => {
    render(
      <>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- כמו כפתורי ההרשמה בדף (קישור יציאה רגיל) */}
        <a href="/go/challenge">join</a>
        <a href="/login">login</a>
        <MetaPixel pixelId="123456789" mode="notice" value={79} />
      </>,
    );
    fireEvent.click(screen.getByText("login"));
    fireEvent.click(screen.getByText("join"));
    const tracked = calls().filter((c) => c[0] === "track");
    expect(tracked).toEqual([["track", "PageView"], ["track", "InitiateCheckout", { value: 79, currency: "ILS" }]]);
  });

  it("'no thanks' revokes, remembers, and the next visit loads nothing", () => {
    const { unmount } = render(<MetaPixel pixelId="123456789" mode="notice" value={79} />);
    fireEvent.click(screen.getByRole("button", { name: P.decline }));
    expect(calls().at(-1)).toEqual(["consent", "revoke"]);
    expect(window.localStorage.getItem(META_CONSENT_KEY)).toBe("denied");
    expect(screen.queryByRole("region")).toBeNull();
    expect(document.documentElement.dataset.pixelBanner).toBeUndefined();
    unmount();
    delete (window as W).fbq;
    scripts().forEach((s) => s.remove());
    render(<MetaPixel pixelId="123456789" mode="notice" value={79} />);
    expect(scripts()).toHaveLength(0);
    expect((window as W).fbq).toBeUndefined();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("optin mode: nothing loads until 'accept'", () => {
    render(<MetaPixel pixelId="123456789" mode="optin" value={79} />);
    expect(scripts()).toHaveLength(0);
    expect(screen.getByRole("region")).toHaveTextContent(P.optin);
    fireEvent.click(screen.getByRole("button", { name: P.accept }));
    expect(scripts()).toHaveLength(1);
    expect(calls()).toContainEqual(["track", "PageView"]);
    expect(window.localStorage.getItem(META_CONSENT_KEY)).toBe("granted");
  });

  it("an earlier 'accept' loads without a banner", () => {
    window.localStorage.setItem(META_CONSENT_KEY, "granted");
    render(<MetaPixel pixelId="123456789" mode="optin" value={79} />);
    expect(scripts()).toHaveLength(1);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("leaving the page stops the pixel", () => {
    const { unmount } = render(<MetaPixel pixelId="123456789" mode="notice" value={79} />);
    unmount();
    expect(calls().at(-1)).toEqual(["consent", "revoke"]);
  });
});
