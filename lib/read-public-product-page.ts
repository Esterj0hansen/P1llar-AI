import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 900_000;
const TIMEOUT_MS = 6500;
const MAX_REDIRECTS = 4;

function isPrivateIPv4(ip: string) {
  const p = ip.split(".").map(Number);
  return p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255) ||
    p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
    (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}
function isPrivateIPv6(ip: string) {
  const s = ip.toLowerCase();
  return s === "::" || s === "::1" || s.startsWith("fc") || s.startsWith("fd") ||
    /^fe[89ab]/.test(s) || s.startsWith("::ffff:") || s.startsWith("2001:db8:");
}
async function validatePublicUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Only public HTTP/HTTPS product links can be checked.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal"))
    throw new Error("Private or local addresses cannot be fetched.");
  const literalType = isIP(host);
  if (literalType === 4 && isPrivateIPv4(host)) throw new Error("Private addresses cannot be fetched.");
  if (literalType === 6 && isPrivateIPv6(host)) throw new Error("Private addresses cannot be fetched.");
  if (!literalType) {
    const records = await lookup(host, { all: true, verbatim: true });
    if (!records.length || records.some(r => r.family === 4 ? isPrivateIPv4(r.address) : isPrivateIPv6(r.address)))
      throw new Error("The link does not resolve to a public address.");
  }
  url.hash = "";
  return url;
}
function decode(s: string) {
  return s.replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
function stripHtml(s: string) {
  return decode(s.replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n")).trim();
}
function meta(html: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp('<meta\\b(?=[^>]*(?:name|property)=[\\"\\']' + escaped + '[\\"\\'])[^>]*content=[\\"\\']([^\\"\\']*)[\\"\\'][^>]*>', "i");
    const match = html.match(re);
    if (match?.[1]) return decode(match[1]).trim();
    const reverse = new RegExp('<meta\\b(?=[^>]*content=[\\"\\']([^\\"\\']*)[\\"\\'])[^>]*(?:name|property)=[\\"\\']' + escaped + '[\\"\\'][^>]*>', "i");
    const m2 = html.match(reverse);
    if (m2?.[1]) return decode(m2[1]).trim();
  }
  return "";
}
function productJsonLd(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const root = JSON.parse(m[1]);
      const visit = (v: any) => {
        if (!v || typeof v !== "object") return;
        if (Array.isArray(v)) { v.forEach(visit); return; }
        const types = Array.isArray(v["@type"]) ? v["@type"].join(" ") : String(v["@type"] || "");
        if (/Product|Offer/i.test(types)) {
          const offers = Array.isArray(v.offers) ? v.offers : v.offers ? [v.offers] : [];
          const fields = [
            v.name && "Name: " + v.name,
            v.description && "Description: " + v.description,
            v.sku && "SKU: " + v.sku,
            v.brand && "Brand: " + (typeof v.brand === "object" ? v.brand.name || JSON.stringify(v.brand) : v.brand),
            ...offers.map((o: any) => [
              o.price != null && "Price: " + o.price,
              o.priceCurrency && "Currency: " + o.priceCurrency,
              o.availability && "Availability: " + String(o.availability).split("/").pop(),
              o.url && "Offer URL: " + o.url,
            ].filter(Boolean).join(" | ")),
          ].filter(Boolean);
          if (fields.length) out.push(fields.join("\n"));
        }
        Object.values(v).forEach(visit);
      };
      visit(root);
    } catch { /* Ignore invalid JSON-LD. */ }
  }
  return [...new Set(out)].slice(0, 8);
}
function extractPrices(text: string) {
  const patterns = [
    /(?:price|sale price|our price|now)\s*[:\-]?\s*((?:US\$|CA\$|AU\$|£|€|\$|₦|₹|₱|RM\s*)\s?[\d,.]+(?:\s?(?:USD|EUR|GBP|NGN|CAD|AUD))?)/ig,
    /((?:US\$|CA\$|AU\$|£|€|\$|₦|₹|₱)\s?[\d,.]+(?:\s?(?:USD|EUR|GBP|NGN|CAD|AUD))?)/g,
    /\b(USD|EUR|GBP|NGN|CAD|AUD)\s?[\d,.]+/ig,
  ];
  const found: string[] = [];
  for (const p of patterns) for (const m of text.matchAll(p)) {
    const value = m[1] || m[0];
    if (!found.includes(value.trim())) found.push(value.trim());
    if (found.length >= 12) return found;
  }
  return found;
}

export async function readPublicProductPage(rawUrl: string) {
  let url = await validatePublicUrl(rawUrl);
  let response: Response | null = null;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; P1llarAI/1.0; +https://p1llar-ai.vercel.app)",
        Accept: "text/html,application/xhtml+xml,application/ld+json;q=0.9,*/*;q=0.5",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) return { ok: false as const, url: url.toString(), reason: "The product page redirected too many times." };
      url = await validatePublicUrl(new URL(location, url).toString());
      continue;
    }
    break;
  }
  if (!response || !response.ok) return { ok: false as const, url: url.toString(), reason: "The website blocked the request or returned an error." };
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("text/html") && !type.includes("application/xhtml+xml") && !type.includes("application/ld+json"))
    return { ok: false as const, url: url.toString(), reason: "The link did not return a readable product page." };
  const reader = response.body?.getReader();
  if (!reader) return { ok: false as const, url: url.toString(), reason: "The website returned no readable page content." };
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) { await reader.cancel(); break; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const html = new TextDecoder().decode(Buffer.concat(chunks.map(c => Buffer.from(c))));
  const title = stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") ||
    meta(html, ["og:title", "twitter:title"]) || url.hostname;
  const description = meta(html, ["description", "og:description", "twitter:description"]);
  const metaPrice = meta(html, ["product:price:amount", "og:price:amount", "twitter:data1"]);
  const currency = meta(html, ["product:price:currency", "og:price:currency"]);
  const structured = productJsonLd(html);
  const pageText = stripHtml(html).slice(0, 9000);
  const prices = extractPrices([metaPrice && ("Price: " + metaPrice), currency && ("Currency: " + currency), ...structured, pageText].filter(Boolean).join("\n"));
  const content = [
    "LIVE EXTERNAL PRODUCT PAGE (not verified as part of the business catalogue)",
    "URL: " + url.toString(),
    "Page title: " + title.slice(0, 300),
    description && "Description: " + description.slice(0, 1200),
    metaPrice && "Metadata price: " + metaPrice + (currency ? " " + currency : ""),
    structured.length ? "Structured product data:\n" + structured.join("\n---\n") : "",
    prices.length ? "Price-like text found (verify exact product/variant): " + prices.join("; ") : "",
    "Readable page text:\n" + pageText,
  ].filter(Boolean).join("\n\n").slice(0, 14000);
  return { ok: true as const, url: url.toString(), title, content, hasPriceEvidence: !!(metaPrice || structured.some(x => /Price:/.test(x)) || prices.length) };
}
