"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, Clock3, Command, FileText, Globe2, Menu, MessageCircle, ShieldCheck, Sparkles, X } from "lucide-react";

const faqs = [
  { q: "What information can P1llar AI use?", a: "You can add your website content, product catalogues, FAQs, policies, price lists and other business documents. The assistant is designed to answer from the information you provide." },
  { q: "Does it work if my business has no website?", a: "Yes. You can create a support page for your business and add your information directly. A website is not required to get started." },
  { q: "Will it make up an answer when it does not know?", a: "That is exactly what we want to avoid. The assistant should acknowledge when the provided information does not contain an answer, rather than inventing business policies or prices." },
  { q: "Can customers contact my team?", a: "The first version focuses on a hosted support page and knowledge-based answers. Team handoff and additional channel integrations can be added as the product grows." },
];

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [demoMessage, setDemoMessage] = useState("");
  const [demoReply, setDemoReply] = useState("");
  const [sent, setSent] = useState(false);

  function tryDemo() {
    const question = demoMessage.trim();
    if (!question) return;
    setDemoReply("This is a preview of how P1llar AI responds. Once a business adds its verified information, its assistant can answer questions using that knowledge. This demo is not connected to a real business knowledge base yet.");
    setSent(true);
  }

  return (
    <main>
      <div className="announcement"><span className="announcement-dot" /> Introducing a more dependable way to support your customers <ArrowUpRight size={14} /></div>
      <header className="site-header">
        <a className="brand" href="#" aria-label="P1llar AI home"><span className="brand-mark"><Command size={20} strokeWidth={2.4} /></span><span>P1llar<span className="brand-ai"> AI</span></span></a>
        <nav className={mobileOpen ? "nav-links nav-open" : "nav-links"}>
          <a href="#how-it-works" onClick={() => setMobileOpen(false)}>How it works</a>
          <a href="#features" onClick={() => setMobileOpen(false)}>Features</a>
          <a href="#pricing" onClick={() => setMobileOpen(false)}>Pricing</a>
          <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
          <a className="mobile-cta" href="#get-started" onClick={() => setMobileOpen(false)}>Get early access <ArrowRight size={15} /></a>
        </nav>
        <div className="header-actions"><a className="login-link" href="#get-started">Sign in</a><a className="button button-dark header-cta" href="#get-started">Get early access <ArrowUpRight size={15} /></a></div>
        <button className="menu-toggle" aria-label={mobileOpen ? "Close menu" : "Open menu"} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
      </header>

      <section className="hero section-wrap">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> SUPPORT, BUILT AROUND YOUR BUSINESS</div>
          <h1>Your business.<br />Your knowledge.<br /><span>Always available.</span></h1>
          <p className="hero-description">Give every customer a helpful answer, any time of day. P1llar AI turns your business information into a support assistant that knows what you do—and when to ask for help.</p>
          <div className="hero-actions"><a className="button button-primary" href="#get-started">Build your support assistant <ArrowRight size={17} /></a><a className="text-link" href="#how-it-works">See how it works <ArrowDownRight size={16} /></a></div>
          <div className="hero-proof"><div className="proof-icons"><span><ShieldCheck size={16} /></span><span><FileText size={16} /></span><span><Clock3 size={16} /></span></div><p>Grounded in your information. Available around the clock.</p></div>
        </div>
        <div className="hero-visual" aria-label="Preview of an AI customer support conversation">
          <div className="visual-orbit orbit-one"></div><div className="visual-orbit orbit-two"></div>
          <div className="floating-label label-top"><span className="status-dot" /> Your assistant is ready</div>
          <div className="chat-window">
            <div className="chat-head"><div className="chat-brand"><span className="chat-brand-icon"><Command size={17} /></span><div><strong>Northstar Studio</strong><small>AI support assistant</small></div></div><span className="online-status">● Online</span></div>
            <div className="chat-content"><div className="welcome-icon"><Sparkles size={20} /></div><h3>Hi there. How can I help?</h3><p>Ask me about our services, pricing, or how we work.</p>
              <div className="sample-question"><span>What services do you offer?</span><ArrowUpRight size={15} /></div>
              <div className="sample-question"><span>How can I get started?</span><ArrowUpRight size={15} /></div>
              {sent && <><div className="user-message">{demoMessage}</div><div className="assistant-message">{demoReply}</div></>}
              <form className="chat-input" onSubmit={e => { e.preventDefault(); tryDemo(); }}><input aria-label="Ask the demo assistant" placeholder="Ask a question..." value={demoMessage} onChange={e => setDemoMessage(e.target.value)} /><button aria-label="Send demo question" type="submit"><ArrowRight size={17} /></button></form>
              <div className="powered-note"><ShieldCheck size={12} /> Answers based on business knowledge</div>
            </div>
          </div>
          <div className="floating-label label-bottom"><span className="mini-spark"><Sparkles size={15} /></span><div><strong>Knowledge-led answers</strong><small>Not guesswork</small></div><Check size={17} className="check-icon" /></div>
          <div className="visual-glow"></div>
        </div>
      </section>

      <section className="trust-strip"><div className="trust-inner"><span>MADE FOR TEAMS THAT CARE ABOUT THE CUSTOMER EXPERIENCE</span><div><span><Globe2 size={17} /> Online businesses</span><span><MessageCircle size={17} /> Service teams</span><span><FileText size={17} /> Product-led brands</span></div></div></section>

      <section className="section-wrap feature-section" id="features"><div className="section-heading"><div className="eyebrow"><span className="eyebrow-line" /> LESS REPETITION. MORE CLARITY.</div><h2>Support that starts with<br /><span>what you actually know.</span></h2><p>Your customers get consistent information. Your team gets more time to focus on work that needs a human.</p></div>
        <div className="feature-grid">
          <article className="feature-card feature-card-dark"><div className="feature-icon"><FileText size={21} /></div><span className="card-index">01 / KNOWLEDGE</span><h3>Bring your business knowledge</h3><p>Start with FAQs, policies, product details, documents or website content. Keep the answers rooted in your own information.</p><div className="document-stack"><div><span className="doc-icon"><FileText size={15} /></span><span><strong>Product guide.pdf</strong><small>Business knowledge</small></span><Check size={15} /></div><div><span className="doc-icon"><Globe2 size={15} /></span><span><strong>Website content</strong><small>Pages and FAQs</small></span><Check size={15} /></div></div></article>
          <article className="feature-card"><div className="feature-icon feature-icon-blue"><MessageCircle size={21} /></div><span className="card-index">02 / CUSTOMER EXPERIENCE</span><h3>A support page that feels like yours</h3><p>Give your customers a dedicated place to ask questions, find useful information and understand what to do next.</p><div className="mini-profile"><span className="profile-avatar">N</span><div><strong>Your business name</strong><small>Brand-ready support experience</small></div><ArrowUpRight size={17} /></div></article>
          <article className="feature-card"><div className="feature-icon feature-icon-green"><ShieldCheck size={21} /></div><span className="card-index">03 / TRUST</span><h3>Honest answers over confident guesses</h3><p>When the knowledge base has no clear answer, the assistant should say so instead of inventing a price, policy or promise.</p><div className="trust-note"><ShieldCheck size={17} /><span><strong>Built for clarity</strong><small>Uncertainty is better than misinformation.</small></span></div></article>
        </div>
      </section>

      <section className="process-section" id="how-it-works"><div className="section-wrap process-inner"><div className="section-heading"><div className="eyebrow"><span className="eyebrow-line" /> SIMPLE TO GET STARTED</div><h2>From business info to<br /><span>better answers.</span></h2><p>No need to start with a complicated setup. Build from the information you already have.</p></div><div className="steps"><div className="step"><span className="step-number">01</span><div><h3>Add your information</h3><p>Share your website content, upload documents, or enter your business details manually.</p></div><ArrowUpRight size={19} /></div><div className="step"><span className="step-number">02</span><div><h3>Shape your assistant</h3><p>Set your business identity and review how your support assistant should represent you.</p></div><ArrowUpRight size={19} /></div><div className="step"><span className="step-number">03</span><div><h3>Share your support page</h3><p>Give customers one simple place to ask questions and get information at any time.</p></div><ArrowUpRight size={19} /></div></div></div></section>

      <section className="section-wrap pricing-section" id="pricing"><div className="pricing-copy"><div className="eyebrow"><span className="eyebrow-line" /> STRAIGHTFORWARD PRICING</div><h2>Useful support.<br /><span>Clear costs.</span></h2><p>Start with a plan that fits your business. Early-access pricing is being finalised while we work with our first customers.</p><div className="pricing-footnote"><ShieldCheck size={17} /> No payment is collected on this preview site.</div></div><div className="pricing-card"><div className="pricing-badge"><span className="status-dot" /> EARLY ACCESS</div><h3>Founding business</h3><p className="pricing-intro">For teams ready to test a more reliable support experience.</p><div className="price-line"><span className="price">Coming soon</span></div><div className="pricing-divider"></div><ul><li><Check size={16} /> Personalised support page</li><li><Check size={16} /> Business knowledge setup</li><li><Check size={16} /> Guided onboarding</li><li><Check size={16} /> Direct feedback channel</li></ul><a className="button button-dark pricing-button" href="#get-started">Join the early-access list <ArrowRight size={16} /></a><small>Pricing and availability confirmed before onboarding.</small></div></section>

      <section className="cta-section" id="get-started"><div className="cta-pattern"></div><div className="cta-content"><div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> LET'S BUILD BETTER SUPPORT</div><h2>Your customers have questions.<br /><span>Be ready with better answers.</span></h2><p>We're preparing the first version of P1llar AI and looking for businesses to help shape it.</p><a className="button button-white" href="mailto:hello@p1llar.ai?subject=P1llar%20AI%20early%20access">Request early access <ArrowUpRight size={17} /></a><small>Early access requests open by email. No account or payment is created here yet.</small></div></section>

      <section className="section-wrap faq-section" id="faq"><div className="faq-intro"><div className="eyebrow"><span className="eyebrow-line" /> GOOD QUESTIONS</div><h2>Questions, <span>answered.</span></h2><p>Here is what to know about the product we are building.</p></div><div className="faq-list">{faqs.map((faq, i) => <div className={openFaq === i ? "faq-item faq-open" : "faq-item"} key={faq.q}><button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}><span>{faq.q}</span><ChevronDown size={18} /></button>{openFaq === i && <p>{faq.a}</p>}</div>)}</div></section>

      <footer className="site-footer"><div className="footer-main"><a className="brand" href="#"><span className="brand-mark"><Command size={20} strokeWidth={2.4} /></span><span>P1llar<span className="brand-ai"> AI</span></span></a><p>Customer support, grounded in your business.</p><div className="footer-links"><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a><a href="mailto:hello@p1llar.ai">Contact</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} P1llar AI. All rights reserved.</span><span>Built around clarity and trust <CircleHelp size={14} /></span></div></footer>
    </main>
  );
}
