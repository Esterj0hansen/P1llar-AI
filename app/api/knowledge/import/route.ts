import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PAGES = 500;
const BATCH_SIZE = 5;
const MAX_QUEUE = 1500;
const SKIP_FILE = /\.(pdf|jpg|jpeg|png|gif|webp|zip|mp4|mp3|css|js|ico|woff2?)(\?|$)/i;

function cleanHtml(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n").trim();
}
function publicUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Enter a valid public website URL.");
  const host = url.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(host) || host.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) throw new Error("Enter a public website domain.");
  url.hash = "";
  return url;
}
function normalize(raw: string, origin: string) {
  try {
    const u = publicUrl(raw);
    if (u.origin !== origin || SKIP_FILE.test(u.pathname)) return null;
    u.hash = "";
    if (u.pathname !== "/") u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString();
  } catch { return null; }
}
function linksFrom(html: string, current: string, origin: string) {
  const found = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>/gi)) {
    const url = normalize(new URL(match[1], current).toString(), origin);
    if (url) found.add(url);
    if (found.size >= 300) break;
  }
  return [...found];
}
async function fetchHtml(url: string, origin: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(7000), redirect: "follow", headers: { "User-Agent": "P1llarAIWebsiteImporter/1.1 (+https://p1llar-ai.vercel.app)", Accept: "text/html,application/xhtml+xml" } });
  // Do not accept redirects to a different host.
  if (new URL(response.url).origin !== origin || !response.ok || !(response.headers.get("content-type") || "").toLowerCase().includes("text/html")) return null;
  const html = (await response.text()).slice(0, 1_200_000);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || new URL(url).pathname || "Website page";
  const content = cleanHtml(html).slice(0, 12000);
  return { title: title.slice(0, 200), content: "Source page: " + url + "\n\n" + content, links: linksFrom(html, url, origin) };
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

    const start = publicUrl(rawUrl);
    const origin = start.origin;
    const isFirst = !Array.isArray(body.queue) || !Array.isArray(body.visited);
    const queue: string[] = isFirst ? [start.toString()] : body.queue.slice(0, MAX_QUEUE).map((u: unknown) => typeof u === "string" ? normalize(u, origin) : null).filter((u: string | null): u is string => !!u);
    const visitedList: string[] = isFirst ? [] : body.visited.slice(0, MAX_PAGES).map((u: unknown) => typeof u === "string" ? normalize(u, origin) : null).filter((u: string | null): u is string => !!u);
    const visited = new Set(visitedList);
    const collected: { title: string; content: string }[] = [];

    // On the first batch, discover sitemap URLs when available.
    if (isFirst) {
      try {
        const sitemap = await fetch(origin + "/sitemap.xml", { signal: AbortSignal.timeout(4000), redirect: "follow" });
        if (sitemap.ok && new URL(sitemap.url).origin === origin && (sitemap.headers.get("content-type") || "").includes("xml")) {
          const xml = (await sitemap.text()).slice(0, 1_500_000);
          for (const m of xml.matchAll(/<loc[^>]*>\s*([^<]+)\s*<\/loc>/gi)) {
            const item = normalize(m[1].trim().replace(/&amp;/g, "&"), origin);
            if (item && !queue.includes(item)) queue.push(item);
            if (queue.length >= MAX_QUEUE) break;
          }
        }
      } catch { /* Sitemap is optional. */ }
      if (!queue.includes(start.toString())) queue.unshift(start.toString());
    }

    let attempted = 0;
    while (queue.length && attempted < BATCH_SIZE && visited.size < MAX_PAGES) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current); attempted++;
      try {
        const page = await fetchHtml(current, origin);
        if (!page) continue;
        if (page.content.length > 100) collected.push({ title: page.title, content: page.content });
        for (const link of page.links) {
          if (!visited.has(link) && !queue.includes(link) && queue.length < MAX_QUEUE) queue.push(link);
        }
      } catch { /* Skip unavailable pages and continue next batch. */ }
    }

    if (collected.length) {
      // Avoid creating duplicate rows when the same URL is re-imported.
      const { data: existing } = await db.from("knowledge_sources").select("content").eq("business_id", businessId).eq("source_type", "website");
      const existingUrls = new Set((existing || []).map((row: {content:string}) => row.content.match(/^Source page: (.+)\n/)?.[1]).filter(Boolean));
      const rows = collected.filter(page => {
        const url = page.content.match(/^Source page: (.+)\n/)?.[1];
        return url && !existingUrls.has(url);
      }).map(page => ({ business_id: businessId, title: page.title, content: page.content, source_type: "website", processing_status: "ready" }));
      if (rows.length) {
        const { error: insertError } = await db.from("knowledge_sources").insert(rows);
        if (insertError) throw insertError;
      }
    }

    const remaining = queue.filter(url => !visited.has(url));
    const done = remaining.length === 0 || visited.size >= MAX_PAGES;
    if (done && visited.size > 0 && collected.length === 0 && isFirst) return NextResponse.json({ error: "I couldn't read text from that website. It may block automatic access or load content with JavaScript. Try its public Products, Services, About, FAQ, or Contact page." }, { status: 422 });
    return NextResponse.json({
      success: true, done, pagesVisited: visited.size, pagesImportedThisBatch: collected.length,
      queue: remaining.slice(0, MAX_QUEUE), visited: [...visited].slice(-MAX_PAGES),
      message: done
        ? "Finished scanning " + visited.size + " pages for " + business.name + (visited.size >= MAX_PAGES ? ". The 500-page safety limit was reached." : ".")
        : "Scanned " + visited.size + " pages so far; continuing."
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Website import failed." }, { status: 400 });
  }
}
