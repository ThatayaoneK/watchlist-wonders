const STRIP_PATTERNS: RegExp[] = [
  /\s*[|–—-]\s*(netflix|hulu|disney\+?|hbo\s*max|max|prime\s*video|amazon\s*prime|apple\s*tv\+?|paramount\+?|peacock|crunchyroll|shudder|mubi|showtime|starz|youtube|vimeo|tiktok|instagram|twitter|x\.com|facebook|imdb|rotten\s*tomatoes|letterboxd|themoviedb|tmdb|fandango|vudu|google\s*play|rakuten)/gi,
  /^(watch|stream|now\s*streaming|streaming\s*now)\s+/gi,
  /\s+on\s+(netflix|hulu|disney\+?|hbo|max|prime|amazon|apple|peacock|paramount)\s*$/gi,
  /\s*[|–—-]\s*season\s+\d+(\s+episode\s+\d+)?/gi,
  /\s*[|–—-]\s*s\d{1,2}e\d{1,3}/gi,
  /\s*[|–—-]\s*episode\s+\d+/gi,
  /\s*[([](hd|4k|uhd|full\s*hd|trailer|official|clip|scene)[)\]]/gi,
  /\s*[|–—]\s*$/g,
  /^\s*[|–—]\s*/g,
];

export interface NormalizedTitle {
  cleanTitle: string;
  isLikelyMedia: boolean;
}

export function normalizeTitle(rawTitle: string | undefined): NormalizedTitle {
  if (!rawTitle?.trim()) {
    return { cleanTitle: "", isLikelyMedia: false };
  }

  let clean = rawTitle.trim();
  for (const pattern of STRIP_PATTERNS) {
    clean = clean.replace(pattern, "").trim();
  }
  clean = clean.replace(/\s{2,}/g, " ").trim();

  const wordCount = clean ? clean.split(/\s+/).length : 0;
  const isLikelyMedia =
    wordCount > 0 &&
    wordCount <= 10 &&
    clean.length >= 2 &&
    !/\b(how|why|what|best|top\s*\d+)\b/i.test(clean) &&
    !/[?!]{2,}/.test(clean);

  return { cleanTitle: clean, isLikelyMedia };
}

export function titleSimilarity(left: string, right: string): number {
  const a = normalizeForComparison(left);
  const b = normalizeForComparison(right);

  if (a === b) return 1;
  if (!a || !b) return 0;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshtein(a, b);
  return 1 - distance / maxLen;
}

function normalizeForComparison(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => {
      if (i === 0) return j;
      if (j === 0) return i;
      return 0;
    }),
  );

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] =
        a[i - 1] === b[j - 1]
          ? matrix[i - 1][j - 1]
          : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
    }
  }

  return matrix[a.length][b.length];
}
