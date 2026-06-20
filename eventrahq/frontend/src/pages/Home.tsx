import { ArrowRight, Bot, CreditCard, QrCode, ShieldCheck, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';

const capabilities = [
  { icon: ShieldCheck, title: 'Tenant-safe operations', text: 'Supabase Auth, row-level security, workspace roles, and immutable audit history.' },
  { icon: Bot, title: 'AI planning workflows', text: 'Persistent Gemini jobs with structured briefs, quotas, retries, and saved history.' },
  { icon: CreditCard, title: 'Verified ticketing', text: 'Razorpay test checkout, signed webhooks, atomic capacity, and email delivery.' },
  { icon: QrCode, title: 'Fast check-in', text: 'Cryptographically signed QR tickets and idempotent staff check-in tools.' }
];

export default function Home() {
  return <main>
    <section className="hero container">
      <div className="hero-copy">
        <div className="eyebrow"><Workflow size={16}/>Event operations cloud</div>
        <h1>Plan, sell, and operate events from one secure workspace.</h1>
        <p>EventraHQ connects organizers, attendees, payments, AI planning, and live check-in without sacrificing tenant isolation or operational control.</p>
        <div className="hero-actions"><Link className="primary-btn" to="/events">Explore events <ArrowRight size={17}/></Link><Link className="secondary-btn" to="/dashboard">Open workspace</Link></div>
        <div className="trust-grid"><span>Supabase RLS</span><span>Gemini structured output</span><span>Razorpay test mode</span></div>
      </div>
      <div className="live-preview" aria-label="Event operations preview">
        <div className="preview-head"><span>Operations pulse</span><span className="status good">Live</span></div>
        <div className="preview-metric"><span>Registrations</span><strong>1,248</strong><small>+18% this week</small></div>
        <div className="preview-grid"><div><span>Check-in</span><strong>82%</strong></div><div><span>Capacity</span><strong>91%</strong></div></div>
        <div className="activity-list"><span>Payment captured</span><span>Ticket delivered</span><span>Attendee checked in</span></div>
      </div>
    </section>
    <section className="section container"><div className="section-head"><span>Production signals</span><h2>Real workflows, not dashboard theatre.</h2></div>
      <div className="capability-grid">{capabilities.map(({ icon: Icon, title, text }) => <article className="capability-card" key={title}><Icon/><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>
  </main>;
}
