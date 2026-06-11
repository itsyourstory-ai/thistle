import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  uploadPhotos,
  serializeAnswers,
  deserializeAnswers,
} from "@/lib/draftPhotos";
import type { WizardAnswers } from "@/lib/wizardTypes";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com/photo.jpg" },
          error: null,
        }),
      }),
    },
  },
}));

global.fetch = vi.fn().mockResolvedValue({
  arrayBuffer: async () => new ArrayBuffer(3),
}) as unknown as typeof fetch;

// Minimal valid base64 data URL — base64 payload is just "abc" (3 bytes)
const FAKE_DATA_URL = "data:image/jpeg;base64,YWJj";

const makeAnswers = (overrides: Partial<WizardAnswers> = {}): WizardAnswers => ({
  childName: "Alex",
  protagonist: {
    photos: [FAKE_DATA_URL],
    name: "Alex",
    age: "5",
    gender: "boy",
    special: "",
    appearance: {
      hairColor: "brown",
      hairStyle: "short",
      skinTone: "medium",
      glasses: false,
      features: "",
    },
    traits: [{ word: "brave" }],
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("serializeAnswers", () => {
  it("replaces protagonist photos with storage paths", async () => {
    const answers = makeAnswers();
    const result = await serializeAnswers("user-1", "draft-1", answers);

    const proto = result.protagonist as { photos: string[] };
    expect(proto.photos).toHaveLength(1);
    expect(proto.photos[0]).toBe("draft-photos/user-1/draft-1/photo-0.jpg");
  });

  it("strips characterPortrait, supportingPortraits, and appearanceAutofillHash", async () => {
    const answers = makeAnswers({
      characterPortrait: { status: "ready", dataUrl: FAKE_DATA_URL },
      supportingPortraits: { "char-1": { status: "ready", dataUrl: FAKE_DATA_URL } },
      appearanceAutofillHash: "abc123",
    });
    const result = await serializeAnswers("user-1", "draft-1", answers);

    expect(result).not.toHaveProperty("characterPortrait");
    expect(result).not.toHaveProperty("supportingPortraits");
    expect(result).not.toHaveProperty("appearanceAutofillHash");
  });

  it("strips selectedConcept.coverImage but preserves text fields", async () => {
    const answers = makeAnswers({
      selectedConcept: {
        title: "The Great Adventure",
        summary: "A story about bravery",
        framework_id: "framework-abc",
        coverImage: FAKE_DATA_URL,
      },
    });
    const result = await serializeAnswers("user-1", "draft-1", answers);

    const concept = result.selectedConcept as Record<string, unknown>;
    expect(concept).not.toHaveProperty("coverImage");
    expect(concept.title).toBe("The Great Adventure");
    expect(concept.summary).toBe("A story about bravery");
    expect(concept.framework_id).toBe("framework-abc");
  });
});

describe("deserializeAnswers", () => {
  it("restores protagonist photos from storage paths to data URLs", async () => {
    const persisted: Record<string, unknown> = {
      childName: "Alex",
      protagonist: {
        photos: ["draft-photos/user-1/draft-1/photo-0.jpg"],
        name: "Alex",
        age: "5",
        gender: "boy",
        special: "",
        appearance: {
          hairColor: "brown",
          hairStyle: "short",
          skinTone: "medium",
          glasses: false,
          features: "",
        },
        traits: [{ word: "brave" }],
      },
    };

    const result = await deserializeAnswers(persisted);

    expect(result.protagonist?.photos).toHaveLength(1);
    // The downloaded photo should be a data URL
    expect(result.protagonist?.photos[0]).toMatch(/^data:image\/jpeg;base64,/);
  });
});

describe("uploadPhotos", () => {
  it("skips entries that already start with draft-photos/", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({
      upload: uploadMock,
      createSignedUrl: vi.fn(),
    });

    const photos = [
      "draft-photos/user-1/draft-1/photo-0.jpg",
      FAKE_DATA_URL,
    ];

    const result = await uploadPhotos("user-1", "draft-1", photos);

    // First photo was already a path — upload should only be called once
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(result[0]).toBe("draft-photos/user-1/draft-1/photo-0.jpg");
    expect(result[1]).toBe("draft-photos/user-1/draft-1/photo-1.jpg");
  });
});
