// Lightweight Open Graph scraper — fallback/supplement for title,
// description, and thumbnail when Raindrop didn't provide them.

export interface OgData {
  title?: string;
  description?: string;
  image?: string;
}

function pick(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function metaPatterns(prop: string): RegExp[] {
  // Handles property=... content=... in either order, single or double quotes.
  return [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
      "i"
    ),
  ];
}

export async function fetchOg(url: string): Promise<OgData> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // A browser-ish UA gets OG tags from most sites, including some that
        // block generic bots.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return {};
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return {};
    const html = (await res.text()).slice(0, 500_000);
    const title =
      pick(html, metaPatterns("og:title")) ??
      pick(html, [/<title[^>]*>([^<]+)<\/title>/i]);
    return {
      title,
      description:
        pick(html, metaPatterns("og:description")) ??
        pick(html, metaPatterns("description")),
      image:
        pick(html, metaPatterns("og:image")) ??
        pick(html, metaPatterns("twitter:image")),
    };
  } catch {
    return {}; // OG is best-effort; never fail enrichment over it
  } finally {
    clearTimeout(timer);
  }
}
