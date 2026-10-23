"use client";

import "../auth.css";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Command, LoaderCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);

    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (authError) throw authError;
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else {
          setMessage("Account request received. Check your email for a confirmation link, then return here to sign in.");
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        router.replace("/dashboard");
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-top"><Link href="/" className="auth-back"><ArrowLeft size={16} /> Back to P1llar AI</Link></div>
      <section className="auth-card">
        <Link href="/" className="auth-brand"><span className="brand-mark"><Command size={20} /></span><span>P1llar<span className="brand-ai"> AI</span></span></Link>
        <div className="auth-eyebrow">YOUR SUPPORT WORKSPACE</div>
        <h1>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-subtitle">{mode === "signup" ? "Start building a support experience around your business knowledge." : "Sign in to continue to your business workspace."}</p>
        <div className="auth-tabs">
          <button type="button" className={mode === "signup" ? "auth-tab active" : "auth-tab"} onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>Create account</button>
          <button type="button" className={mode === "login" ? "auth-tab active" : "auth-tab"} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>Sign in</button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
          <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle size={16} className="auth-spinner" /> Please wait...</> : mode === "signup" ? "Create account" : "Sign in"}</button>
        </form>
        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <p className="auth-legal">By continuing, you agree to use P1llar AI responsibly and keep your account credentials private.</p>
      </section>
    </main>
  );
}
