import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/content/copy.he";

const action = vi.fn();
vi.mock("./actions", () => ({ setReminderTimeAction: (prev: unknown, fd: FormData) => action(prev, fd) }));

const { ReminderTimeForm } = await import("./ReminderTimeForm");

afterEach(() => {
  cleanup();
  action.mockReset();
});

const props = { initialMinutes: 450, unlockTime: "05:00", reminderTime: "07:30" };

describe("ReminderTimeForm", () => {
  it("is a labelled select of 32 half-hour choices from 05:30 to 21:00, on the saved value", () => {
    render(<ReminderTimeForm {...props} />);
    const select = screen.getByRole("combobox", { name: copy.reminders.timeLabel });
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toHaveLength(32);
    expect(options[0]).toBe("05:30");
    expect(options[1]).toBe("06:00");
    expect(options.at(-1)).toBe("21:00");
    expect(select).toHaveValue("450");
    expect(screen.getByRole("button", { name: copy.reminders.timeSave })).toBeInTheDocument();
  });

  it("keeps an empty polite status region in the DOM, and announces success in it", async () => {
    action.mockResolvedValue({ status: "saved", minutes: 600 });
    render(<ReminderTimeForm {...props} />);
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "600" } });
    fireEvent.click(screen.getByRole("button", { name: copy.reminders.timeSave }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.reminders.timeSaved));
    expect(action.mock.calls[0][1].get("reminderTime")).toBe("600");
    expect(screen.getByRole("status")).toBe(status);
    expect(screen.getByRole("combobox")).toHaveValue("600");
  });

  it("announces an error in the same region", async () => {
    action.mockResolvedValue({ status: "error" });
    render(<ReminderTimeForm {...props} />);
    fireEvent.click(screen.getByRole("button", { name: copy.reminders.timeSave }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.reminders.timeError));
  });
});
