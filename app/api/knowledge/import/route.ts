import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function cleanHtml(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n").trim();
}

function getPublicUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Enter a valid public website URL.");
  const host = url.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(host) || host.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) throw new Error("Enter a public website domain.");
  url.hash = "";
  return url;
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

    const start = getPublicUrl(rawUrl);
    const origin = start.origin;
    const queue = [start.toString()];
    const visited = new Set<string>();
    const collected: { title: string; content: string }[] = [];

    while (queue.length > 0 && visited.size < 10) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      try {
        const response = await fetch(current, {
          signal: AbortSignal.timeout(9000),
          redirect: "follow",
          headers: { "User-Agent": "P1llarAIWebsiteImporter/1.0 (+https://p1llar-ai.vercel.app)" }
        });
        if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) continue;
        const html = (await response.text()).slice(0, 1_200_000);
        const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || new URL(current).pathname || business.name;
        const text = cleanHtml(html).slice(0, 12000);
        if (text.length > 100) collected.push({ title: title.slice(0, 200), content: "Source page: " + current + "\n\n" + text });

        if (visited.size < 5) {
          for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>/gi)) {
            try {
              const next = new URL(match[1], current);
              if (next.origin !== origin || !["http:", "https:"].includes(next.protocol)) continue;
              if (/\.(pdf|jpg|jpeg|png|gif|webp|zip|mp4|mp3|css|js)(\?|$)/i.test(next.pathname)) continue;
              next.hash = "";
              if (!visited.has(next.toString()) && !queue.includes(next.toString())) queue.push(next.toString());
            } catch {}
            if (queue.length >= 25) break;
          }
        }
      } catch {
        // Skip unavailable pages and continue with other pages on the same site.
      }
    }

    if (!collected.length) return NextResponse.json({
      error: "I couldn't read text from that website. It may block automatic access or load its content with JavaScript. Try its public Products, Services, About, FAQ, or Contact page."
    }, { status: 422 });

    const rows = collected.map(page => ({
      business_id: businessId,
      title: page.title,
      content: page.content,
      source_type: "website",
      processing_status: "ready"
    }));
    const { error: insertError } = await db.from("knowledge_sources").insert(rows);
    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      pagesImported: collected.length,
      message: "Imported " + collected.length + " website pages for " + business.name + "."
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Website import failed." }, { status: 400 });
  }
}
