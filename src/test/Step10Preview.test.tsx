/**
 * Step10Preview — checkout step tests
 *
 * Key assertions:
 * 1. A Back button is rendered (bug fix)
 * 2. The old misleading heading ("book is ready") is gone
 * 3. The "after checkout" promise is present in the page
 * 4. The pay/checkout CTA is still rendered
 * 5. create-payment-intent is called on mount and plan select
 * 5a. Only the digital plan is offered while hardcover is off (THI-35)
 * 5b. Buyer name/email are sent to create-payment-intent before payment (THI-35)
 * 5c. The brief and approved portrait are saved on the order before payment, so the
 *     server can start the book if the browser never does (THI-38)
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
let mockHardcoverEnabled = false;
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

vi.mock("@/lib/checkoutPlans", () => ({
  get HARDCOVER_ENABLED() {
    return mockHardcoverEnabled;
  },
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
  mockHardcoverEnabled = false;

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

  it("promises an email when the book is ready, not an editing step (THI-39)", () => {
    renderStep({ childName: "Ellie" });
    expect(screen.getByText(/we'll email you when the book is ready/i)).toBeInTheDocument();
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

  // jsdom can't measure layout, so check the classes that let the label wrap
  // instead of pushing the button off a narrow phone screen.
  it("Pay button can shrink and wrap on a narrow screen", () => {
    renderStep({ childName: "Ellie" });
    const pay = screen.getByRole("button", { name: /pay/i });
    expect(pay).toHaveClass("min-w-0");
    expect(pay).toHaveClass("whitespace-normal");
  });

  it("renders name and email inputs", () => {
    renderStep({ childName: "Ellie" });
    expect(screen.getByPlaceholderText(/sarah johnson/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
  });
});

// ── Payment Element (TDD) ──────────────────────────────────────────────────────

describe("Step10Preview — Payment Element", () => {
  it("calls create-payment-intent on mount with the default digital plan", async () => {
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => {
      expect(callEdge).toHaveBeenCalledWith(
        "create-payment-intent",
        expect.objectContaining({ product: "digital", draft_id: "draft-1" }),
      );
    });
  });

  it("calls create-payment-intent when a different plan card is clicked (hardcover enabled)", async () => {
    mockHardcoverEnabled = true;
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => expect(vi.mocked(callEdge)).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /printed hardcover/i }));

    await waitFor(() => {
      expect(callEdge).toHaveBeenCalledWith(
        "create-payment-intent",
        expect.objectContaining({ product: "hardcover" }),
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

// ── Checkout promises match what we deliver (THI-39) ──────────────────────────

describe("Step10Preview — checkout only promises what we deliver (THI-39)", () => {
  it("does not show the invented testimonial", () => {
    renderStep({ childName: "Ellie" });
    expect(screen.queryByText(/carol, grandmother/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/grandma, it's me/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("blockquote")).not.toBeInTheDocument();
  });

  it("does not promise a PDF, instant delivery, a gift link, printing or editing", () => {
    const { container } = renderStep({ childName: "Ellie" });
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/pdf/i);
    expect(text).not.toMatch(/instant/i);
    expect(text).not.toMatch(/gift link/i);
    expect(text).not.toMatch(/print it yourself/i);
    expect(text).not.toMatch(/review and edit/i);
  });

  it("does not promise free shipping while hardcover is off", () => {
    const { container } = renderStep({ childName: "Ellie" });
    expect(container.textContent ?? "").not.toMatch(/shipping/i);
  });

  it("tells the buyer what they get today: a book to view in the app and an email when it's ready", () => {
    renderStep({ childName: "Ellie" });
    expect(screen.getByText(/fully illustrated book you can view in the app/i)).toBeInTheDocument();
    expect(screen.getByText(/email when your book is ready/i)).toBeInTheDocument();
  });
});

// ── Digital-only soft launch + buyer details (THI-35) ─────────────────────────

describe("Step10Preview — digital-only checkout (THI-35)", () => {
  it("shows only the digital plan when hardcover is off", () => {
    renderStep({ childName: "Ellie" });
    expect(screen.getByRole("button", { name: /digital book/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /printed hardcover/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/most popular/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/street address/i)).not.toBeInTheDocument();
  });

  it("selects the digital plan by default", async () => {
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => expect(callEdge).toHaveBeenCalled());
    for (const call of vi.mocked(callEdge).mock.calls) {
      expect(call[1]).toEqual(expect.objectContaining({ product: "digital" }));
    }
  });
});

describe("Step10Preview — buyer details reach the server before payment (THI-35)", () => {
  async function fillBuyerAndPay() {
    await waitFor(() => screen.getByTestId("payment-element"));
    fireEvent.change(screen.getByPlaceholderText(/sarah johnson/i), {
      target: { value: "  Sarah Johnson " },
    });
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), {
      target: { value: "sarah@example.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: /pay \$/i }));
  }

  it("sends buyer_name and buyer_email to create-payment-intent before confirmPayment", async () => {
    const order: string[] = [];
    vi.mocked(callEdge).mockImplementation(async (_name, body) => {
      const b = body as Record<string, unknown>;
      // The separate brief-saving call (THI-38) also carries the buyer fields; skip it here.
      if (b.buyer_email && !b.brief) order.push("update-order");
      return {
        data: { client_secret: "pi_test_secret", order_id: "order-123", amount_cents: 999, discount_cents: 0 },
        error: null,
      };
    });
    mockConfirmPayment.mockImplementation(async () => {
      order.push("confirm");
      return { error: null };
    });

    renderStep({ childName: "Ellie" }, "draft-1");
    await fillBuyerAndPay();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/step/12-generating"));

    // The request body must use the field names create-payment-intent reads
    // (body.buyer_name / body.buyer_email / body.product / body.draft_id).
    expect(callEdge).toHaveBeenCalledWith("create-payment-intent", {
      product: "digital",
      draft_id: "draft-1",
      buyer_name: "Sarah Johnson",
      buyer_email: "sarah@example.com",
    });
    expect(order).toEqual(["update-order", "confirm"]);
  });

  // THI-38: create-payment-intent reads body.brief and body.seed_portrait_data_url
  // and saves them on the order. Without them the server can't start the book.
  // They go in their own call, after the buyer details are saved, because the
  // portrait is a multi-MB image and a failed upload must not lose the buyer's
  // email (THI-35).
  it("saves the brief and approved portrait on the order, after the buyer details and before payment (THI-38)", async () => {
    const portrait = "data:image/png;base64,AAAA";
    const order: string[] = [];
    vi.mocked(callEdge).mockImplementation(async (_name, body) => {
      const b = body as Record<string, unknown>;
      if (b.brief) order.push("save-inputs");
      else if (b.buyer_email) order.push("save-buyer");
      return {
        data: { client_secret: "pi_test_secret", order_id: "order-123", amount_cents: 999, discount_cents: 0 },
        error: null,
      };
    });
    mockConfirmPayment.mockImplementation(async () => {
      order.push("confirm");
      return { error: null };
    });

    renderStep(
      { childName: "Ellie", characterPortrait: { status: "ready", dataUrl: portrait } },
      "draft-1",
    );
    await fillBuyerAndPay();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/step/12-generating"));

    // Same field names create-payment-intent reads; it also gets the buyer
    // details again so this call doesn't blank them on the order.
    expect(callEdge).toHaveBeenCalledWith("create-payment-intent", {
      product: "digital",
      draft_id: "draft-1",
      buyer_name: "Sarah Johnson",
      buyer_email: "sarah@example.com",
      brief: expect.objectContaining({ child: expect.objectContaining({ name: "Ellie" }) }),
      seed_portrait_data_url: portrait,
    });
    expect(order).toEqual(["save-buyer", "save-inputs", "confirm"]);
  });

  it("still pays if saving the brief fails, and the buyer details were already saved (THI-38)", async () => {
    vi.mocked(callEdge).mockImplementation(async (_name, body) => {
      if ((body as Record<string, unknown>).brief) return { data: null, error: new Error("payload too large") };
      return {
        data: { client_secret: "pi_test_secret", order_id: "order-123", amount_cents: 999, discount_cents: 0 },
        error: null,
      };
    });

    renderStep({ childName: "Ellie" }, "draft-1");
    await fillBuyerAndPay();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/step/12-generating"));

    expect(callEdge).toHaveBeenCalledWith(
      "create-payment-intent",
      expect.objectContaining({ buyer_email: "sarah@example.com" }),
    );
    expect(mockConfirmPayment).toHaveBeenCalled();
  });

  it("retries saving the brief once when the server says it was not saved (THI-38)", async () => {
    let briefCalls = 0;
    vi.mocked(callEdge).mockImplementation(async (_name, body) => {
      const data: Record<string, unknown> = {
        client_secret: "pi_test_secret", order_id: "order-123", amount_cents: 999, discount_cents: 0,
      };
      if ((body as Record<string, unknown>).brief) {
        briefCalls += 1;
        // create-payment-intent reports book_inputs_saved; false means its save failed.
        data.book_inputs_saved = briefCalls > 1;
      }
      return { data, error: null };
    });

    renderStep({ childName: "Ellie" }, "draft-1");
    await fillBuyerAndPay();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/step/12-generating"));

    expect(briefCalls).toBe(2);
  });

  it("retries the brief save once when the request itself fails, then still pays (THI-38)", async () => {
    let briefCalls = 0;
    vi.mocked(callEdge).mockImplementation(async (_name, body) => {
      if ((body as Record<string, unknown>).brief) {
        briefCalls += 1;
        return { data: null, error: new Error("network") };
      }
      return {
        data: { client_secret: "pi_test_secret", order_id: "order-123", amount_cents: 999, discount_cents: 0 },
        error: null,
      };
    });

    renderStep({ childName: "Ellie" }, "draft-1");
    await fillBuyerAndPay();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/step/12-generating"));

    expect(briefCalls).toBe(2); // one try plus one retry, not more
    expect(mockConfirmPayment).toHaveBeenCalled();
  });

  it("still saves the brief when the buyer-details call fails, so the retry covers that case too (THI-38)", async () => {
    let briefCalls = 0;
    vi.mocked(callEdge).mockImplementation(async (_name, body) => {
      const b = body as Record<string, unknown>;
      if (b.brief) {
        briefCalls += 1;
        return { data: { client_secret: "s", order_id: "order-123", amount_cents: 999, discount_cents: 0, book_inputs_saved: true }, error: null };
      }
      if (b.buyer_email) return { data: null, error: new Error("rate limited") };
      return { data: { client_secret: "s", order_id: "order-123", amount_cents: 999, discount_cents: 0 }, error: null };
    });

    renderStep({ childName: "Ellie" }, "draft-1");
    await fillBuyerAndPay();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/step/12-generating"));

    expect(briefCalls).toBe(1);
  });

  it("stops and shows the new total if the price changes during the brief save (THI-38)", async () => {
    vi.mocked(callEdge).mockImplementation(async (_name, body) => {
      const amount = (body as Record<string, unknown>).brief ? 499 : 999;
      return { data: { client_secret: "s", order_id: "order-123", amount_cents: amount, discount_cents: 0, book_inputs_saved: true }, error: null };
    });

    renderStep({ childName: "Ellie" }, "draft-1");
    await fillBuyerAndPay();

    await screen.findByText(/the price changed/i);
    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith("/step/12-generating");
  });

  it("keeps the large brief and portrait off the mount and promo-code calls (THI-38)", async () => {
    renderStep(
      { childName: "Ellie", characterPortrait: { status: "ready", dataUrl: "data:image/png;base64,AAAA" } },
      "draft-1",
    );
    await waitFor(() => screen.getByTestId("payment-element"));

    const mountBody = vi.mocked(callEdge).mock.calls[0][1] as Record<string, unknown>;
    expect(mountBody).not.toHaveProperty("brief");
    expect(mountBody).not.toHaveProperty("seed_portrait_data_url");
  });

  it("keeps an applied promo code on the pre-payment update", async () => {
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => screen.getByTestId("payment-element"));

    vi.mocked(callEdge).mockResolvedValueOnce({
      data: { client_secret: "pi_test_secret", order_id: "order-123", amount_cents: 499, discount_cents: 500 },
      error: null,
    });
    fireEvent.change(screen.getByPlaceholderText(/enter promo code/i), {
      target: { value: "SAVE50" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));
    await waitFor(() => screen.getByRole("button", { name: /pay \$4\.99/i }));

    // The server keeps the discount, so the price is unchanged. Both pre-payment
    // calls (buyer details, then the brief save from THI-38) hit this mock.
    vi.mocked(callEdge).mockResolvedValue({
      data: { client_secret: "pi_test_secret", order_id: "order-123", amount_cents: 499, discount_cents: 500 },
      error: null,
    });
    await fillBuyerAndPay();
    await waitFor(() => expect(mockConfirmPayment).toHaveBeenCalled());

    // Every call that writes the order must re-send the code, or it would reset the discount.
    const preConfirm = vi.mocked(callEdge).mock.calls
      .map(([, body]) => body as Record<string, unknown>)
      .filter((body) => body.buyer_email);
    expect(preConfirm).toHaveLength(2);
    for (const body of preConfirm) {
      expect(body).toEqual(expect.objectContaining({
        buyer_email: "sarah@example.com",
        discount_code: "SAVE50",
      }));
    }
  });

  it("does not resend a promo code the server rejected", async () => {
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => screen.getByTestId("payment-element"));

    vi.mocked(callEdge).mockResolvedValueOnce({
      data: { client_secret: "pi_test_secret", order_id: "order-123", amount_cents: 999, discount_cents: 0, discount_invalid: true },
      error: null,
    });
    fireEvent.change(screen.getByPlaceholderText(/enter promo code/i), {
      target: { value: "BADCODE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));
    await waitFor(() => screen.getByText(/invalid or expired/i));

    await fillBuyerAndPay();
    await waitFor(() => expect(mockConfirmPayment).toHaveBeenCalled());

    const calls = vi.mocked(callEdge).mock.calls;
    const preConfirm = calls[calls.length - 1][1] as Record<string, unknown>;
    expect(preConfirm.buyer_email).toBe("sarah@example.com");
    expect(preConfirm).not.toHaveProperty("discount_code");
  });

  it("still takes the payment if saving buyer details fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => screen.getByTestId("payment-element"));

    vi.mocked(callEdge).mockResolvedValueOnce({ data: null, error: new Error("boom") });
    await fillBuyerAndPay();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/step/12-generating"));
    expect(mockConfirmPayment).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("still takes the payment if the save request throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => screen.getByTestId("payment-element"));

    vi.mocked(callEdge).mockRejectedValueOnce(new Error("network down"));
    await fillBuyerAndPay();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/step/12-generating"));
    expect(mockConfirmPayment).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("stops before paying and shows the new total if the server price changed", async () => {
    vi.mocked(callEdge).mockResolvedValue({
      data: { client_secret: "pi_test_secret", order_id: "order-123", amount_cents: 999, discount_cents: 0 },
      error: null,
    });
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => screen.getByRole("button", { name: /pay \$9\.99/i }));

    vi.mocked(callEdge).mockResolvedValueOnce({
      data: { client_secret: "pi_test_secret", order_id: "order-123", amount_cents: 1299, discount_cents: 0 },
      error: null,
    });
    await fillBuyerAndPay();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/price changed/i));
    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /pay \$12\.99/i })).toBeInTheDocument();
  });

  it("does not call the server or Stripe when the buyer form is invalid", async () => {
    renderStep({ childName: "Ellie" }, "draft-1");
    await waitFor(() => screen.getByTestId("payment-element"));
    const callsBefore = vi.mocked(callEdge).mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /pay \$/i }));

    await waitFor(() => screen.getByText(/enter a valid email/i));
    expect(vi.mocked(callEdge).mock.calls.length).toBe(callsBefore);
    expect(mockConfirmPayment).not.toHaveBeenCalled();
  });
});

// ── Shipping address block (Task 8) ───────────────────────────────────────────

describe("Step10Preview — shipping address block", () => {
  beforeEach(() => {
    mockHardcoverEnabled = true;
  });

  it("shows shipping fields when hardcover is selected", () => {
    renderStep({ childName: "Ellie" });
    fireEvent.click(screen.getByRole("button", { name: /printed hardcover/i }));
    expect(screen.getByPlaceholderText(/street address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/zip code/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/phone/i)).toBeInTheDocument();
  });

  it("hides shipping fields when digital is selected", () => {
    renderStep({ childName: "Ellie" });
    fireEvent.click(screen.getByRole("button", { name: /printed hardcover/i }));
    fireEvent.click(screen.getByRole("button", { name: /digital book/i }));
    expect(screen.queryByPlaceholderText(/street address/i)).not.toBeInTheDocument();
  });

  it("blocks pay and shows required errors when shipping fields are missing on hardcover", async () => {
    renderStep(
      { childName: "Ellie", buyer_name: "Test User", buyer_email: "test@example.com" },
      "draft-1",
    );
    await waitFor(() => screen.getByTestId("payment-element"));
    fireEvent.click(screen.getByRole("button", { name: /printed hardcover/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /printed hardcover/i }));

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
