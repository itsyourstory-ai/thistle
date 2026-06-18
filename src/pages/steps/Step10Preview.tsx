import { useState, useEffect } from "react";
import { pathForStep } from "@/lib/wizardSteps";
import { useNavigate } from "react-router-dom";
import { useWizard } from "@/contexts/WizardContext";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { stripePromise } from "@/lib/stripe";
import { callEdge } from "@/lib/edgeFunctions";
import { useTestMode } from "@/lib/testMode";

import { Check } from "lucide-react";
import WizardShell from "@/components/WizardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Plan = "digital" | "hardcover";

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "DC", name: "D.C." }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

const DIGITAL_FEATURES = [
  "Full illustrated eBook (PDF)",
  "Delivered instantly by email",
  "Shareable gift link",
  "Print it yourself anytime",
];

const HARDCOVER_FEATURES = [
  "Everything in Digital",
  "Premium hardcover, printed & shipped",
  "Ships in 5–7 business days",
  "Free digital copy included",
];

// ── Inner payment form (must be inside <Elements> provider) ──────────────────

interface PaymentFormProps {
  amountLabel: string;
  orderId: string;
  onValidate: () => boolean;
  onSuccess: (orderId: string) => void;
}

function PaymentForm({ amountLabel, orderId, onValidate, onSuccess }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!onValidate()) return;
    if (!stripe || !elements) return;

    setPaying(true);
    setPayError(null);

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    setPaying(false);

    if (error) {
      setPayError(error.message ?? "Payment failed. Please try again.");
      return;
    }

    onSuccess(orderId);
  };

  return (
    <>
      <PaymentElement />
      {payError && (
        <p className="text-xs text-destructive mt-1" role="alert">
          {payError}
        </p>
      )}
      <div className="flex items-center gap-3 mt-2">
        <Button
          type="button"
          variant="wizardOutline"
          size="pill"
          onClick={() => navigate(pathForStep(9))}
          className="flex-none"
          disabled={paying}
        >
          ← Back
        </Button>
        <Button
          type="button"
          variant="wizard"
          size="pill"
          onClick={handlePay}
          disabled={paying || !stripe || !elements}
          className="flex-1"
        >
          {paying ? "Processing…" : `Pay ${amountLabel} & start crafting`}
        </Button>
      </div>
    </>
  );
}

// ── Main checkout step ────────────────────────────────────────────────────────

// AIDEV-NOTE: This step uses WizardShell with a custom footer so the shell
// provides the header (with Back button) while the sticky bar shows the
// checkout form instead of the default Back/Continue buttons. The checkout
// section is too complex to squeeze into continueLabel/onBeforeContinue.
export default function Step9Preview() {
  const { answers, setAnswer, draftId } = useWizard();
  const navigate = useNavigate();
  const [testMode] = useTestMode();
  const bypassCheckout = import.meta.env.DEV && testMode.bypassCheckout;
  const name = answers.childName || "your little one";
  const concept = answers.selectedConcept || {};
  const title = concept.title || answers.bookTitle || `${name}'s Adventure`;
  const coverImage: string | undefined = concept.coverImage;

  const [selected, setSelected] = useState<Plan>("hardcover");

  // Buyer form state
  const [buyerName, setBuyerName] = useState<string>(answers.buyer_name || "");
  const [buyerEmail, setBuyerEmail] = useState<string>(answers.buyer_email || "");
  const [buyerErrors, setBuyerErrors] = useState<{ name?: string; email?: string }>({});

  // Discount state
  const [discountCode, setDiscountCode] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountApplying, setDiscountApplying] = useState(false);

  // Shipping state (hardcover only)
  const [shippingName, setShippingName] = useState("");
  const [shippingStreet1, setShippingStreet1] = useState("");
  const [shippingStreet2, setShippingStreet2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingPostcode, setShippingPostcode] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingErrors, setShippingErrors] = useState<Record<string, string>>({});

  // Payment Intent state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [piOrderId, setPiOrderId] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [piError, setPiError] = useState<string | null>(null);

  // Create / update PI when plan changes (also fires on mount). Skipped in bypass mode.
  useEffect(() => {
    if (!draftId || bypassCheckout) return;

    let cancelled = false;
    setClientSecret(null);
    setPiOrderId(null);
    setPiError(null);

    callEdge("create-payment-intent", {
      product: selected,
      draft_id: draftId,
      ...(selected === "hardcover" ? {
        shipping: {
          name: shippingName || undefined,
          street1: shippingStreet1 || undefined,
          street2: shippingStreet2 || undefined,
          city: shippingCity || undefined,
          state_code: shippingState || undefined,
          postcode: shippingPostcode || undefined,
          country_code: "US",
          phone: shippingPhone || undefined,
        },
      } : {}),
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.client_secret) {
        setPiError("Unable to initialize payment. Please try again.");
        return;
      }
      setClientSecret(data.client_secret);
      setPiOrderId(data.order_id);
      setAmountCents(data.amount_cents);
    });

    return () => { cancelled = true; };
  }, [selected, draftId]);

  const amountLabel =
    amountCents != null
      ? `$${(amountCents / 100).toFixed(2)}`
      : selected === "digital"
        ? "$9.99"
        : "$54.99";

  const validateShippingForm = (): boolean => {
    if (selected !== "hardcover") return true;
    const errs: Record<string, string> = {};
    if (!shippingStreet1.trim()) errs.street1 = "Required";
    if (!shippingCity.trim()) errs.city = "Required";
    if (!shippingState) errs.state_code = "Required";
    if (!shippingPostcode.trim()) errs.postcode = "Required";
    if (!shippingPhone.trim()) errs.phone = "Required";
    setShippingErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateBuyerForm = (): boolean => {
    const errs: { name?: string; email?: string } = {};
    if (!buyerName.trim()) errs.name = "Required";
    if (!/^\S+@\S+\.\S+$/.test(buyerEmail.trim())) errs.email = "Enter a valid email";
    setBuyerErrors(errs);
    const buyerValid = Object.keys(errs).length === 0;
    const shippingValid = validateShippingForm();
    return buyerValid && shippingValid;
  };

  const handleApplyDiscount = async () => {
    if (!draftId || !discountCode.trim() || !clientSecret) return;

    setDiscountApplying(true);
    setDiscountError(null);

    const { data, error } = await callEdge("create-payment-intent", {
      product: selected,
      draft_id: draftId,
      discount_code: discountCode.trim(),
      ...(selected === "hardcover" ? {
        shipping: {
          name: shippingName || undefined,
          street1: shippingStreet1 || undefined,
          street2: shippingStreet2 || undefined,
          city: shippingCity || undefined,
          state_code: shippingState || undefined,
          postcode: shippingPostcode || undefined,
          country_code: "US",
          phone: shippingPhone || undefined,
        },
      } : {}),
    });

    setDiscountApplying(false);

    if (error || !data?.client_secret) {
      setDiscountError("Unable to apply code. Please try again.");
      return;
    }

    if (data.discount_invalid) {
      setDiscountError("Invalid or expired promo code.");
      return;
    }

    setClientSecret(data.client_secret);
    setPiOrderId(data.order_id);
    setAmountCents(data.amount_cents);
  };

  const handlePaySuccess = (orderId: string) => {
    setAnswer("buyer_name", buyerName.trim());
    setAnswer("buyer_email", buyerEmail.trim());
    setAnswer("selectedPlan", selected);
    setAnswer("orderId", orderId);
    navigate(pathForStep(12));
  };

  const checkoutFooter = bypassCheckout ? (
    <div
      className="sticky bottom-0 z-30 border-t border-black/10 bg-wizard-bg px-4 py-4"
      style={{ backgroundColor: "hsl(var(--wizard-bg))" }}
    >
      <Button
        type="button"
        variant="wizard"
        size="pill"
        className="w-full"
        onClick={() => navigate(pathForStep(12))}
      >
        Skip checkout (dev bypass)
      </Button>
    </div>
  ) : (
    <div
      className="sticky bottom-0 z-30 border-t border-black/10 bg-wizard-bg"
      style={{ backgroundColor: "hsl(var(--wizard-bg))" }}
    >
      <div className="px-4 pt-4 pb-6 flex flex-col gap-3" style={{ maxWidth: "700px", margin: "0 auto" }}>
        {/* Buyer details */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold uppercase tracking-widest text-wizard/70">
            Your name
          </Label>
          <Input
            type="text"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="e.g. Sarah Johnson"
            style={buyerErrors.name ? { borderColor: "hsl(var(--destructive))" } : undefined}
          />
          {buyerErrors.name && (
            <p className="text-xs text-destructive">{buyerErrors.name}</p>
          )}
          <Label className="text-xs font-semibold uppercase tracking-widest mt-2 text-wizard/70">
            Email
          </Label>
          <Input
            type="email"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            placeholder="you@example.com"
            style={buyerErrors.email ? { borderColor: "hsl(var(--destructive))" } : undefined}
          />
          {buyerErrors.email && (
            <p className="text-xs text-destructive">{buyerErrors.email}</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            We'll use your name on the book's dedication and email you when it's ready.
          </p>
        </div>

        {/* Hardcover shipping address block */}
        {selected === "hardcover" && (
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-semibold uppercase tracking-widest text-wizard/70">
              Shipping address
            </Label>
            <p className="text-[11px] text-muted-foreground -mt-1">Ships to US addresses only. 🇺🇸</p>

            <Input
              type="text"
              value={shippingName}
              onChange={(e) => setShippingName(e.target.value)}
              placeholder="Full name"
            />

            <Input
              type="text"
              value={shippingStreet1}
              onChange={(e) => setShippingStreet1(e.target.value)}
              placeholder="Street address"
              style={shippingErrors.street1 ? { borderColor: "hsl(var(--destructive))" } : undefined}
            />
            {shippingErrors.street1 && (
              <p className="text-xs text-destructive">{shippingErrors.street1}</p>
            )}

            <Input
              type="text"
              value={shippingStreet2}
              onChange={(e) => setShippingStreet2(e.target.value)}
              placeholder="Apt, suite, etc. (optional)"
            />

            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="text"
                  value={shippingCity}
                  onChange={(e) => setShippingCity(e.target.value)}
                  placeholder="City"
                  style={shippingErrors.city ? { borderColor: "hsl(var(--destructive))" } : undefined}
                />
                {shippingErrors.city && (
                  <p className="text-xs text-destructive mt-1">{shippingErrors.city}</p>
                )}
              </div>
              <div style={{ width: 110 }}>
                <select
                  value={shippingState}
                  onChange={(e) => setShippingState(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  style={shippingErrors.state_code ? { borderColor: "hsl(var(--destructive))" } : undefined}
                  aria-label="State"
                >
                  <option value="">State</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                  ))}
                </select>
                {shippingErrors.state_code && (
                  <p className="text-xs text-destructive mt-1">{shippingErrors.state_code}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="text"
                  value={shippingPostcode}
                  onChange={(e) => setShippingPostcode(e.target.value)}
                  placeholder="ZIP code"
                  style={shippingErrors.postcode ? { borderColor: "hsl(var(--destructive))" } : undefined}
                />
                {shippingErrors.postcode && (
                  <p className="text-xs text-destructive mt-1">{shippingErrors.postcode}</p>
                )}
              </div>
              <div className="flex-1">
                <Input
                  type="tel"
                  value={shippingPhone}
                  onChange={(e) => setShippingPhone(e.target.value)}
                  placeholder="Phone number"
                  style={shippingErrors.phone ? { borderColor: "hsl(var(--destructive))" } : undefined}
                />
                {shippingErrors.phone && (
                  <p className="text-xs text-destructive mt-1">{shippingErrors.phone}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Discount code field */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold uppercase tracking-widest text-wizard/70">
            Promo code
          </Label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder="Enter promo code"
              className="flex-1"
            />
            <Button
              type="button"
              variant="wizardOutline"
              size="pill"
              onClick={handleApplyDiscount}
              disabled={discountApplying || !discountCode.trim() || !draftId || !clientSecret}
              className="flex-none"
            >
              {discountApplying ? "Applying…" : "Apply"}
            </Button>
          </div>
          {discountError && (
            <p className="text-xs text-destructive">{discountError}</p>
          )}
        </div>

        {piError && <p className="text-xs text-destructive">{piError}</p>}

        {clientSecret ? (
          <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm
              amountLabel={amountLabel}
              orderId={piOrderId!}
              onValidate={validateBuyerForm}
              onSuccess={handlePaySuccess}
            />
          </Elements>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="wizardOutline"
              size="pill"
              onClick={() => navigate(pathForStep(9))}
              className="flex-none"
            >
              ← Back
            </Button>
            <Button
              variant="wizard"
              size="pill"
              disabled
              className="flex-1"
            >
              Pay {amountLabel} & start crafting
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <WizardShell footer={checkoutFooter}>

      <div className="w-full mx-auto" style={{ maxWidth: "700px" }}>

        {/* Heading */}
        <div className="space-y-2 mb-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-left text-wizard">
            {name}'s story is ready to print.
          </h1>
          <p className="text-muted-foreground text-lg text-left">
            Choose your format and place your order. Every page will be yours to review and edit after checkout.
          </p>
        </div>

        {/* Illustrations row (cover + other illustrations side by side) */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div className="flex flex-col items-start gap-2">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
              Cover
            </p>
            <div
              className="rounded-2xl overflow-hidden shadow-lg bg-white"
              style={{ aspectRatio: "1/1", width: 260 }}
            >
              {coverImage ? (
                <img
                  src={coverImage}
                  alt={`Cover of ${title}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-muted">
                  <span className="text-xs text-muted-foreground">Cover loading…</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stacked content */}
        <div className="flex flex-col">

          <div className="flex flex-col gap-4 mb-6">
            {/* Digital */}
            <button
              type="button"
              onClick={() => setSelected("digital")}
              className="relative text-left rounded-2xl border-2 p-5 transition-all"
              style={{
                borderColor: selected === "digital" ? "hsl(var(--wizard-primary))" : "hsl(var(--border))",
                boxShadow: selected === "digital" ? "0 0 0 2px hsl(var(--wizard-primary) / 0.25)" : "none",
                backgroundColor: "hsl(var(--card))",
              }}
            >
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <span className="font-semibold">Digital Book</span>
                  <span className="ml-2 text-xs text-muted-foreground">Instant delivery</span>
                </div>
                <span className="text-lg font-bold text-wizard">$9.99</span>
              </div>
              <ul className="space-y-1.5">
                {DIGITAL_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 shrink-0 text-wizard" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>

            {/* Hardcover */}
            <button
              type="button"
              onClick={() => setSelected("hardcover")}
              className="relative text-left rounded-2xl border-2 p-5 transition-all"
              style={{
                borderColor: selected === "hardcover" ? "hsl(var(--wizard-accent))" : "hsl(var(--wizard-accent) / 0.4)",
                boxShadow: selected === "hardcover" ? "0 0 0 2px hsl(var(--wizard-accent) / 0.3)" : "none",
                backgroundColor: "hsl(var(--card))",
              }}
            >
              <span className="absolute -top-3 right-4 text-xs font-semibold px-3 py-1 rounded-full bg-wizard-accent text-wizard-accent-foreground">
                ⭐ Most popular
              </span>

              <div className="flex items-baseline justify-between mb-3 mt-1">
                <div>
                  <span className="font-semibold">Printed Hardcover + Digital</span>
                </div>
                <span className="text-lg font-bold text-wizard">$54.99</span>
              </div>
              <ul className="space-y-1.5">
                {HARDCOVER_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 shrink-0 text-wizard" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground mb-6">
            <span>🔒 Secure checkout</span>
            <span>💳 All major cards accepted</span>
            <span>📦 Free shipping to the US</span>
          </div>

          {/* Testimonial */}
          <figure
            className="mt-2 mb-8 rounded-2xl p-5 border"
            style={{
              backgroundColor: "hsl(100 52% 20% / 0.08)",
              borderColor: "hsl(100 52% 20% / 0.2)",
            }}
          >
            <span
              className="block text-2xl leading-none mb-2 font-serif"
              style={{ color: "hsl(100 52% 20%)" }}
              aria-hidden="true"
            >
              "
            </span>
            <blockquote className="text-sm md:text-base font-serif italic leading-relaxed text-wizard/90">
              She opened the first page and whispered, "Grandma, it's me." I still can't stop thinking about that moment.
            </blockquote>
            <figcaption className="mt-3 text-xs font-medium text-wizard/65">
              — Carol, grandmother
            </figcaption>
          </figure>
        </div>
      </div>
    </WizardShell>
  );
}
