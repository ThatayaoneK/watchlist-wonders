export interface UrlExtractor {
  provider: string;
  matches(url: URL): boolean;
}

export function hostMatches(url: URL, hosts: readonly string[]): boolean {
  const hostname = url.hostname.toLowerCase();
  return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}
