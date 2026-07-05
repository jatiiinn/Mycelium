// Metadata scraper — fills in title, description, and thumbnail.
// Strategy:
//   1. x.com / twitter.com: use Twitter's public oEmbed (the site itself
//      serves an empty JS shell to scrapers, but oEmbed returns the tweet
//      text + author with no auth).
//   2. Everything else: fetch with a browser UA; if no useful meta came
//      back (common on JS-heavy sites like Pinterest), retry once with a
//      crawler UA, which most sites serve server-rendered OG tags to.
// Always best-effort: never throws, never fails enrichment.

export interface OgData {
  title?: string;
  description?: string;
  image?: string;
}

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

// Parse every <meta> tag into a { key -> content } map, attribute-order
// agnostic (property/name/itemprop can come before or after content).
function metaMap(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const key =
      tag.match(/(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1];
    const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
    if (key && content && !map.has(key.toLowerCase())) {
      map.set(key.toLowerCase(), decodeEntities(content.trim()));
    }
  }
  return map;
}

function firstOf(meta: Map<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = meta.get(k);
    if (v) return v;
  }
  return undefined;
}

function extract(html: string, baseUrl: string): OgData {
  const meta = metaMap(html);
  const title =
    firstOf(meta, ["og:title", "twitter:title"]) ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  const description = firstOf(meta, [
    "og:description",
    "twitter:description",
    "description",
  ]);
  let image = firstOf(meta, [
    "og:image:secure_url",
    "og:image",
    "og:image:url",
    "twitter:image",
    "twitter:image:src",
    "image",
  ]);
  if (!image) {
    // Legacy <link rel="image_src" href="...">
    image = html.match(
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i
    )?.[1];
  }
  if (image) {
    try {
      image = new URL(image, baseUrl).toString(); // resolve relative URLs
    } catch {
      image = undefined;
    }
  }
  return {
    title: title ? decodeEntities(title) : undefined,
    description,
    image,
  };
}

async function fetchHtml(url: string, ua: string): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    const html = (await res.text()).slice(0, 800_000);
    return { html, finalUrl: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Tweet text via the public oEmbed endpoint (no auth required).
async function fetchTweet(url: string): Promise<OgData> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(
      `https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(url)}`,
      { signal: controller.signal, headers: { Accept: "application/json" } }
    );
    if (!res.ok) return {};
    const json = (await res.json()) as { html?: string; author_name?: string };
    const text = json.html
      ? decodeEntities(json.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      : "";
    if (!text && !json.author_name) return {};
    return {
      title: json.author_name ? `${json.author_name} on X` : undefined,
      description: text || undefined,
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOg(url: string): Promise<OgData> {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "x.com" || host === "twitter.com" || host.endsWith(".x.com")) {
      return await fetchTweet(url);
    }
  } catch {
    /* fall through to generic scraping */
  }

  const first = await fetchHtml(url, BROWSER_UA);
  let data = first ? extract(first.html, first.finalUrl) : {};

  // JS-shell sites (Pinterest, some Instagram pages) often serve real OG
  // tags only to crawler user agents — retry once if we got nothing useful.
  if (!data.image && !data.title) {
    const second = await fetchHtml(url, CRAWLER_UA);
    if (second) {
      const retry = extract(second.html, second.finalUrl);
      data = {
        title: data.title ?? retry.title,
        description: data.description ?? retry.description,
        image: data.image ?? retry.image,
      };
    }
  }
  return data;
}
