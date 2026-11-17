import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/content/copy.he";

const action = vi.fn();
vi.mock("./actions", () => ({ setWhatsappRemindersAction: (on: boolean) => action(on) }));

const { WhatsappToggle } = await import("./WhatsappToggle");

afterEach(() => {
  cleanup();
  action.mockReset();
});

describe("WhatsappToggle", () => {
  it("is a named switch, on by default, and turns off only after the server saved it", async () => {
    action.mockResolvedValue({ ok: true, on: false });
    render(<WhatsappToggle initial={true} />);
    const sw = screen.getByRole("switch", { name: copy.reminders.whatsappTitle });
    expect(sw).toHaveAttribute("aria-checked", "true");
    fireEvent.click(sw);
    await waitFor(() => expect(sw).toHaveAttribute("aria-checked", "false"));
    expect(action).toHaveBeenCalledWith(false);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("a failed save keeps the state and says so in the polite status region", async () => {
    action.mockResolvedValue({ ok: false });
    render(<WhatsappToggle initial={false} />);
    const sw = screen.getByRole("switch", { name: copy.reminders.whatsappTitle });
    fireEvent.click(sw);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.login.errors.generic));
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw.getAttribute("aria-describedby")).toBe(screen.getByRole("status").id);
  });
});
