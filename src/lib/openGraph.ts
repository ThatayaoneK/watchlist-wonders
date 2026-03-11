export type OpenGraphMetadata = {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  type?: string;
  canonicalUrl?: string;
  url?: string;
  favicon?: string;
};

const getMetaContent = (doc: Document, selector: string) =>
  doc.querySelector<HTMLMetaElement>(selector)?.content?.trim();

const resolveUrl = (value: string | undefined, baseUrl: string) => {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
};

export const fetchOpenGraphMetadata = async (url: string): Promise<OpenGraphMetadata> => {
  const proxyUrl = `https://r.jina.ai/${url}`;
  const response = await fetch(proxyUrl);

  if (!response.ok) {
    throw new Error("Unable to fetch URL metadata.");
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  const ogTitle = getMetaContent(doc, 'meta[property="og:title"]');
  const ogDescription = getMetaContent(doc, 'meta[property="og:description"]');
  const ogImage = getMetaContent(doc, 'meta[property="og:image"]');
  const ogType = getMetaContent(doc, 'meta[property="og:type"]');
  const ogSiteName = getMetaContent(doc, 'meta[property="og:site_name"]');
  const ogUrl = getMetaContent(doc, 'meta[property="og:url"]');
  const twitterTitle = getMetaContent(doc, 'meta[name="twitter:title"]');
  const twitterDescription = getMetaContent(doc, 'meta[name="twitter:description"]');
  const twitterImage = getMetaContent(doc, 'meta[name="twitter:image"]');
  const description = getMetaContent(doc, 'meta[name="description"]');
  const canonical = doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  const favicon = doc.querySelector<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')?.href;

  const resolvedCanonical = resolveUrl(ogUrl || canonical, url);
  const resolvedImage = resolveUrl(ogImage || twitterImage, url);
  const resolvedFavicon = resolveUrl(favicon, url);

  return {
    title: ogTitle || twitterTitle || doc.title || undefined,
    description: ogDescription || twitterDescription || description || undefined,
    image: resolvedImage,
    siteName: ogSiteName || new URL(url).hostname.replace("www.", ""),
    type: ogType || undefined,
    canonicalUrl: resolvedCanonical,
    url: resolvedCanonical || url,
    favicon: resolvedFavicon,
  };
};
