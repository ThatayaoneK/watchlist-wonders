import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";

const TOUR_KEY = "ww_tour_v1";

export function useDashboardTour() {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (!storage.get(TOUR_KEY, { fallback: false })) {
      setShowTour(true);
    }
  }, []);

  const dismissTour = () => {
    storage.set(TOUR_KEY, true);
    setShowTour(false);
  };

  const resetTour = () => {
    storage.remove(TOUR_KEY);
    setShowTour(true);
  };

  return { showTour, dismissTour, resetTour };
}
