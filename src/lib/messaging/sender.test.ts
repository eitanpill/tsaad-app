// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createLogger } from "@/lib/logger";
import { createDryRunSender, getMessageSender, renderMessage, type OutgoingMessage } from "./sender";

const msg: OutgoingMessage = {
  kind: "reset",
  channel: "email",
  userId: "u1",
  name: "דנה",
  username: "dana",
  link: "https://app.example.com/activate?token=SECRET_TOKEN_VALUE",
};

const capture = () => {
  const lines: string[] = [];
  return { lines, log: createLogger({ level: "debug", sink: (l) => lines.push(l) }) };
};

describe("dry-run message sender", () => {
  it("renders the approved copy with the link and name filled in", () => {
    const w = renderMessage(msg);
    expect(w.subject).toBeTruthy();
    expect(w.body).toContain("דנה");
    expect(w.body).toContain(msg.link);
    const e = renderMessage({ ...msg, kind: "activation" });
    expect(e.subject).toBeTruthy();
    expect(e.body).toContain("dana");
  });
  it("never logs the token or link in production", async () => {
    const { lines, log } = capture();
    await createDryRunSender(log, { NODE_ENV: "production" }).send(msg);
    const out = lines.join("\n");
    expect(out).toContain("dry-run");
    expect(out).not.toContain("SECRET_TOKEN_VALUE");
    expect(out).not.toContain("/activate");
    expect(out).not.toContain("דנה");
  });
  it("logs only the path (debug) in development", async () => {
    const { lines, log } = capture();
    await createDryRunSender(log, { NODE_ENV: "development" }).send(msg);
    const out = lines.join("\n");
    expect(out).toContain("/activate?token=SECRET_TOKEN_VALUE");
    expect(out).not.toContain("https://app.example.com");
  });
  it("test environment is treated like production for link logging", async () => {
    const { lines, log } = capture();
    await createDryRunSender(log, { NODE_ENV: "test" }).send(msg);
    expect(lines.join("\n")).not.toContain("SECRET_TOKEN_VALUE");
  });
  it("the default sender is a dry-run that resolves without sending", async () => {
    await expect(getMessageSender().send(msg)).resolves.toBeUndefined();
  });
});
