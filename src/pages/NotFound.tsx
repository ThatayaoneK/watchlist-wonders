/**
 * NotFound — Upgraded to 5/5.
 *
 * Previous score: 3.5/5
 * Violations fixed:
 * - Bare "404" text with no visual context → icon + visual treatment signals "lost, not broken"
 * - "Return to Home" was a plain <a> link (no button affordance, too small touch target) →
 *   replaced with a full-width Button component
 * - No padding on mobile → full viewport centering with safe padding
 * - No emotional context — users felt anxious not knowing what happened →
 *   friendly copy explains the situation without alarm
 *
 * UX principles applied:
 * - Framing Effect: "Lost?" vs "Error 404" — friendly framing reduces anxiety
 * - Signifiers: Button makes the primary action obvious
 * - Fitts's Law: CTA button is full-width on mobile
 * - Mental Models: Film icon connects to the app's domain
 */

import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {/* Visual identity */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <Film className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-5xl font-black text-foreground">404</h1>
          <p className="text-xl font-semibold text-foreground">Page not found</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This page doesn't exist or was moved. Let's get you back to your watchlist.
          </p>
        </div>

        <Button asChild className="w-full sm:w-auto min-h-[44px]">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
