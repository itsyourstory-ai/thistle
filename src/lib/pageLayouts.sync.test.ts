import { describe, it, expect } from "vitest";
import { PAGE_LAYOUTS as CLIENT_LAYOUTS } from "./pageLayouts";
import { PAGE_LAYOUTS as SERVER_LAYOUTS } from "../../supabase/functions/_shared/layouts";

// src/lib/pageLayouts.ts is a hand-maintained mirror of the server registry in
// supabase/functions/_shared/layouts.ts. The dev preview renderer keys off the
// id / textPlacement / illustrationCoverage of each layout, so this test fails
// the moment the two files drift on those fields (including order and
// add/remove of layouts).
describe("pageLayouts mirror", () => {
  const pick = (l: {
    id: string;
    textPlacement: string;
    illustrationCoverage: string;
  }) => ({
    id: l.id,
    textPlacement: l.textPlacement,
    illustrationCoverage: l.illustrationCoverage,
  });

  it("mirrors the server registry id/textPlacement/illustrationCoverage exactly", () => {
    expect(CLIENT_LAYOUTS.map(pick)).toEqual(SERVER_LAYOUTS.map(pick));
  });
});
