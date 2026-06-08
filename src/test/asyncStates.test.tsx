import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import LoadingScreen from "@/components/LoadingScreen";
import AsyncError from "@/components/AsyncError";
import OfflineBanner from "@/components/OfflineBanner";

describe("LoadingScreen", () => {
  it("renders a status region with a message", () => {
    render(<LoadingScreen messages={["Loading the thing…"]} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading the thing…");
  });
});

describe("AsyncError", () => {
  it("renders the message and a retry button that fires onRetry", () => {
    const onRetry = vi.fn();
    render(<AsyncError message="Network exploded" onRetry={onRetry} />);
    expect(screen.getByText("Network exploded")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("omits the retry button when no onRetry is given", () => {
    render(<AsyncError message="Just info" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("OfflineBanner", () => {
  const setOnline = (value: boolean) => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value });
  };

  afterEach(() => {
    setOnline(true);
  });

  it("renders nothing while online", () => {
    setOnline(true);
    const { container } = render(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an alert after an offline event and hides it on reconnect", () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
