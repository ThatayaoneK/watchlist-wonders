export function normalizeMediaTitle(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(official|trailer|teaser|clip|video)\b/gi, " ")
    .replace(/\(?\b(19|20)\d{2}\b\)?/g, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}
