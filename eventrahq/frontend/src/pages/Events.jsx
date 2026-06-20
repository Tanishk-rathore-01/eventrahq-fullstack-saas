import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { eventApi } from '../api/client.js';
import EventCard from '../components/EventCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const categories = useMemo(() => [...new Set(events.map((event) => event.category))], [events]);

  async function load() {
    setLoading(true);
    try {
      const payload = await eventApi.list({ search, category });
      setEvents(payload.events);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function register(id) {
    if (!user) {
      setMessage('Login first to reserve a seat.');
      return;
    }
    try {
      await eventApi.register(id);
      setMessage('Seat reserved successfully.');
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="container section page-stack">
      <div className="section-head wide">
        <span>Event marketplace</span>
        <h1>Discover curated events with premium attendee experience.</h1>
      </div>

      <div className="filter-bar">
        <label><Search size={16} /><input placeholder="Search startup, AI, design..." value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label><SlidersHorizontal size={16} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button className="primary-btn" onClick={load}>Apply</button>
      </div>

      {message && <div className="notice-box">{message}</div>}
      {loading ? <div className="screen-center small-height">Loading events...</div> : null}
      {!loading && events.length === 0 ? <EmptyState title="No matching events" text="Adjust filters or seed Supabase sample data." /> : null}

      <div className="event-grid">
        {events.map((event) => <EventCard key={event.id} event={event} onRegister={register} />)}
      </div>
    </main>
  );
}
