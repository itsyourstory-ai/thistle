import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Landing() {
  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ backgroundColor: "hsl(var(--wizard-bg))" }}
    >
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <span className="font-heading text-xl font-semibold text-wizard">
          📖 Thistle Books
        </span>
        <Button asChild variant="wizardOutline" size="sm">
          <Link to="/login">Log in</Link>
        </Button>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-2xl mx-auto w-full">
        <span
          className="inline-block text-xs font-semibold px-4 py-1.5 rounded-full mb-6"
          style={{
            backgroundColor: "hsl(var(--wizard-accent) / 0.25)",
            color: "hsl(var(--wizard-accent-foreground))",
          }}
        >
          Personalized for your child
        </span>

        <h1 className="font-heading text-4xl sm:text-5xl font-semibold text-wizard leading-tight mb-4">
          Where your child is<br />the hero of the story
        </h1>

        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          Answer a few questions and we'll craft a beautifully illustrated book starring your little one.
        </p>

        <Button asChild variant="wizard" size="pill">
          <Link to="/login">Log in to start</Link>
        </Button>
      </main>

      {/* Feature row */}
      <section className="px-6 pb-16 max-w-5xl mx-auto w-full">
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="rounded-3xl p-6 text-center space-y-2">
            <div className="text-3xl">🧒</div>
            <p className="font-semibold text-wizard">Tell us about them</p>
            <p className="text-sm text-muted-foreground">Name, age, interests</p>
          </Card>
          <Card className="rounded-3xl p-6 text-center space-y-2">
            <div className="text-3xl">🎨</div>
            <p className="font-semibold text-wizard">Pick the art style</p>
            <p className="text-sm text-muted-foreground">Watercolor, cartoon & more</p>
          </Card>
          <Card className="rounded-3xl p-6 text-center space-y-2">
            <div className="text-3xl">📦</div>
            <p className="font-semibold text-wizard">Get their book</p>
            <p className="text-sm text-muted-foreground">Printed & delivered</p>
          </Card>
        </div>
      </section>
    </div>
  );
}
