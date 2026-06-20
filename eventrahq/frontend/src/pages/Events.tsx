import type { EventRecord } from '@eventrahq/contracts';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import EventCard from '../components/EventCard.js';

export default function Events() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load(): Promise<void> {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ ...(search && { search }), ...(category && { category }) }).toString();
      setEvents((await apiClient.events(query)).events);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load events.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const categories = [...new Set(events.map((event) => event.category))];
  return <main className="container section page-stack">
    <div className="section-head wide"><span>Event marketplace</span><h1>Experiences worth showing up for.</h1><p>Every reservation uses atomic inventory and produces a verified ticket.</p></div>
    <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <label><Search size={16}/><input aria-label="Search events" placeholder="Search events" value={search} onChange={(event) => setSearch(event.target.value)}/></label>
      <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
      <button className="primary-btn">Apply filters</button>
    </form>
    {error && <div className="error-box" role="alert">{error}</div>}
    {loading ? <div className="skeleton-grid">{[1,2,3].map((item) => <div className="skeleton-card" key={item}/>)}</div>
      : events.length ? <div className="event-grid">{events.map((event) => <EventCard key={event.id} event={event}/>)}</div>
      : <div className="empty-state"><h2>No matching events</h2><p>Try a broader search or another category.</p></div>}
  </main>;
}
