import { useState } from "react";
import { pathForStep } from "@/lib/wizardSteps";
import { useNavigate } from "react-router-dom";
import { useWizard } from "@/contexts/WizardContext";

import { Check } from "lucide-react";
import WizardShell from "@/components/WizardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Plan = "digital" | "hardcover";

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

export default function Step9Preview() {
  const { answers, setAnswer } = useWizard();
  const navigate = useNavigate();
  const name = answers.childName || "your little one";
  const concept = answers.selectedConcept || {};
  const title = concept.title || answers.bookTitle || `${name}'s Adventure`;
  const coverImage: string | undefined = concept.coverImage;

  const [selected, setSelected] = useState<Plan>("hardcover");

  // Buyer form state
  const [buyerName, setBuyerName] = useState<string>(answers.buyer_name || "");
  const [buyerEmail, setBuyerEmail] = useState<string>(answers.buyer_email || "");
  const [buyerErrors, setBuyerErrors] = useState<{ name?: string; email?: string }>({});

  const price = selected === "digital" ? "$9.99" : "$44.99";

  const handlePay = () => {
    const errs: { name?: string; email?: string } = {};
    if (!buyerName.trim()) errs.name = "Required";
    if (!/^\S+@\S+\.\S+$/.test(buyerEmail.trim())) errs.email = "Enter a valid email";
    setBuyerErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setAnswer("buyer_name", buyerName.trim());
    setAnswer("buyer_email", buyerEmail.trim());
    setAnswer("selectedPlan", selected);

    navigate(pathForStep(11));
  };

  // AIDEV-NOTE: This step uses WizardShell with a custom footer so the shell
  // provides the header (with Back button) while the sticky bar shows the
  // checkout form instead of the default Back/Continue buttons. The checkout
  // section is too complex to squeeze into continueLabel/onBeforeContinue.
  const checkoutFooter = (
    <div
      className="sticky bottom-0 z-30 border-t border-black/10 bg-wizard-bg"
      style={{ backgroundColor: "hsl(var(--wizard-bg))" }}
    >
      <div className="px-4 pt-4 pb-6 flex flex-col gap-3" style={{ maxWidth: "700px", margin: "0 auto" }}>
        {/* Buyer details + order */}
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
            onClick={handlePay}
            className="flex-1"
          >
            Pay {price} & start crafting
          </Button>
        </div>
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
                <span className="text-lg font-bold text-wizard">$44.99</span>
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
