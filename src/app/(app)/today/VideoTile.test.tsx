import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import { VideoTile } from "./VideoTile";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("VideoTile (the Bunny player loads only after a click)", () => {
  it("renders a labelled play button and no iframe, and requests nothing, until clicked", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<VideoTile day={3} available />);
    expect(screen.getByRole("button", { name: fill(copy.a11y.video.play, { n: 3 }) })).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("on click it fetches the signed url, shows the iframe and moves focus into it", async () => {
    const url = "https://iframe.mediadelivery.net/embed/lib/vid?token=t&expires=1";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url }) }));
    const { container } = render(<VideoTile day={3} available />);
    fireEvent.click(screen.getByRole("button", { name: fill(copy.a11y.video.play, { n: 3 }) }));
    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
    const frame = container.querySelector("iframe")!;
    expect(frame).toHaveAttribute("src", url);
    expect(frame).toHaveAttribute("title", fill(copy.a11y.video.frameTitle, { n: 3 }));
    await waitFor(() => expect(document.activeElement).toBe(frame));
  });

  it("with no video configured the button stays disabled and nothing is fetched", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<VideoTile day={2} available={false} />);
    fireEvent.click(screen.getByRole("button", { name: fill(copy.a11y.video.play, { n: 2 }) }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: fill(copy.a11y.video.play, { n: 2 }) })).toHaveAttribute("aria-disabled", "true");
  });
});
