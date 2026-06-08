import { Component, type ErrorInfo, type ReactNode } from "react";
import FullScreenMessage from "@/components/FullScreenMessage";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Top-level error boundary. Catches render-time crashes anywhere in the tree
 * and shows a branded 500-style fallback instead of a blank white screen.
 * Wrapped around the router in App.tsx.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // AIDEV-NOTE: surfaced to the console for now; wire to a real error
    // reporter (Sentry, etc.) here if/when one is added.
    console.error("Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <FullScreenMessage
        emoji="🌧️"
        title="Something went wrong"
        description="An unexpected error stopped this page from loading. Reloading usually fixes it."
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-semibold text-white transition-all"
            style={{ backgroundColor: "hsl(var(--wizard-primary))" }}
          >
            Reload page
          </button>
        }
      />
    );
  }
}
