import { describe, it, expect } from "vitest";
import { TOTAL_STEPS, pathForStep, stepNumFromSlug } from "./wizardSteps";

describe("wizardSteps", () => {
  it("has 12 total steps", () => {
    expect(TOTAL_STEPS).toBe(12);
  });

  it("pathForStep returns the correct paths for all post-character steps", () => {
    expect(pathForStep(8)).toBe("/step/8-dedication");
    expect(pathForStep(9)).toBe("/step/9-story");
    expect(pathForStep(10)).toBe("/step/10-cast");
    expect(pathForStep(11)).toBe("/step/11-preview");
    expect(pathForStep(12)).toBe("/step/12-generating");
  });

  it("stepNumFromSlug resolves the new slugs correctly", () => {
    expect(stepNumFromSlug("8-dedication")).toBe(8);
    expect(stepNumFromSlug("9-story")).toBe(9);
    expect(stepNumFromSlug("10-cast")).toBe(10);
    expect(stepNumFromSlug("11-preview")).toBe(11);
    expect(stepNumFromSlug("12-generating")).toBe(12);
  });

  it("pathForStep still works for steps 1–7", () => {
    expect(pathForStep(1)).toBe("/step/1-name");
    expect(pathForStep(7)).toBe("/step/7-character");
  });
});
