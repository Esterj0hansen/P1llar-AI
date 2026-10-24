"use client";

import "../auth.css";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Command, LoaderCircle, LogOut, Plus, RefreshCw } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Business = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

function makeSlug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadBusinesses = useCallback(async () => {
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }
      setUser(authData.user);
      const { data, error: listError } = await supabase
        .from("businesses")
        .select("id,name,slug,created_at")
        .order("created_at", { ascending: false });
      if (listError) throw listError;
      setBusinesses(data ?? []);
    } catch (caught) {
      const details = caught && typeof caught === "object" && "message" in caught ? String(caught.message) : caught instanceof Error ? caught.message : String(caught ?? "Unknown error");
      console.error("P1llar AI workspace load failed:", caught);
      setError(`Could not load your workspace: ${details}`);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void loadBusinesses(); }, [loadBusinesses]);

  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const cleanName = name.trim();
    const slug = makeSlug(cleanName);
    if (cleanName.length < 2) {
      setError("Enter a business name with at least two characters.");
      return;
    }
    if (!slug) {
      setError("Please use a business name containing letters or numbers.");
      return;
    }
    setCreating(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Your session has expired. Please sign in again.");
      const ownerId = authData.user.id;
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const sessionUserId = sessionData.session?.user.id ?? "no-session-user";
      const hasAccessToken = Boolean(sessionData.session?.access_token);
      const projectHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host || "missing-project-url";
      console.info("P1llar workspace diagnostic", { ownerId, sessionUserId, hasAccessToken, sessionError: sessionError?.message ?? null, projectHost });
      const { error: insertError } = await supabase
        .from("businesses")
        .insert({ name: cleanName, slug: slug + "-" + crypto.randomUUID().slice(0, 6), owner_id: ownerId });
      if (insertError) {
        console.error("P1llar workspace insert diagnostic", { code: insertError.code, message: insertError.message, details: insertError.details, hint: insertError.hint, ownerId, sessionUserId, hasAccessToken, projectHost });
        throw new Error(`${insertError.message} (code: ${insertError.code || "unknown"}; user: ${ownerId}; session user: ${sessionUserId}; session token present: ${hasAccessToken}; project: ${projectHost})`);
      }
      setName("");
      setNotice("Your business workspace has been created.");
      await loadBusinesses();
    } catch (caught) {
      const details = caught && typeof caught === "object" && "message" in caught ? String(caught.message) : caught instanceof Error ? caught.message : String(caught ?? "Unknown error");
      console.error("P1llar AI workspace creation failed:", caught);
      setError(`Could not create the workspace: ${details}`);
    } finally {
      setCreating(false);
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link href="/" className="auth-brand"><span className="brand-mark"><Command size={20} /></span><span>P1llar<span className="brand-ai"> AI</span></span></Link>
        <div className="dashboard-account"><span>{user?.email ?? "Your account"}</span><button type="button" className="dashboard-signout" onClick={signOut}><LogOut size={15} /> Sign out</button></div>
      </header>
      <section className="dashboard-content">
        <div className="dashboard-eyebrow">YOUR WORKSPACE</div>
        <h1>Good to have you here.</h1>
        <p className="dashboard-lead">Create a workspace for a business. Your support knowledge and conversations will belong to that workspace.</p>
        <section className="workspace-create">
          <h2><Plus size={19} /> Create a business workspace</h2>
          <form onSubmit={createBusiness} className="workspace-form">
            <label htmlFor="business-name">Business name</label>
            <div className="workspace-form-row"><input id="business-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Northstar Studio" minLength={2} maxLength={120} required /><button className="button button-primary" type="submit" disabled={creating}>{creating ? <><LoaderCircle size={16} className="auth-spinner" /> Creating...</> : <>Create workspace <ArrowRight size={16} /></>}</button></div>
          </form>
        </section>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-message" role="status">{notice}</p>}
        <div className="workspace-list-heading"><h2>Your businesses</h2><button type="button" className="refresh-button" onClick={() => { setLoading(true); void loadBusinesses(); }}><RefreshCw size={14} /> Refresh</button></div>
        {loading ? <div className="dashboard-loading"><LoaderCircle size={20} className="auth-spinner" /> Loading your workspaces...</div> : businesses.length === 0 ? <div className="workspace-empty"><Command size={25} /><h3>Your first workspace starts here</h3><p>Create a business workspace above. Knowledge tools and the public support page are the next build steps.</p></div> : <div className="workspace-grid">{businesses.map(business => <article className="workspace-card" key={business.id}><div className="workspace-card-icon"><Command size={18} /></div><h3>{business.name}</h3><p>Support page slug: <strong>{business.slug}</strong></p><span className="workspace-status">Workspace created</span><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}><Link className="button button-primary" href={`/dashboard/knowledge?business=${business.id}`}>Manage knowledge <ArrowRight size={16}/></Link><Link className="button button-primary" href={`/dashboard/conversations?business=${business.id}`}>Conversations <ArrowRight size={16}/></Link><Link className="refresh-button" href={`/support/${business.slug}`}>Open support page</Link></div><Link className="button button-primary" href={`/dashboard/conversations?business=${business.id}`}>Conversations <ArrowRight size={16}/></Link><Link className="refresh-button" href={`/support/${business.slug}`}>Open support page</Link></div></article>)}</div>}
        <p className="dashboard-note">This is the first functional workspace step. Manual knowledge, public support chat, and conversation storage are in progress. Billing is not connected yet.</p>
      </section>
    </main>
  );
}
