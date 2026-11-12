// Checks the argument handling of scripts/browser-check.mjs, the helper AI runs
// use to screenshot pages of the dev server. The browser part needs a running
// dev server and Chromium, so it isn't exercised here.
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .mjs script without type declarations
import { parseArgs, screenshotName } from "../../scripts/browser-check.mjs";

describe("browser-check script", () => {
  it("checks the home page on desktop when given no paths", () => {
    expect(parseArgs([])).toEqual({
      baseUrl: "http://localhost:8080",
      paths: ["/"],
      mobile: false,
      outDir: ".browser-check",
    });
  });

  it("takes several paths, a mobile viewport and another server", () => {
    expect(
      parseArgs(["/dashboard", "/step/1-name", "--mobile", "--base-url", "http://localhost:5173/"]),
    ).toMatchObject({
      baseUrl: "http://localhost:5173",
      paths: ["/dashboard", "/step/1-name"],
      mobile: true,
    });
  });

  it("refuses to point at anything but a local server", () => {
    expect(() => parseArgs(["--base-url", "https://thistlebook.com"])).toThrow(/local/);
  });

  it("names screenshots after the page and viewport", () => {
    expect(screenshotName("/", false)).toBe("home-desktop.png");
    expect(screenshotName("/step/11-preview", true)).toBe("step-11-preview-mobile.png");
  });
});
