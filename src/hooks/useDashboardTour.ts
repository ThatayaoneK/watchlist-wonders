import { useState, useEffect } from "react";

const TOUR_KEY = "ww_tour_v1";

export function useDashboardTour() {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      setShowTour(true);
    }
  }, []);

  const dismissTour = () => {
    localStorage.setItem(TOUR_KEY, "done");
    setShowTour(false);
  };

  const resetTour = () => {
    localStorage.removeItem(TOUR_KEY);
    setShowTour(true);
  };

  return { showTour, dismissTour, resetTour };
}
