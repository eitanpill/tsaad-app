import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import { AudioTile } from "./AudioTile";

afterEach(cleanup);

describe("AudioTile (meditation recording)", () => {
  it("renders a labelled native player that loads nothing and never autoplays", () => {
    const { container } = render(<AudioTile day={3} available />);
    const el = container.querySelector("audio")!;
    expect(el).toHaveAttribute("controls");
    expect(el).toHaveAttribute("preload", "none");
    expect(el).not.toHaveAttribute("autoplay");
    expect(el).toHaveAttribute("src", "/api/audio/3");
    expect(el).toHaveAttribute("aria-label", fill(copy.a11y.audio.player, { n: 3 }));
    expect(screen.getByRole("heading", { name: copy.today.audio.title })).toBeInTheDocument();
  });
  it("without a recording shows the pending note and no player", () => {
    const { container } = render(<AudioTile day={3} available={false} />);
    expect(container.querySelector("audio")).toBeNull();
    expect(screen.getByText(copy.today.audio.pending)).toBeInTheDocument();
  });
  it("on a load error shows an alert with a retry that clears it", () => {
    const { container } = render(<AudioTile day={3} available />);
    fireEvent.error(container.querySelector("audio")!);
    expect(screen.getByRole("alert")).toHaveTextContent(copy.today.audio.error);
    fireEvent.click(screen.getByRole("button", { name: copy.today.audio.retry }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
