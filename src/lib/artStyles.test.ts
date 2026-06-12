import { describe, it, expect } from "vitest";
import {
  ART_STYLES,
  ART_STYLE_ALIASES,
  resolveArtStyleValue,
  getArtStylePrompt,
} from "./artStyles";

describe("resolveArtStyleValue", () => {
  it("returns the first style value for undefined", () => {
    expect(resolveArtStyleValue(undefined)).toBe(ART_STYLES[0].value);
  });

  it("returns the first style value for empty string", () => {
    expect(resolveArtStyleValue("")).toBe(ART_STYLES[0].value);
  });

  it("passes through a current valid style unchanged", () => {
    for (const style of ART_STYLES) {
      expect(resolveArtStyleValue(style.value)).toBe(style.value);
    }
  });

  it("resolves every legacy alias to a current style", () => {
    for (const [alias, target] of Object.entries(ART_STYLE_ALIASES)) {
      const result = resolveArtStyleValue(alias);
      expect(
        ART_STYLES.some((s) => s.value === result),
        `alias "${alias}" resolved to "${result}" which is not a current style`,
      ).toBe(true);
      expect(result).toBe(target);
    }
  });

  it("resolves watercolor → cozy-gouache", () => {
    expect(resolveArtStyleValue("watercolor")).toBe("cozy-gouache");
  });

  it("resolves cozy-sketch → geometric-pop", () => {
    expect(resolveArtStyleValue("cozy-sketch")).toBe("geometric-pop");
  });

  it("resolves bold-bright → papercraft-collage", () => {
    expect(resolveArtStyleValue("bold-bright")).toBe("papercraft-collage");
  });

  it("resolves dreamy-pastel → hand-drawn-charm", () => {
    expect(resolveArtStyleValue("dreamy-pastel")).toBe("hand-drawn-charm");
  });

  it("resolves storybook-soft → cozy-gouache", () => {
    expect(resolveArtStyleValue("storybook-soft")).toBe("cozy-gouache");
  });

  it("falls back to first style for unknown slug", () => {
    expect(resolveArtStyleValue("not-a-real-style")).toBe(ART_STYLES[0].value);
  });
});

describe("getArtStylePrompt", () => {
  it("returns a non-empty prompt for every current style", () => {
    for (const style of ART_STYLES) {
      const prompt = getArtStylePrompt(style.value);
      expect(prompt.length).toBeGreaterThan(0);
    }
  });

  it("returns a prompt for a legacy alias", () => {
    const prompt = getArtStylePrompt("watercolor");
    const expected = ART_STYLES.find((s) => s.value === "cozy-gouache")!.prompt;
    expect(prompt).toBe(expected);
  });

  it("returns the default prompt for undefined", () => {
    expect(getArtStylePrompt(undefined)).toBe(ART_STYLES[0].prompt);
  });

  it("returns the default prompt for unknown slug", () => {
    expect(getArtStylePrompt("mystery-style")).toBe(ART_STYLES[0].prompt);
  });
});
