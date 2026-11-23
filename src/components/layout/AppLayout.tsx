import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { HowItWorksButton } from "@/components/HowItWorksButton";
import { TopNav } from "./TopNav";

export function AppLayout() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const openSearch = () => navigate("/search");
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("wm:open-search", openSearch);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("wm:open-search", openSearch);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background" id="main-scroll-container">
      <TopNav onSearchClick={() => navigate("/search")} />
      {!isOnline && (
        <div
          className="fixed inset-x-0 top-[68px] z-40 border-b border-amber-400/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-amber-200"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          Offline - viewing cached data
        </div>
      )}
      <Outlet />
      <HowItWorksButton />
    </div>
  );
}
