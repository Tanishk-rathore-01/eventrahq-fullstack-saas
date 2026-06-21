import type { EventRecord, Membership } from '@eventrahq/contracts';
import { Bot, CalendarDays, Plus, QrCode, Send, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { getSupabase } from '../api/supabase.js';
import { useAuth } from '../context/AuthContext.js';

export default function Dashboard() {
  const { me, refresh } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(me?.memberships[0] ?? null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, number>>({});
  const [organizationName, setOrganizationName] = useState('');
  const [invite, setInvite] = useState({ email: '', role: 'checkin_staff' });
  const [message, setMessage] = useState('');

  async function load(selected = membership): Promise<void> {
    if (!selected) return;
    try {
      const [eventData, analyticsData] = await Promise.all([
        apiClient.organizationEvents(selected.organizationId), apiClient.analytics(selected.organizationId)
      ]);
      setEvents(eventData.events); setAnalytics(analyticsData.analytics);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Workspace unavailable.'); }
  }
  useEffect(() => {
    if (!membership && me?.memberships[0]) setMembership(me.memberships[0]);
  }, [me, membership]);
  useEffect(() => { void load(); }, [membership?.organizationId]);
  useEffect(() => {
    if (!membership) return;
    const channel = getSupabase().channel(`workspace-${membership.organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => void load())
      .subscribe();
    return () => { void getSupabase().removeChannel(channel); };
  }, [membership?.organizationId]);

  async function createWorkspace(event: React.FormEvent): Promise<void> {
    event.preventDefault(); setMessage('');
    try { await apiClient.createOrganization(organizationName, 'Event operations workspace'); await refresh(); setMessage('Workspace created.'); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Workspace creation failed.'); }
  }
  async function inviteMember(event: React.FormEvent): Promise<void> {
    event.preventDefault(); if (!membership) return;
    try { await apiClient.invite(membership.organizationId, invite.email, invite.role); setMessage('Invitation email queued.'); setInvite({...invite,email:''}); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Invitation failed.'); }
  }

  if (!me) return <main className="screen-center">Loading workspace…</main>;
  if (!me.memberships.length) return <main className="container section narrow">
    <div className="section-head"><span>Start operating</span><h1>Create your first workspace.</h1><p>Workspace membership isolates events, staff, analytics, and audit history.</p></div>
    <form className="form-card" onSubmit={(event) => void createWorkspace(event)}><label>Workspace name<input value={organizationName} onChange={(e)=>setOrganizationName(e.target.value)} required minLength={2}/></label><button className="primary-btn">Create workspace</button>{message&&<div className="notice-box">{message}</div>}</form>
  </main>;

  const canManage = membership && ['owner','manager'].includes(membership.role);
  return <main className="container section page-stack">
    <div className="dashboard-head"><div className="section-head compact"><span>Organizer workspace</span><h1>{membership?.organizationName}</h1><p>Live registrations, AI planning, staff, and event health.</p></div>
      <select aria-label="Workspace" value={membership?.organizationId} onChange={(e)=>setMembership(me.memberships.find((item)=>item.organizationId===e.target.value)??null)}>{me.memberships.map((item)=><option value={item.organizationId} key={item.organizationId}>{item.organizationName}</option>)}</select>
      {canManage && <Link className="primary-btn" to={`/events/new?organization=${membership.organizationId}`}><Plus/>Create event</Link>}
    </div>
    {message&&<div className="notice-box">{message}</div>}
    <div className="stats-grid four"><div className="stat-card"><CalendarDays/><span>Events</span><strong>{analytics.events??0}</strong></div><div className="stat-card"><Users/><span>Registrations</span><strong>{analytics.registrations??0}</strong></div><div className="stat-card"><QrCode/><span>Check-ins</span><strong>{analytics.checkIns??0}</strong></div><div className="stat-card"><Bot/><span>Gross test revenue</span><strong>₹{((analytics.grossRevenuePaise??0)/100).toLocaleString('en-IN')}</strong></div></div>
    <section className="panel-grid"><div className="surface-panel"><div className="panel-head"><h2>Event portfolio</h2>{membership&&<Link className="text-link" to={`/check-in?organization=${membership.organizationId}`}>Open check-in</Link>}</div>
      {events.length ? events.map((item)=><div className="list-row" key={item.id}><div><strong>{item.title}</strong><span>{new Date(item.startsAt).toLocaleDateString()} · {item.registeredCount}/{item.capacity}</span></div><span className="status">{item.status}</span></div>) : <p className="muted">No events yet.</p>}
    </div>
    {canManage&&<form className="surface-panel form-card" onSubmit={(event)=>void inviteMember(event)}><h2><Send/>Invite staff</h2><label>Email<input type="email" value={invite.email} onChange={(e)=>setInvite({...invite,email:e.target.value})} required/></label><label>Role<select value={invite.role} onChange={(e)=>setInvite({...invite,role:e.target.value})}><option value="manager">Manager</option><option value="checkin_staff">Check-in staff</option></select></label><button className="secondary-btn">Send invitation</button></form>}
    </section>
  </main>;
}
