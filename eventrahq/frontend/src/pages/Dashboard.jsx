import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, CalendarCheck, PlusCircle, TicketCheck } from 'lucide-react';
import { dashboardApi } from '../api/client.js';
import EmptyState from '../components/EmptyState.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi.get().then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <main className="container section"><div className="error-box">{error}</div></main>;
  if (!data) return <main className="screen-center">Loading dashboard...</main>;

  const canCreate = ['admin', 'organizer'].includes(user.role);

  return (
    <main className="container section page-stack">
      <div className="dashboard-head">
        <div className="section-head compact">
          <span>Workspace</span>
          <h1>{user.name}</h1>
          <p>Role: {user.role}. Your event command center is synced with Supabase.</p>
        </div>
        {canCreate && <Link to="/create" className="primary-btn"><PlusCircle size={17} /> Create Event</Link>}
      </div>

      <div className="stats-grid">
        <StatCard label="Organized" value={data.summary.organizedEvents} detail="Events managed by you" />
        <StatCard label="Attending" value={data.summary.attendingEvents} detail="Reserved seats" />
        <StatCard label="Checked in" value={data.summary.checkedInEvents} detail="Verified attendance" />
        <StatCard label="Recommended" value={data.summary.recommendedEvents} detail="Next best events" />
      </div>

      <section className="panel-grid">
        <div className="surface-panel">
          <h2><TicketCheck size={18} /> Your tickets</h2>
          {data.attending.length ? data.attending.map((event) => (
            <div className="list-row" key={event.id}>
              <div><strong>{event.title}</strong><span>{event.city} · {event.date}</span></div>
              <span className={event.checkedIn ? 'status good' : 'status'}>{event.checkedIn ? 'Checked-in' : 'Reserved'}</span>
            </div>
          )) : <EmptyState title="No reservations" text="Reserve a seat from the event marketplace." />}
        </div>

        <div className="surface-panel">
          <h2><CalendarCheck size={18} /> Managed events</h2>
          {data.managed.length ? data.managed.map((event) => (
            <div className="list-row" key={event.id}>
              <div><strong>{event.title}</strong><span>{event.registeredCount ?? 0} / {event.capacity} registered</span></div>
              <span className="status">{event.status}</span>
            </div>
          )) : <EmptyState title="No managed events" text="Organizer and admin accounts can create events." />}
        </div>
      </section>

      <div className="ai-banner">
        <Bot size={22} />
        <div>
          <strong>AI planning is available for organizers.</strong>
          <span>Create an event and generate a strategy brief using Gemini/OpenAI keys from the backend environment.</span>
        </div>
      </div>
    </main>
  );
}
