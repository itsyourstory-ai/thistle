import { describe, it, expect } from "vitest";
import { TOTAL_STEPS, pathForStep, stepNumFromSlug } from "./wizardSteps";

describe("wizardSteps", () => {
  it("has 11 total steps", () => {
    expect(TOTAL_STEPS).toBe(11);
  });

  it("pathForStep returns the correct paths for the split preview steps", () => {
    expect(pathForStep(8)).toBe("/step/8-story");
    expect(pathForStep(9)).toBe("/step/9-cast");
    expect(pathForStep(10)).toBe("/step/10-preview");
    expect(pathForStep(11)).toBe("/step/11-generating");
  });

  it("stepNumFromSlug resolves the new slugs correctly", () => {
    expect(stepNumFromSlug("8-story")).toBe(8);
    expect(stepNumFromSlug("9-cast")).toBe(9);
    expect(stepNumFromSlug("10-preview")).toBe(10);
    expect(stepNumFromSlug("11-generating")).toBe(11);
  });

  it("pathForStep still works for steps 1–7", () => {
    expect(pathForStep(1)).toBe("/step/1-name");
    expect(pathForStep(7)).toBe("/step/7-character");
  });
});
