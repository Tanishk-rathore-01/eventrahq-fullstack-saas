import { Link } from 'react-router-dom';
import { ArrowRight, Bot, Gauge, LockKeyhole, Rocket, ShieldCheck, Workflow } from 'lucide-react';

const capabilities = [
  ['Supabase-first backend', 'Real PostgreSQL schema, server-side service key handling, audit logs, indexed tables.'],
  ['AI event strategy', 'Gemini/OpenAI-ready event brief generation with safe fallback when keys are absent.'],
  ['RBAC security', 'Admin, organizer, and attendee roles with protected routes and JWT sessions.'],
  ['Operations dashboard', 'Track registrations, check-ins, capacity, revenue, and event health.']
];

export default function Home() {
  return (
    <main>
      <section className="hero container">
        <div className="hero-copy">
          <div className="eyebrow"><Rocket size={16} /> Event Operations Cloud · 2026-ready SaaS project</div>
          <h1>Run high-conversion events with AI-assisted planning, secure ticketing, and executive-grade analytics.</h1>
          <p>
            EventraHQ is a full-stack event management platform built to look and behave like a professional SaaS product, not a copied CRUD tutorial.
          </p>
          <div className="hero-actions">
            <Link to="/events" className="primary-btn">Explore Events <ArrowRight size={17} /></Link>
            <Link to="/login" className="secondary-btn">Open Demo Workspace</Link>
          </div>
          <div className="trust-grid">
            <span><ShieldCheck size={15} /> JWT + RBAC</span>
            <span><LockKeyhole size={15} /> Supabase PostgreSQL</span>
            <span><Gauge size={15} /> API rate limiting</span>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="dashboard-glass">
            <div className="window-dots"><span /><span /><span /></div>
            <div className="pulse-line" />
            <div className="metric-row"><span>Registrations</span><strong>14,820</strong></div>
            <div className="metric-row"><span>Occupancy</span><strong>87%</strong></div>
            <div className="metric-row"><span>Check-in velocity</span><strong>2.4k/hr</strong></div>
            <div className="mini-chart"><i /><i /><i /><i /><i /></div>
          </div>
          <div className="floating-chip chip-one"><Bot size={16} /> AI Brief Ready</div>
          <div className="floating-chip chip-two"><Workflow size={16} /> Ops Pipeline</div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <span>Industry-level scope</span>
          <h2>Built around the signals interviewers actually check.</h2>
        </div>
        <div className="capability-grid">
          {capabilities.map(([title, text]) => (
            <div className="capability-card" key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
