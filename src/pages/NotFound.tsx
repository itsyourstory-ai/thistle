import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import FullScreenMessage from "@/components/FullScreenMessage";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <FullScreenMessage
      emoji="🧭"
      title="Page not found"
      description="We couldn't find the page you were looking for."
      action={
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-semibold text-white transition-all"
          style={{ backgroundColor: "hsl(var(--wizard-primary))" }}
        >
          Back to start
        </a>
      }
    />
  );
};

export default NotFound;
