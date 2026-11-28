import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/content/copy.he";
import { fill } from "@/lib/format";
import { VideoTile } from "./VideoTile";

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {}
  vi.unstubAllGlobals();
});

describe("VideoTile (the Bunny player loads only after a click)", () => {
  it("renders a labelled play button and no iframe, and requests nothing, until clicked", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<VideoTile day={3} availableLong availableShort={false} />);
    expect(screen.getByRole("button", { name: fill(copy.a11y.video.play, { n: 3 }) })).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("on click it fetches the signed url, shows the iframe and moves focus into it", async () => {
    const url = "https://iframe.mediadelivery.net/embed/lib/vid?token=t&expires=1";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url }) }));
    const { container } = render(<VideoTile day={3} availableLong availableShort={false} />);
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
    render(<VideoTile day={2} availableLong={false} availableShort={false} />);
    fireEvent.click(screen.getByRole("button", { name: fill(copy.a11y.video.play, { n: 2 }) }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: fill(copy.a11y.video.play, { n: 2 }) })).toHaveAttribute("aria-disabled", "true");
  });
});

describe("VideoTile length choice (long or short practice)", () => {
  const lc = copy.today.videoLength;
  const url = "https://iframe.mediadelivery.net/embed/lib/vid?token=t&expires=1";
  const playName = fill(copy.a11y.video.play, { n: 3 });

  it("shows no choice when only one version exists, and plays that one", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url }) });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<VideoTile day={3} availableLong={false} availableShort />);
    expect(container.querySelector(".video-len")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: playName }));
    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledWith("/api/video/3?v=short", expect.anything());
  });

  it("with both versions renders a labelled radiogroup, long preselected", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { container } = render(<VideoTile day={3} availableLong availableShort />);
    const group = container.querySelector("fieldset.video-len")!;
    expect(group.querySelector("legend")).toHaveTextContent(lc.legend);
    expect(group.querySelectorAll(".video-len__opt")).toHaveLength(2);
    const longR = screen.getByRole("radio", { name: new RegExp(lc.long) });
    const shortR = screen.getByRole("radio", { name: new RegExp(lc.short) });
    expect(longR).toBeChecked();
    expect(shortR).not.toBeChecked();
    expect(group).toHaveTextContent(lc.longTime);
    expect(group).toHaveTextContent(lc.shortTime);
  });

  it("long fetches without a query, short fetches ?v=short; choosing alone fetches nothing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url }) });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<VideoTile day={3} availableLong availableShort />);
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(lc.short) }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: playName }));
    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledWith("/api/video/3?v=short", expect.anything());
    expect(container.querySelector("iframe")).toHaveAttribute("title", fill(copy.a11y.video.frameTitleShort, { n: 3 }));
  });

  it("changing the length while a video is ready resets to the play button", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url }) });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<VideoTile day={3} availableLong availableShort />);
    fireEvent.click(screen.getByRole("button", { name: playName }));
    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
    expect(fetchMock).toHaveBeenLastCalledWith("/api/video/3", expect.anything());
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(lc.short) }));
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: playName })).toBeInTheDocument();
  });

  it("ignores a change while loading", async () => {
    let resolve: (v: unknown) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise((r) => (resolve = r))));
    const { container } = render(<VideoTile day={3} availableLong availableShort />);
    fireEvent.click(screen.getByRole("button", { name: playName }));
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(lc.short) }));
    expect(screen.getByRole("radio", { name: new RegExp(lc.long) })).toBeChecked();
    resolve({ ok: true, json: async () => ({ url }) });
    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
  });

  it("remembers the last choice on the device", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const first = render(<VideoTile day={3} availableLong availableShort />);
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(lc.short) }));
    first.unmount();
    render(<VideoTile day={4} availableLong availableShort />);
    await waitFor(() => expect(screen.getByRole("radio", { name: new RegExp(lc.short) })).toBeChecked());
  });

  it("still works when localStorage throws", () => {
    vi.stubGlobal("fetch", vi.fn());
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<VideoTile day={3} availableLong availableShort />);
    expect(screen.getByRole("radio", { name: new RegExp(lc.long) })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(lc.short) }));
    expect(screen.getByRole("radio", { name: new RegExp(lc.short) })).toBeChecked();
    get.mockRestore();
    set.mockRestore();
  });

  it("with no version uploaded yet it still shows the choice, and both stay pending", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { container } = render(<VideoTile day={3} availableLong={false} availableShort={false} />);
    expect(container.querySelector("fieldset.video-len")).not.toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(lc.short) }));
    expect(screen.getByText(copy.today.videoPending)).toBeInTheDocument();
  });

  it("admin preview (forceChoice) shows the choice even with one version; the missing one is pending", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<VideoTile day={3} availableLong availableShort={false} forceChoice />);
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(lc.short) }));
    expect(screen.getByText(copy.today.videoPending)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: playName }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
