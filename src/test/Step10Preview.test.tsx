/**
 * Step10Preview — checkout step tests
 *
 * Key assertions:
 * 1. A Back button is rendered (bug fix)
 * 2. The old misleading heading ("book is ready") is gone
 * 3. The "after checkout" promise is present in the page
 * 4. The pay/checkout CTA is still rendered
 * 5. create-payment-intent is called on mount and plan select
 * 6. Pay button shows server-returned amount
 * 7. Successful payment navigates to step 12 and saves orderId
 * 8. Failed payment shows error message, does not navigate
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// ── Captured mock handles ──────────────────────────────────────────────────────

let mockDraftId: string | null = null;
let mockBypassCheckout = false;
const mockSetAnswer = vi.fn();
const mockNavigate = vi.fn();
const mockConfirmPayment = vi.fn();

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/components/WizardHeader", () => ({
  default: () => <div data-testid="wizard-header" />,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }),
  },
}));

vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/contexts/WizardContext", () => ({
  useWizard: () => ({
    canContinue: true,
    setCanContinue: vi.fn(),
    answers: mockAnswers,
    setAnswer: mockSetAnswer,
    seedAnswers: vi.fn(),
    isGenerating: false,
    setIsGenerating: vi.fn(),
    draftId: mockDraftId,
    setDraftId: vi.fn(),
    resetWizard: vi.fn(),
  }),
}));

vi.mock("@/lib/edgeFunctions", () => ({
  callEdge: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripePromise: Promise.resolve(null),
}));

vi.mock("@/lib/testMode", () => ({
  useTestMode: () => [{ bypassCheckout: mockBypassCheckout }, vi.fn()],
  getTestMode: () => ({ bypassCheckout: mockBypassCheckout }),
}));

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: vi.fn(),
  useElements: vi.fn(),
}));

// ── Import component and mocked modules after vi.mock declarations ─────────────

import Step10Preview from "@/pages/steps/Step10Preview";
import { callEdge } from "@/lib/edgeFunctions";
import { useStripe, useElements } from "@stripe/react-stripe-js";

// ── Helper ─────────────────────────────────────────────────────────────────────

let mockAnswers: Record<string, unknown> = {};

function renderStep(answers: Record<string, unknown> = {}, draftId: string | null = null) {
  mockAnswers = answers;
  mockDraftId = draftId;
  return render(
    <MemoryRouter initialEntries={["/step/11-preview"]}>
      <Routes>
        <Route path="/step/:step" element={<Step10Preview />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAnswers = {};
  mockDraftId = null;
  mockBypassCheckout = false;

  vi.mocked(callEdge).mockResolvedValue({
    data: { client_secret: "pi_test_secret", order_id: "order-123", amount_cents: 5499, discount_cents: 0 },
    error: null,
  });

  vi.mocked(useStripe).mockReturnValue({ confirmPayment: mockConfirmPayment } as ReturnType<typeof useStripe>);
  vi.mocked(useElements).mockReturnValue({} as ReturnType<typeof useElements>);
  mockConfirmPayment.mockResolvedValue({ error: null });
});

// ── Existing tests ─────────────────────────────────────────────────────────────

describe("Step10Preview — Back button (bug fix)", () => {
  it("renders a Back button", () => {
    renderStep({ childName: "Ellie" });
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });
});

describe("Step10Preview — honest copy", () => {
  it("does NOT say 'book is ready' in the heading", () => {
    renderStep({ childName: "Ellie" });
    const heading = screen.queryByRole("heading", { name: /book is ready/i });
    expect(heading).not.toBeInTheDocument();
  });

  it("includes an 'after checkout' promise somewhere on the page", () => {
    renderStep({ childName: "Ellie" });
    expect(screen.getByText(/after checkout/i)).toBeInTheDocument();
  });

  it("renders a heading for the child's name", () => {
    renderStep({ childName: "Ellie" });
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
  });
});

describe("Step10Preview — checkout CTA", () => {
  it("renders the Pay button", () => {
    renderStep({ childName: "Ellie" });
    expect(screen.getByRole("button", { name: /pay/i })).toBeInTheDocument();
  });

  it("renders name and email inputs", () => {
    renderStep({ childName: "Ellie" });
    expect(screen.getByPlaceholderText(/sarah johnson/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
  });
});

// ── Payment Element (TDD) ──────────────────────────────────────────────────────

describe("Step10Preview — Payment Element", () => {
  it("calls create-payment-intent on mount with the default hardcover plan", async () => {
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => {
      expect(callEdge).toHaveBeenCalledWith(
        "create-payment-intent",
        expect.objectContaining({ product: "hardcover", draft_id: "draft-1" }),
      );
    });
  });

  it("calls create-payment-intent when a different plan card is clicked", async () => {
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => expect(vi.mocked(callEdge)).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /digital book/i }));

    await waitFor(() => {
      expect(callEdge).toHaveBeenCalledWith(
        "create-payment-intent",
        expect.objectContaining({ product: "digital" }),
      );
    });
  });

  it("does not call create-payment-intent when draftId is null", () => {
    renderStep({ childName: "Ellie" }); // draftId defaults to null
    expect(callEdge).not.toHaveBeenCalled();
  });

  it("shows the server-returned amount on the pay button", async () => {
    vi.mocked(callEdge).mockResolvedValue({
      data: { client_secret: "pi_secret", order_id: "ord-1", amount_cents: 5499, discount_cents: 0 },
      error: null,
    });
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pay \$54\.99/i })).toBeInTheDocument();
    });
  });

  it("renders the PaymentElement once client secret is available", async () => {
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => {
      expect(screen.getByTestId("payment-element")).toBeInTheDocument();
    });
  });

  it("navigates to the generating step and saves orderId on success", async () => {
    renderStep(
      { childName: "Ellie", buyer_name: "Test User", buyer_email: "test@example.com" },
      "draft-1",
    );

    await waitFor(() => screen.getByTestId("payment-element"));

    // Switch to digital to skip shipping validation in this flow test
    fireEvent.click(screen.getByRole("button", { name: /digital book/i }));
    await waitFor(() => screen.getByTestId("payment-element"));

    fireEvent.click(screen.getByRole("button", { name: /pay \$54\.99/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/step/12-generating");
    });
    expect(mockSetAnswer).toHaveBeenCalledWith("orderId", "order-123");
  });

  it("shows an inline error message and does not navigate on payment failure", async () => {
    mockConfirmPayment.mockResolvedValue({ error: { message: "Card declined." } });

    renderStep(
      { childName: "Ellie", buyer_name: "Test User", buyer_email: "test@example.com" },
      "draft-1",
    );

    await waitFor(() => screen.getByTestId("payment-element"));

    // Switch to digital to skip shipping validation in this flow test
    fireEvent.click(screen.getByRole("button", { name: /digital book/i }));
    await waitFor(() => screen.getByTestId("payment-element"));

    fireEvent.click(screen.getByRole("button", { name: /pay \$54\.99/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Card declined.");
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows a PI error message when create-payment-intent fails", async () => {
    vi.mocked(callEdge).mockResolvedValue({ data: null, error: new Error("Network error") });

    renderStep({ childName: "Ellie" }, "draft-1");

    await waitFor(() => {
      expect(screen.getByText(/unable to initialize payment/i)).toBeInTheDocument();
    });
  });
});

// ── Shipping address block (Task 8) ───────────────────────────────────────────

describe("Step10Preview — shipping address block", () => {
  it("shows shipping fields when hardcover is selected", () => {
    renderStep({ childName: "Ellie" });
    expect(screen.getByPlaceholderText(/street address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/zip code/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/phone/i)).toBeInTheDocument();
  });

  it("hides shipping fields when digital is selected", () => {
    renderStep({ childName: "Ellie" });
    fireEvent.click(screen.getByRole("button", { name: /digital book/i }));
    expect(screen.queryByPlaceholderText(/street address/i)).not.toBeInTheDocument();
  });

  it("blocks pay and shows required errors when shipping fields are missing on hardcover", async () => {
    renderStep(
      { childName: "Ellie", buyer_name: "Test User", buyer_email: "test@example.com" },
      "draft-1",
    );
    await waitFor(() => screen.getByTestId("payment-element"));

    fireEvent.click(screen.getByRole("button", { name: /pay \$54\.99/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/required/i).length).toBeGreaterThan(0);
    });
    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("passes shipping to create-payment-intent when plan changes (last call has hardcover)", async () => {
    renderStep({ childName: "Ellie" }, "draft-1");

    // Fill in a street to make shipping non-empty
    fireEvent.change(screen.getByPlaceholderText(/street address/i), {
      target: { value: "123 Main St" },
    });

    // Toggle plan to trigger PI re-call
    fireEvent.click(screen.getByRole("button", { name: /digital book/i }));
    fireEvent.click(screen.getByRole("button", { name: /printed hardcover/i }));

    await waitFor(() => {
      const calls = vi.mocked(callEdge).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(expect.objectContaining({ product: "hardcover" }));
    });
  });
});

// ── Discount code field (Task 9) ──────────────────────────────────────────────

describe("Step10Preview — discount code field", () => {
  it("shows a promo code input", () => {
    renderStep({ childName: "Ellie" });
    expect(screen.getByPlaceholderText(/enter promo code/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^apply$/i })).toBeInTheDocument();
  });

  it("applying a valid code updates the displayed amount", async () => {
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => screen.getByTestId("payment-element"));

    // Switch to digital so shipping validation is skipped for the apply call
    fireEvent.click(screen.getByRole("button", { name: /digital book/i }));
    await waitFor(() => screen.getByTestId("payment-element"));

    vi.mocked(callEdge).mockResolvedValueOnce({
      data: {
        client_secret: "pi_discounted",
        order_id: "order-123",
        amount_cents: 499,
        discount_cents: 500,
        discount_invalid: false,
      },
      error: null,
    });

    fireEvent.change(screen.getByPlaceholderText(/enter promo code/i), {
      target: { value: "SAVE50" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pay \$4\.99/i })).toBeInTheDocument();
    });
  });

  it("applying an invalid code shows an error and keeps the amount unchanged", async () => {
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => screen.getByTestId("payment-element"));

    // Switch to digital so shipping validation is skipped
    fireEvent.click(screen.getByRole("button", { name: /digital book/i }));
    await waitFor(() => screen.getByTestId("payment-element"));

    vi.mocked(callEdge).mockResolvedValueOnce({
      data: {
        client_secret: "pi_test_secret",
        order_id: "order-123",
        amount_cents: 5499,
        discount_cents: 0,
        discount_invalid: true,
      },
      error: null,
    });

    fireEvent.change(screen.getByPlaceholderText(/enter promo code/i), {
      target: { value: "BADCODE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid or expired/i)).toBeInTheDocument();
    });
    // Amount stays at the current value from the initial PI
    expect(screen.getByRole("button", { name: /pay \$54\.99/i })).toBeInTheDocument();
  });
});

// ── Bypass checkout (dev flag, Task 11) ───────────────────────────────────────

describe("Step10Preview — bypassCheckout dev flag", () => {
  it("shows a skip-checkout button when bypassCheckout is on", () => {
    mockBypassCheckout = true;
    renderStep({ childName: "Ellie" });
    expect(screen.getByRole("button", { name: /skip checkout/i })).toBeInTheDocument();
  });

  it("hides the Payment Element when bypassCheckout is on", () => {
    mockBypassCheckout = true;
    renderStep({ childName: "Ellie" });
    expect(screen.queryByTestId("payment-element")).not.toBeInTheDocument();
  });

  it("navigates directly to step 12 when bypass button is clicked", () => {
    mockBypassCheckout = true;
    renderStep({ childName: "Ellie" });
    fireEvent.click(screen.getByRole("button", { name: /skip checkout/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/step/12-generating");
  });
});
