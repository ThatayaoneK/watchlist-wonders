import type { Bookmark, Schedule } from '@/types/database';

function escapeRfc5545(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function getCalendarOrigin(baseUrl?: string): string {
  const rawOrigin =
    baseUrl ??
    import.meta.env.VITE_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const origin = typeof rawOrigin === "string" ? rawOrigin.trim() : "";
  return origin ? origin.replace(/\/+$/, "") : "";
}

export function createICS(bookmark: Bookmark, schedule: Schedule, baseUrl?: string): string {
  const start = new Date(schedule.scheduled_for);
  const end = new Date(start.getTime() + (bookmark.runtime_minutes ?? 90) * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const origin = getCalendarOrigin(baseUrl);
  const deepLink = origin ? `${origin}/b/${bookmark.id}` : `/b/${bookmark.id}`;
  const safeTitle = (bookmark.title || "Untitled").trim() || "Untitled";

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Watchlist Wonders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:watchlist-${schedule.id}@watchlist-wonders`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Watch: ${escapeRfc5545(safeTitle)}`,
    `DESCRIPTION:${escapeRfc5545(deepLink)}`,
    `URL:${deepLink}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadICS(bookmark: Bookmark, schedule: Schedule): void {
  const blob = new Blob([createICS(bookmark, schedule)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `watch-${bookmark.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
