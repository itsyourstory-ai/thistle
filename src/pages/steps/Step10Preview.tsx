import { useState } from "react";
import { pathForStep } from "@/lib/wizardSteps";
import { useNavigate } from "react-router-dom";
import { useWizard } from "@/contexts/WizardContext";

import { Check } from "lucide-react";
import WizardHeader from "@/components/WizardHeader";
import { Input } from "@/components/ui/input";

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

    navigate(pathForStep(10));
  };

  return (
    <div
      className="flex flex-col min-h-[100dvh]"
      style={{ backgroundColor: "hsl(var(--wizard-bg))" }}
    >
      <WizardHeader currentStep={9} />

      <main className="flex-1 flex justify-center px-4 pt-12 pb-20">
        <div className="w-full mx-auto" style={{ maxWidth: "700px" }}>

          {/* Heading */}
          <div className="space-y-2 mb-8">
            <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-left text-[hsl(var(--wizard-primary))]">
              {name}'s book is ready.
            </h1>
            <p className="text-muted-foreground text-lg text-left">
              Preview the book and choose how you'd like it delivered.
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
                  <span className="text-lg font-bold" style={{ color: "hsl(var(--wizard-primary))" }}>$9.99</span>
                </div>
                <ul className="space-y-1.5">
                  {DIGITAL_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--wizard-primary))" }} />
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
                  borderColor: selected === "hardcover" ? "hsl(45 93% 58%)" : "hsl(45 93% 58% / 0.4)",
                  boxShadow: selected === "hardcover" ? "0 0 0 2px hsl(45 93% 58% / 0.3)" : "none",
                  backgroundColor: "hsl(var(--card))",
                }}
              >
                <span
                  className="absolute -top-3 right-4 text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ backgroundColor: "hsl(45 93% 58%)", color: "hsl(45 93% 20%)" }}
                >
                  ⭐ Most popular
                </span>

                <div className="flex items-baseline justify-between mb-3 mt-1">
                  <div>
                    <span className="font-semibold">Printed Hardcover + Digital</span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: "hsl(var(--wizard-primary))" }}>$44.99</span>
                </div>
                <ul className="space-y-1.5">
                  {HARDCOVER_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--wizard-primary))" }} />
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

            {/* Buyer details + order */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-widest"
                       style={{ color: "hsl(var(--wizard-primary) / 0.7)" }}>
                  Your name
                </label>
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
                <label className="text-xs font-semibold uppercase tracking-widest mt-2"
                       style={{ color: "hsl(var(--wizard-primary) / 0.7)" }}>
                  Email
                </label>
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

              <button
                onClick={handlePay}
                className="w-full h-12 rounded-full text-base font-semibold transition-opacity mt-2"
                style={{ backgroundColor: "#2B4E18", color: "#fff" }}
              >
                Pay {price} & start crafting
              </button>
              <div
                className="mt-2 rounded-2xl p-4 border flex gap-3 items-start"
                style={{
                  backgroundColor: "#2B4E18" + "14",
                  borderColor: "#2B4E18" + "33",
                }}
              >
                <span className="text-xl leading-none">✏️</span>
                <p className="text-sm leading-relaxed" style={{ color: "#2B4E18" }}>
                  <span className="font-semibold">You'll get to review your book before it's actually sent to you.</span> After checkout, preview every page and request edits or revisions before it's finalized.
                </p>
              </div>
            </div>

            {/* Testimonial */}
            <figure
              className="mt-8 rounded-2xl p-5 border"
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
                “
              </span>
              <blockquote
                className="text-sm md:text-base font-serif italic leading-relaxed"
                style={{ color: "hsl(var(--wizard-primary) / 0.9)" }}
              >
                She opened the first page and whispered, "Grandma, it's me." I still can't stop thinking about that moment.
              </blockquote>
              <figcaption
                className="mt-3 text-xs font-medium"
                style={{ color: "hsl(var(--wizard-primary) / 0.65)" }}
              >
                — Carol, grandmother
              </figcaption>
            </figure>
          </div>
        </div>
      </main>
    </div>
  );

}
