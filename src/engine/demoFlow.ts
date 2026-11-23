import type { UpcomingScheduleSignal } from "@/engine/decisionEngine";
import type { Bookmark } from "@/types/database";

type DemoDataset = {
  bookmarks: Bookmark[];
  schedules: UpcomingScheduleSignal[];
};

type DemoSurfaceInput = {
  demoActive: boolean;
  demoStep: number;
  demoItem: Bookmark | null;
  demoDataset: DemoDataset;
  liveBookmarks: Bookmark[];
  liveUpcomingSchedules: UpcomingScheduleSignal[];
};

type DemoSurface = {
  bookmarks: Bookmark[];
  upcomingSchedules: UpcomingScheduleSignal[];
};

function mergeDemoBookmarks(demoDataset: DemoDataset, demoItem: Bookmark | null): Bookmark[] {
  if (!demoItem) return demoDataset.bookmarks;
  return [demoItem, ...demoDataset.bookmarks.filter((bookmark) => bookmark.id !== demoItem.id)];
}

export function resolveDashboardSurfaceForDemo(input: DemoSurfaceInput): DemoSurface {
  const {
    demoActive,
    demoStep,
    demoItem,
    demoDataset,
    liveBookmarks,
    liveUpcomingSchedules,
  } = input;

  if (!demoActive) {
    return {
      bookmarks: liveBookmarks,
      upcomingSchedules: liveUpcomingSchedules,
    };
  }

  if (demoStep >= 4) {
    return {
      bookmarks: mergeDemoBookmarks(demoDataset, demoItem),
      upcomingSchedules: demoDataset.schedules,
    };
  }

  if (demoStep === 3) {
    return {
      bookmarks: demoItem ? [demoItem] : [],
      upcomingSchedules: [],
    };
  }

  return {
    bookmarks: [],
    upcomingSchedules: [],
  };
}
