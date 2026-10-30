"use client";

import "../../auth.css";
import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpen, LoaderCircle, Plus, Trash2, Globe } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Business = { id: string; name: string; slug: string };
type Source = { id: string; title: string; content: string; source_type: string; created_at: string };

function KnowledgeContent() {
  const params = useSearchParams();
  const businessId = params.get("business") || "";
  const [business, setBusiness] = useState<Business | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");
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
    } catch (e) { const detail = e && typeof e === "object" && "message" in e ? String(e.message) : "Unknown error"; console.error("P1llar knowledge load failed:", e); setError(`Could not load knowledge: ${detail}`); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (businessId) void load(); else { setError("Open this page from a workspace card."); setLoading(false); } }, [businessId]);

  async function importWebsite(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice(""); setImportProgress("");
    const cleanUrl = websiteUrl.trim();
    if (!cleanUrl) { setError("Enter your business website URL."); return; }
    setImporting(true);
    try {
      const db = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await db.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in again.");
      const url = /^https?:\/\//i.test(cleanUrl) ? cleanUrl : "https://" + cleanUrl;
      let queue: string[] | undefined;
      let visited: string[] | undefined;
      let totalImported = 0;
      let pagesVisited = 0;
      let done = false;
      while (!done) {
        const response = await fetch("/api/knowledge/import", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ businessId, url, ...(queue && visited ? { queue, visited } : {}) })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Website import failed.");
        queue = Array.isArray(result.queue) ? result.queue : [];
        visited = Array.isArray(result.visited) ? result.visited : [];
        totalImported += Number(result.pagesImportedThisBatch || 0);
        pagesVisited = Number(result.pagesVisited || pagesVisited);
        done = Boolean(result.done);
        setImportProgress(`Scanned ${pagesVisited} pages · saved ${totalImported} new pages${done ? "" : " · continuing…"}`);
        if (!done) await new Promise(resolve => setTimeout(resolve, 150));
      }
      setNotice(`Website scan complete. Scanned ${pagesVisited} pages and saved ${totalImported} new pages.`);
      setWebsiteUrl("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not import this website."); }
    finally { setImporting(false); setImportProgress(""); }
  }

  async function uploadKnowledgeFile(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!uploadFile) { setError("Choose a file first."); return; }
    setUploading(true);
    try {
      const db = getSupabaseBrowserClient();
      const { data, error: authError } = await db.auth.getSession();
      if (authError) throw authError;
      const token = data.session?.access_token;
      if (!token) throw new Error("Please sign in again.");
      const body = new FormData(); body.append("file", uploadFile); body.append("businessId", businessId);
      const response = await fetch("/api/knowledge/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      setNotice(result.message || "File uploaded."); setUploadFile(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not upload this file."); }
    finally { setUploading(false); }
  }

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

  return <main className="dashboard-page">
    <header className="dashboard-header"><Link href="/dashboard" className="auth-brand"><span className="brand-mark"><BookOpen size={20}/></span><span>P1llar<span className="brand-ai"> AI</span></span></Link><Link href="/dashboard" className="dashboard-signout"><ArrowLeft size={15}/> Dashboard</Link></header>
    <section className="dashboard-content">
      <div className="dashboard-eyebrow">BUSINESS KNOWLEDGE</div><h1>{business?.name || "Knowledge base"}</h1>
      <p className="dashboard-lead">Let P1llar AI learn from your public website, instead of making you type every detail yourself.</p>
      <section className="workspace-create">
        <h2><Globe size={19}/> Import from your website</h2>
        <form className="workspace-form" onSubmit={importWebsite}>
          <label htmlFor="website-url">Business website URL</label>
          <input id="website-url" type="url" value={websiteUrl} onChange={e=>setWebsiteUrl(e.target.value)} placeholder="https://yourbusiness.com" required />
          <p className="dashboard-note">We scan public pages in small batches and check the sitemap when available. There is no fixed total-page ceiling in the crawler; large websites may take time. JavaScript-only pages, private content and files may not be readable.</p>
          <button className="button button-primary" type="submit" disabled={importing || !businessId}>{importing ? <><LoaderCircle size={16} className="auth-spinner"/> Scanning website...</> : <>Import website information <Globe size={16}/></>}</button>
          {importing && <p className="dashboard-note" role="status">{importProgress || "Starting website scan…"}</p>}
        </form>
      </section>
      <section className="workspace-create">
        <h2><BookOpen size={19}/> Upload business documents</h2>
        <form className="workspace-form" onSubmit={uploadKnowledgeFile}>
          <label htmlFor="knowledge-file">PDF, DOCX, TXT, Markdown or CSV (max 10 MB)</label>
          <input id="knowledge-file" type="file" accept=".pdf,.docx,.txt,.md,.csv,application/pdf,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e=>setUploadFile(e.target.files?.[0] || null)} />
          <p className="dashboard-note">TXT, Markdown, CSV, PDF and DOCX files are uploaded to private storage and their extracted text is added to your searchable knowledge base. Scanned image-only PDFs may not contain extractable text.</p>
          <button className="button button-primary" type="submit" disabled={uploading || !uploadFile}>{uploading ? "Uploading..." : "Upload document"}</button>
        </form>
      </section>
      <section className="workspace-create">
        <h2><Plus size={19}/> Add details manually (optional)</h2>
        <form className="workspace-form" onSubmit={addSource}><label htmlFor="knowledge-title">Question or topic</label><input id="knowledge-title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={240} placeholder="e.g. What are your delivery fees?" required/><label htmlFor="knowledge-content">Answer or details</label><textarea id="knowledge-content" value={content} onChange={e=>setContent(e.target.value)} rows={5} maxLength={12000} placeholder="Add details not available on your website..." required/><button className="button button-primary" type="submit" disabled={saving}>{saving ? <><LoaderCircle size={16} className="auth-spinner"/> Saving...</> : "Save details"}</button></form>
      </section>
      {error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="auth-message" role="status">{notice}</p>}
      <div className="workspace-list-heading"><h2>Saved knowledge ({sources.length})</h2><button className="refresh-button" onClick={()=>void load()} type="button">Refresh</button></div>
      {loading ? <div className="dashboard-loading"><LoaderCircle size={20} className="auth-spinner"/> Loading knowledge...</div> : sources.length===0 ? <div className="workspace-empty"><BookOpen size={25}/><h3>Your knowledge base is empty</h3><p>Import your website above to get started.</p></div> : <div className="workspace-grid">{sources.map(item=><article className="workspace-card" key={item.id}><div className="workspace-card-icon"><BookOpen size={18}/></div><h3>{item.title}</h3><p><strong>Source:</strong> {item.source_type === "website" ? "Website import" : item.source_type}</p><p style={{whiteSpace:"pre-wrap"}}>{item.content.slice(0,700)}{item.content.length>700 ? "…" : ""}</p><button type="button" className="refresh-button" onClick={()=>void removeSource(item.id)}><Trash2 size={14}/> Delete</button></article>)}</div>}
      {business && <p className="dashboard-note">Business slug: <strong>{business.slug}</strong></p>}
    </section>
  </main>;
}

export default function KnowledgePage() { return <Suspense fallback={<main className="dashboard-page"><p>Loading knowledge base…</p></main>}><KnowledgeContent /></Suspense>; }
