import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Save } from 'lucide-react';
import { aiApi, eventApi } from '../api/client.js';

const initialForm = {
  title: 'AI Product Leaders Forum',
  category: 'Technology',
  location: 'Noida Convention Hub',
  city: 'Noida',
  date: '2029-04-14',
  time: '11:00',
  capacity: 240,
  price: 799,
  cover: 'aurora',
  description: 'A premium leadership event for builders, marketers, and founders using AI to scale product-led businesses.',
  tags: 'AI, product, leadership, SaaS',
  agenda: 'Opening keynote, Product strategy workshop, AI workflow demo, Networking roundtable'
};

export default function CreateEvent() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [brief, setBrief] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function payload() {
    return {
      ...form,
      capacity: Number(form.capacity),
      price: Number(form.price),
      tags: form.tags.split(',').map((item) => item.trim()).filter(Boolean),
      agenda: form.agenda.split(',').map((item) => item.trim()).filter(Boolean)
    };
  }

  async function generateBrief() {
    setLoading(true);
    setMessage('');
    try {
      const result = await aiApi.eventBrief({
        title: form.title,
        audience: `${form.category} professionals and premium attendees`,
        goal: form.description
      });
      setBrief(result);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function createEvent(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await eventApi.create(payload());
      navigate('/dashboard');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container section page-stack">
      <div className="section-head wide">
        <span>Organizer console</span>
        <h1>Create a premium event experience.</h1>
      </div>

      <div className="creator-grid">
        <form className="form-card large" onSubmit={createEvent}>
          <div className="two-col">
            <label>Title<input value={form.title} onChange={(e) => update('title', e.target.value)} required /></label>
            <label>Category<input value={form.category} onChange={(e) => update('category', e.target.value)} required /></label>
          </div>
          <div className="two-col">
            <label>Location<input value={form.location} onChange={(e) => update('location', e.target.value)} required /></label>
            <label>City<input value={form.city} onChange={(e) => update('city', e.target.value)} required /></label>
          </div>
          <div className="three-col">
            <label>Date<input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} required /></label>
            <label>Time<input type="time" value={form.time} onChange={(e) => update('time', e.target.value)} required /></label>
            <label>Cover<select value={form.cover} onChange={(e) => update('cover', e.target.value)}><option>aurora</option><option>prism</option><option>matrix</option><option>onyx</option></select></label>
          </div>
          <div className="two-col">
            <label>Capacity<input type="number" value={form.capacity} onChange={(e) => update('capacity', e.target.value)} required /></label>
            <label>Price<input type="number" value={form.price} onChange={(e) => update('price', e.target.value)} /></label>
          </div>
          <label>Description<textarea value={form.description} onChange={(e) => update('description', e.target.value)} required /></label>
          <label>Tags<input value={form.tags} onChange={(e) => update('tags', e.target.value)} /></label>
          <label>Agenda<input value={form.agenda} onChange={(e) => update('agenda', e.target.value)} /></label>
          {message && <div className="error-box">{message}</div>}
          <div className="button-row">
            <button type="button" className="secondary-btn" onClick={generateBrief} disabled={loading}><Bot size={17} /> Generate AI Brief</button>
            <button className="primary-btn" disabled={loading}><Save size={17} /> Save Event</button>
          </div>
        </form>

        <aside className="surface-panel ai-panel">
          <h2>AI Event Brief</h2>
          {!brief ? <p>Generate a strategy brief. Gemini is used first if your backend `.env` has `GEMINI_API_KEY`.</p> : (
            <div className="brief-output">
              <span className="role-pill">{brief.provider || 'ai'}</span>
              <p>{brief.brief}</p>
              <h3>Agenda</h3>
              <ul>{(brief.agenda || []).map((item) => <li key={item}>{item}</li>)}</ul>
              <h3>Risks</h3>
              <ul>{(brief.risks || []).map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
