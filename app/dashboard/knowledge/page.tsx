"use client";

import "../../auth.css";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpen, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Business = { id: string; name: string; slug: string };
type Source = { id: string; title: string; content: string; source_type: string; created_at: string };

export default function KnowledgePage() {
  const params = useSearchParams();
  const businessId = params.get("business") || "";
  const [business, setBusiness] = useState<Business | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const db = getSupabaseBrowserClient();
      const { data: biz, error: bizError } = await db.from("businesses").select("id,name,slug").eq("id", businessId).single();
      if (bizError) throw bizError;
      setBusiness(biz);
      const { data, error: sourceError } = await db.from("knowledge_sources").select("id,title,content,source_type,created_at").eq("business_id", businessId).order("created_at", { ascending: false });
      if (sourceError) throw sourceError;
      setSources(data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load knowledge."); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (businessId) void load(); else { setError("Open this page from a workspace card."); setLoading(false); } }, [businessId]);

  async function addSource(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (title.trim().length < 2 || content.trim().length < 5) { setError("Add a title and at least a short answer or business detail."); return; }
    setSaving(true);
    try {
      const db = getSupabaseBrowserClient();
      const { data, error: saveError } = await db.from("knowledge_sources").insert({ business_id: businessId, title: title.trim(), content: content.trim(), source_type: "manual", processing_status: "ready" }).select("id,title,content,source_type,created_at").single();
      if (saveError) throw saveError;
      setSources(current => [data, ...current]); setTitle(""); setContent(""); setNotice("Knowledge saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save knowledge."); }
    finally { setSaving(false); }
  }
  async function removeSource(id: string) {
    if (!confirm("Delete this knowledge item?")) return;
    const db = getSupabaseBrowserClient();
    const { error: deleteError } = await db.from("knowledge_sources").delete().eq("id", id);
    if (deleteError) setError(deleteError.message); else setSources(items => items.filter(item => item.id !== id));
  }
  return <main className="dashboard-page"><header className="dashboard-header"><Link href="/dashboard" className="auth-brand"><span className="brand-mark"><BookOpen size={20}/></span><span>P1llar<span className="brand-ai"> AI</span></span></Link><Link href="/dashboard" className="dashboard-signout"><ArrowLeft size={15}/> Dashboard</Link></header><section className="dashboard-content"><div className="dashboard-eyebrow">BUSINESS KNOWLEDGE</div><h1>{business?.name || "Knowledge base"}</h1><p className="dashboard-lead">Add FAQs, product details, prices, delivery information, and company policies.</p><section className="workspace-create"><h2><Plus size={19}/> Add knowledge</h2><form className="workspace-form" onSubmit={addSource}><label htmlFor="knowledge-title">Question or topic</label><input id="knowledge-title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={240} placeholder="e.g. What are your delivery fees?" required/><label htmlFor="knowledge-content">Answer or details</label><textarea id="knowledge-content" value={content} onChange={e=>setContent(e.target.value)} rows={6} maxLength={12000} placeholder="Write the correct answer customers should receive..." required/><button className="button button-primary" type="submit" disabled={saving}>{saving ? <><LoaderCircle size={16} className="auth-spinner"/> Saving...</> : "Save knowledge"}</button></form></section>{error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="auth-message" role="status">{notice}</p>}<div className="workspace-list-heading"><h2>Saved knowledge ({sources.length})</h2><button className="refresh-button" onClick={()=>void load()} type="button">Refresh</button></div>{loading ? <div className="dashboard-loading"><LoaderCircle size={20} className="auth-spinner"/> Loading knowledge...</div> : sources.length===0 ? <div className="workspace-empty"><BookOpen size={25}/><h3>Your knowledge base is empty</h3><p>Add your first business question and answer above.</p></div> : <div className="workspace-grid">{sources.map(item=><article className="workspace-card" key={item.id}><div className="workspace-card-icon"><BookOpen size={18}/></div><h3>{item.title}</h3><p style={{whiteSpace:"pre-wrap"}}>{item.content}</p><button type="button" className="refresh-button" onClick={()=>void removeSource(item.id)}><Trash2 size={14}/> Delete</button></article>)}</div>}{business && <p className="dashboard-note">Business slug: <strong>{business.slug}</strong></p>}</section></main>;
}
