import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
function adminClient() {
  if (!supabaseUrl || !serviceKey) throw new Error("Support is not configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.");
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
function errorText(error: unknown) { if (error instanceof Error) return error.message; if (error && typeof error === "object" && "message" in error) return String(error.message); return "Support service error."; }

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get("slug")?.trim();
    if (!slug) return NextResponse.json({ error: "Missing business slug." }, { status: 400 });
    const db = adminClient();
    const { data, error } = await db.from("businesses").select("id,name,slug,support_greeting,brand_color").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "This support page does not exist." }, { status: 404 });
    return NextResponse.json({ business: { id: data.id, name: data.name, slug: data.slug, greeting: data.support_greeting, brandColor: data.brand_color } });
  } catch (error) { console.error("P1llar support API failed:", error); return NextResponse.json({ error: errorText(error) }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 2000) : "";
    if (!slug || !question) return NextResponse.json({ error: "Enter a question." }, { status: 400 });
    const db = adminClient();
    const { data: business, error: businessError } = await db.from("businesses").select("id,name").eq("slug", slug).maybeSingle();
    if (businessError) throw businessError;
    if (!business) return NextResponse.json({ error: "This support page does not exist." }, { status: 404 });
    const { data: knowledge, error: knowledgeError } = await db.from("knowledge_sources").select("title,content").eq("business_id", business.id).eq("processing_status", "ready").limit(100);
    if (knowledgeError) throw knowledgeError;
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return NextResponse.json({ error: "AI answers are not enabled yet. Add OPENROUTER_API_KEY in Vercel." }, { status: 503 });
    const context = (knowledge ?? []).map((item, i) => `[${i + 1}] ${item.title}\n${item.content}`).join("\n\n").slice(0, 24000);
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://p1llar-ai.vercel.app", "X-Title": "P1llar AI Support" }, body: JSON.stringify({ model: "nvidia/nemotron-3-ultra-550b-a55b:free", temperature: 0.2, max_tokens: 600, messages: [{ role: "system", content: `You are the customer support assistant for ${business.name}. Answer the visitor’s actual question in natural, helpful language using the business knowledge below. If the answer is not present, say you do not have that information and suggest contacting the business. Never invent prices or policies. Do not output safety classifications, moderation labels, JSON safety assessments, or labels such as “User Safety: safe”. Be concise.\n\nBUSINESS KNOWLEDGE:\n${context || "No knowledge has been added yet."}` }, { role: "user", content: question }] }) });
    const aiData = await response.json().catch(() => null);
    if (!response.ok) {
      const providerError = aiData?.error;
      const providerMessage = typeof providerError?.message === "string" ? providerError.message : "No error message returned";
      const providerCode = providerError?.code ?? response.status;
      console.error("P1llar OpenRouter request failed:", {
        status: response.status,
        code: providerCode,
        message: providerMessage,
        model: "openrouter/free",
      });
      return NextResponse.json(
        { error: "OpenRouter request failed: " + providerMessage, providerStatus: response.status, providerCode },
        { status: 502 }
      );
    }
    const answer = aiData.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) return NextResponse.json({ error: "AI provider returned an empty answer." }, { status: 502 });
    if (/user\s*safety\s*:\s*(safe|unsafe)|response\s*safety\s*:/i.test(answer.trim())) {
      console.error("P1llar support model returned a safety-classification response instead of an answer.");
      return NextResponse.json({ error: "The support assistant returned an invalid response. Please try again." }, { status: 502 });
    }
    const { data: conversation, error: conversationError } = await db.from("support_conversations").insert({ business_id: business.id, status: "open" }).select("id").single();
    if (conversationError) throw conversationError;
    const { error: messageError } = await db.from("support_messages").insert([{ conversation_id: conversation.id, sender_type: "visitor", content: question, grounded: false }, { conversation_id: conversation.id, sender_type: "assistant", content: answer.trim(), grounded: (knowledge ?? []).length > 0 }]);
    if (messageError) throw messageError;
    return NextResponse.json({ answer: answer.trim() });
  } catch (error) { return NextResponse.json({ error: errorText(error) }, { status: 503 }); }
}
