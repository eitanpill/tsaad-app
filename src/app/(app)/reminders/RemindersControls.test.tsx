import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/content/copy.he";
import { RemindersControls } from "./RemindersControls";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RemindersControls", () => {
  it("without a VAPID key from the server: unsupported, the switch is off and aria-disabled, the reason is announced politely", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    render(<RemindersControls vapidKey={null} unlockTime="05:00" reminderTime="07:30" />);
    const sw = screen.getByRole("switch", { name: copy.reminders.toggleTitle });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw).toHaveAttribute("aria-disabled", "true");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.reminders.status.unsupported));
    expect(sw.getAttribute("aria-describedby")).toContain(screen.getByRole("status").id);
  });

  it("shows the fixed reminder time and the iPhone note with a link to the install guide", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    render(<RemindersControls vapidKey={null} unlockTime="05:00" reminderTime="07:30" />);
    expect(screen.getByText("07:30")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.reminders.installLink })).toHaveAttribute("href", "/install");
  });
});
