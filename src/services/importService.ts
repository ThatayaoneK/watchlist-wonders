/**
 * importService — parses IMDb CSV exports and bulk-creates bookmarks.
 *
 * IMDb watchlist CSV header:
 *   Const,Your Rating,Date Rated,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors
 */
import { bookmarkService } from "@/services/bookmarks";
import type { Bookmark } from "@/types/database";

export interface ImportRow {
  imdbId: string;
  title: string;
  titleType: string;
  year: number | null;
  runtimeMinutes: number | null;
  genres: string[];
  imdbRating: number | null;
  imdbUrl: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/** Parse an IMDb CSV export string into rows. */
export function parseImdbCsv(csv: string): ImportRow[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Normalize header — handle BOM and casing
  const rawHeader = lines[0].replace(/^\uFEFF/, "");
  const headers = splitCsvLine(rawHeader).map((h) => h.toLowerCase().trim().replace(/['"]/g, ""));

  const colIndex = (name: string): number => {
    const idx = headers.indexOf(name);
    return idx;
  };

  const constIdx     = colIndex("const");
  const titleIdx     = colIndex("title");
  const typeIdx      = colIndex("title type");
  const yearIdx      = colIndex("year");
  const runtimeIdx   = colIndex("runtime (mins)");
  const genreIdx     = colIndex("genres");
  const ratingIdx    = colIndex("imdb rating");
  const urlIdx       = colIndex("url");

  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitCsvLine(line);
    const get = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx].replace(/^"|"$/g, "").trim() : "");

    const title = get(titleIdx);
    if (!title) continue;

    const imdbId = get(constIdx);
    const rawType = get(typeIdx).toLowerCase();
    const year = parseInt(get(yearIdx), 10) || null;
    const runtime = parseInt(get(runtimeIdx), 10) || null;
    const genresRaw = get(genreIdx);
    const genres = genresRaw
      ? genresRaw.split(",").map((g) => g.trim()).filter(Boolean)
      : [];
    const imdbRating = parseFloat(get(ratingIdx)) || null;
    const urlRaw = get(urlIdx);
    const imdbUrl = urlRaw || (imdbId ? `https://www.imdb.com/title/${imdbId}/` : "");

    rows.push({ imdbId, title, titleType: rawType, year, runtimeMinutes: runtime, genres, imdbRating, imdbUrl });
  }

  return rows;
}

/** Map IMDb titleType to WatchMarks bookmark type */
function mapTitleType(titleType: string): Bookmark["type"] {
  if (titleType.includes("tvseries") || titleType.includes("tvminiseries") || titleType === "tvshort") return "series";
  if (titleType.includes("tvepisode")) return "episode";
  if (titleType.includes("short") || titleType === "video") return "video";
  if (titleType.includes("documentary")) return "doc";
  return "movie";
}

/** Map IMDb genres to WatchMarks mood tags (best-effort) */
function genresToMoodTags(genres: string[]): string[] {
  const mapping: Record<string, string> = {
    "action": "action",
    "comedy": "comedy",
    "drama": "drama",
    "horror": "horror",
    "romance": "romance",
    "thriller": "thriller",
    "documentary": "documentary",
    "sci-fi": "scifi",
    "science fiction": "scifi",
    "fantasy": "fantasy",
    "animation": "animation",
    "family": "family",
  };
  return genres
    .map((g) => mapping[g.toLowerCase()])
    .filter(Boolean) as string[];
}

/**
 * Bulk-import IMDb rows as bookmarks, chunked to 20 per batch.
 * Calls onProgress(imported, total) after each chunk.
 */
export async function importRows(
  rows: ImportRow[],
  existingTitles: Set<string>,
  onProgress: (done: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, failed: 0, errors: [] };
  const CHUNK_SIZE = 20;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    await Promise.all(
      chunk.map(async (row) => {
        const normalizedTitle = row.title.trim().toLowerCase();

        // Skip if a bookmark with the same title (case-insensitive) already exists
        if (existingTitles.has(normalizedTitle)) {
          result.skipped++;
          return;
        }

        try {
          await bookmarkService.createBookmark({
            title: row.title,
            type: mapTitleType(row.titleType),
            provider: "imdb",
            source_url: row.imdbUrl || null,
            canonical_url: row.imdbUrl || null,
            status: "backlog",
            runtime_minutes: row.runtimeMinutes,
            release_year: row.year,
            tags: ["imported", "imdb"],
            mood_tags: genresToMoodTags(row.genres),
            metadata: {
              imdb_id: row.imdbId,
              imdb_rating: row.imdbRating,
              genres: row.genres,
              import_source: "imdb_csv",
            },
          });
          existingTitles.add(normalizedTitle);
          result.imported++;
        } catch (err) {
          result.failed++;
          result.errors.push(`"${row.title}": ${err instanceof Error ? err.message : "unknown error"}`);
        }
      }),
    );

    onProgress(Math.min(i + CHUNK_SIZE, rows.length), rows.length);

    // Small pause between chunks to avoid Firestore write bursts
    if (i + CHUNK_SIZE < rows.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return result;
}

/** Split a single CSV line respecting double-quoted fields (including commas inside quotes) */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
