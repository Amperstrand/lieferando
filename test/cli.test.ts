import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";
import { fakeLieferando, LIVE_SLUG, OFFLINE_SLUG } from "./lieferando-fake.js";

function ports(lines: string[], errors: string[]) {
  return {
    out: (line: string) => lines.push(line),
    err: (line: string) => errors.push(line),
  };
}

describe("runCli", () => {
  it("prints a menu with prices through an injected transport", async () => {
    const transport = fakeLieferando();
    const lines: string[] = [];
    const code = await runCli(["menu", LIVE_SLUG], { ...ports(lines, []), fetchImpl: transport.fetchImpl });
    expect(code).toBe(0);
    const text = lines.join("\n");
    expect(text).toContain("Synthetic Kebap Haus — 3 items");
    expect(text).toContain("Synthetic Dürüm  8.50 EUR");
    expect(text).toContain("Synthetic Ayran  2.20 EUR");
  });

  it("accepts full lieferando.de URLs", async () => {
    const transport = fakeLieferando();
    const lines: string[] = [];
    const code = await runCli(
      ["menu", `https://www.lieferando.de/speisekarte/${LIVE_SLUG}`],
      { ...ports(lines, []), fetchImpl: transport.fetchImpl },
    );
    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("Synthetic Kebap Haus");
  });

  it("health prints the platform status and exits 1 when the venue is offline", async () => {
    const transport = fakeLieferando();
    const online: string[] = [];
    expect(await runCli(["health", LIVE_SLUG], { ...ports(online, []), fetchImpl: transport.fetchImpl })).toBe(0);
    expect(online.join("\n")).toContain("status:    online");

    const offline: string[] = [];
    expect(await runCli(["health", OFFLINE_SLUG], { ...ports(offline, []), fetchImpl: transport.fetchImpl })).toBe(1);
    expect(offline.join("\n")).toContain("OFFLINE (platform flag)");
  });

  it("exits 1 for unknown slugs, bad input, and unknown commands", async () => {
    const transport = fakeLieferando();
    const errors: string[] = [];
    expect(await runCli(["menu", "does-not-exist"], { ...ports([], errors), fetchImpl: transport.fetchImpl })).toBe(1);
    expect(errors[0]).toContain("no menu for does-not-exist");

    const bad: string[] = [];
    expect(await runCli(["menu", "!!"], ports([], bad))).toBe(1);
    expect(bad[0]).toContain("invalid slug");

    const unknown: string[] = [];
    expect(await runCli(["order", LIVE_SLUG], ports([], unknown))).toBe(1);
    expect(unknown[0]).toContain("unknown command: order");
  });

  it("prints usage on help", async () => {
    const lines: string[] = [];
    expect(await runCli([], ports(lines, []))).toBe(0);
    expect(lines.join("\n")).toContain("lieferando — read-only");
  });
});
