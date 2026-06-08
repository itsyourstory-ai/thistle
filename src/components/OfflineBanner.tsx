import { useEffect, useState } from "react";

/**
 * Global connection-lost banner. Mounted once at the app root; shows a fixed
 * bar at the top of the viewport whenever the browser goes offline, since the
 * whole app depends on Supabase edge-function calls.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && navigator.onLine === false,
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-[100] px-4 py-2 text-center text-sm font-medium text-white"
      style={{ backgroundColor: "hsl(var(--wizard-primary))" }}
    >
      You're offline — we'll keep your progress, but some things won't work until you reconnect.
    </div>
  );
}
