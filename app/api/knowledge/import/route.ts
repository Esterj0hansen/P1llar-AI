import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 5;
const MAX_QUEUE = 5000;
const MAX_STATE = 10000;
const SKIP_FILE = /\.(pdf|jpg|jpeg|png|gif|webp|zip|mp4|mp3|css|js|ico|woff2?)(\?|$)/i;

function cleanHtml(html: string) {
  return html.replace(/<(script|style|noscript|svg|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n").trim();
}
function publicUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Enter a valid public website URL.");
  const host = url.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(host) || host.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) throw new Error("Enter a public website domain.");
  url.hash = ""; return url;
}
function normalize(raw: string, origin: string) {
  try { const u = publicUrl(raw); if (u.origin !== origin || SKIP_FILE.test(u.pathname)) return null; u.hash = ""; if (u.pathname !== "/") u.pathname = u.pathname.replace(/\/+$/, ""); return u.toString(); } catch { return null; }
}
function scriptUrlsFrom(html: string, current: string, origin: string) {
  const found = new Set<string>();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) { try { const u = new URL(m[1], current); if (u.origin === origin && /\.js(?:[?#]|$)/i.test(u.href)) found.add(u.toString()); } catch {} if (found.size >= 20) break; }
  return [...found];
}
async function fetchCatalogueScripts(html: string, current: string, origin: string) {
  const blocks: string[] = [];
  for (const src of scriptUrlsFrom(html, current, origin)) {
    try { const r = await fetch(src, { signal: AbortSignal.timeout(5000), redirect: 'follow' }); if (!r.ok || new URL(r.url).origin !== origin) continue; const js = (await r.text()).slice(0, 2000000);
      const m = /(?:const|let|var)\s+(products|catalogue|catalog|productList|items)\s*=\s*/i.exec(js); if (!m) continue;
      const start = js.indexOf('[', m.index + m[0].length); if (start < 0) continue; let depth = 0, quote = '', escaped = false;
      for (let i = start; i < js.length; i++) { const ch = js[i]; if (quote) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === quote) quote = ''; continue; } if (ch === '"' || ch === "'") { quote = ch; continue; } if (ch === '[') depth++; else if (ch === ']') { depth--; if (!depth) { try { const data = JSON.parse(js.slice(start, i + 1)); if (Array.isArray(data)) blocks.push('Catalogue data from ' + src + ':\n' + JSON.stringify(data).slice(0, 36000)); } catch {} break; } } }
    } catch {}
  }
  return blocks.join('\n\n').slice(0, 42000);
}

function linksFrom(html: string, current: string, origin: string) {
  const found = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>/gi)) {
    const normalized = normalize(new URL(match[1], current).toString(), origin);
    if (normalized) found.add(normalized);
    if (found.size >= 500) break;
  }
  return [...found];
}
function structuredData(html: string) {
  const results: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      const visit = (item: unknown) => {
        if (!item || typeof item !== "object") return;
        if (Array.isArray(item)) { item.forEach(visit); return; }
        const obj = item as Record<string, unknown>;
        const type = Array.isArray(obj["@type"]) ? obj["@type"].join(", ") : String(obj["@type"] || "");
        if (/Product|Offer|Vehicle|RealEstateListing|Residence|House|Apartment|Place|Landform/i.test(type)) {
          const fields = ["name", "description", "sku", "price", "priceCurrency", "availability", "address", "telephone", "brand", "model", "vehicleModelDate", "mileageFromOdometer", "numberOfBedrooms", "floorSize", "url"];
          const picked = fields.filter(k => obj[k] !== undefined).map(k => k + ": " + (typeof obj[k] === "object" ? JSON.stringify(obj[k]) : String(obj[k])));
          if (picked.length) results.push("Structured listing (" + type + "): " + picked.join(" | "));
        }
        Object.values(obj).forEach(visit);
      };
      visit(data);
    } catch { /* Ignore malformed structured data. */ }
  }
  return [...new Set(results)].slice(0, 100).join("\n");
}
async function fetchHtml(url: string, origin: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(7000), redirect: "follow", headers: { "User-Agent": "P1llarAIWebsiteImporter/1.2 (+https://p1llar-ai.vercel.app)", Accept: "text/html,application/xhtml+xml" } });
  if (new URL(response.url).origin !== origin || !response.ok || !(response.headers.get("content-type") || "").toLowerCase().includes("text/html")) return null;
  const html = (await response.text()).slice(0, 1_200_000);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || new URL(url).pathname || "Website page";
  const structured = structuredData(html);
  const catalogue = await fetchCatalogueScripts(html, url, origin);
  const text = cleanHtml(html).slice(0, 12000);
  return { title: title.slice(0, 200), content: "Source page: " + url + "\n\n" + (structured ? "EXTRACTED LISTING DATA\n" + structured + "\n\n" : "") + (catalogue ? "EXTRACTED CATALOGUE DATA\n" + catalogue + "\n\n" : "") + text, links: linksFrom(html, url, origin) };
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !serviceKey || !publicKey) return NextResponse.json({ error: "Server authentication is not configured." }, { status: 503 });
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const auth = createClient(supabaseUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await auth.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
    const body = await request.json();
    const businessId = typeof body.businessId === "string" ? body.businessId : "";
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    if (!businessId || !rawUrl) return NextResponse.json({ error: "Choose a business and enter its website URL." }, { status: 400 });
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: business, error: businessError } = await db.from("businesses").select("id,name,owner_id").eq("id", businessId).single();
    if (businessError || !business || business.owner_id !== authData.user.id) return NextResponse.json({ error: "You do not have access to this business." }, { status: 403 });

    const start = publicUrl(rawUrl), origin = start.origin;
    const isFirst = !Array.isArray(body.queue) || !Array.isArray(body.visited);
    const queue: string[] = isFirst ? [start.toString()] : body.queue.slice(0, MAX_QUEUE).map((u: unknown) => typeof u === "string" ? normalize(u, origin) : null).filter((u: string | null): u is string => !!u);
    const visited = new Set<string>(isFirst ? [] : body.visited.slice(0, MAX_STATE).map((u: unknown) => typeof u === "string" ? normalize(u, origin) : null).filter((u: string | null): u is string => !!u));
    if (isFirst) {
      try {
        const sitemap = await fetch(origin + "/sitemap.xml", { signal: AbortSignal.timeout(4000), redirect: "follow" });
        if (sitemap.ok && new URL(sitemap.url).origin === origin) {
          const xml = (await sitemap.text()).slice(0, 5_000_000);
          for (const m of xml.matchAll(/<loc[^>]*>\s*([^<]+)\s*<\/loc>/gi)) {
            const item = normalize(m[1].trim().replace(/&amp;/g, "&"), origin);
            if (item && !queue.includes(item) && queue.length < MAX_QUEUE) queue.push(item);
          }
        }
      } catch { /* Sitemap is optional. */ }
      if (!queue.includes(start.toString())) queue.unshift(start.toString());
    }
    const collected: { title: string; content: string }[] = [];
    let attempted = 0;
    while (queue.length && attempted < BATCH_SIZE) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current); attempted++;
      try {
        const page = await fetchHtml(current, origin);
        if (!page) continue;
        if (page.content.length > 100) collected.push({ title: page.title, content: page.content });
        for (const link of page.links) if (!visited.has(link) && !queue.includes(link) && queue.length < MAX_QUEUE) queue.push(link);
      } catch { /* Skip unavailable pages. */ }
    }
    if (collected.length) {
      const { data: existing } = await db.from("knowledge_sources").select("content").eq("business_id", businessId).eq("source_type", "website");
      const existingUrls = new Set((existing || []).map((row: {content:string}) => row.content.match(/^Source page: (.+)\n/)?.[1]).filter(Boolean));
      const rows = collected.filter(page => { const url = page.content.match(/^Source page: (.+)\n/)?.[1]; return url && !existingUrls.has(url); })
        .map(page => ({ business_id: businessId, title: page.title, content: page.content, source_type: "website", processing_status: "ready" }));
      if (rows.length) { const { error: insertError } = await db.from("knowledge_sources").insert(rows); if (insertError) throw insertError; }
    }
    const remaining = queue.filter(url => !visited.has(url));
    const done = remaining.length === 0;
    if (done && visited.size > 0 && collected.length === 0 && isFirst) return NextResponse.json({ error: "I couldn't read text from that website. It may block automatic access or load content with JavaScript. Try its public catalogue, About, FAQ, or Contact page." }, { status: 422 });
    return NextResponse.json({ success: true, done, pagesVisited: visited.size, pagesImportedThisBatch: collected.length, queue: remaining.slice(0, MAX_QUEUE), visited: [...visited].slice(-MAX_STATE), message: done ? "Finished scanning " + visited.size + " pages for " + business.name + "." : "Scanned " + visited.size + " pages so far; continuing." });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Website import failed." }, { status: 400 }); }
}
