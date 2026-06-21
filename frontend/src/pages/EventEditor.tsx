import type { AiBrief, EventInput } from '@eventrahq/contracts';
import { Bot, ImagePlus, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { getSupabase } from '../api/supabase.js';

const tomorrow = new Date(Date.now() + 86400000);
tomorrow.setMinutes(0, 0, 0);
const toLocal = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function EventEditor() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const organizationId = params.get('organization') ?? '';
  const [form, setForm] = useState({
    title: '', category: 'Technology', venue: '', city: '', startsAt: toLocal(tomorrow),
    endsAt: toLocal(new Date(tomorrow.getTime() + 3 * 3600000)), capacity: 100, priceRupees: 0,
    description: '', tags: '', agenda: '', status: 'draft' as 'draft' | 'published'
  });
  const [cover, setCover] = useState<File | null>(null);
  const [eventId, setEventId] = useState('');
  const [aiInput, setAiInput] = useState({ audience: '', goal: '' });
  const [brief, setBrief] = useState<AiBrief | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const validOrganization = useMemo(() => /^[0-9a-f-]{36}$/i.test(organizationId), [organizationId]);

  async function uploadCover(): Promise<string | null> {
    if (!cover) return null;
    const signed = await apiClient.signedUpload({
      organizationId, fileName: cover.name, contentType: cover.type, size: cover.size
    });
    const uploaded = await getSupabase().storage.from('event-covers')
      .uploadToSignedUrl(signed.path, signed.token, cover, { contentType: cover.type });
    if (uploaded.error) throw uploaded.error;
    return signed.path;
  }

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault(); setLoading(true); setMessage('');
    try {
      const input: EventInput = {
        organizationId, title: form.title, category: form.category, venue: form.venue, city: form.city,
        startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(),
        capacity: Number(form.capacity), pricePaise: Math.round(Number(form.priceRupees) * 100), currency: 'INR',
        description: form.description, tags: form.tags.split(',').map((item) => item.trim()).filter(Boolean),
        agenda: form.agenda.split('\n').map((item) => item.trim()).filter(Boolean),
        status: form.status, coverPath: await uploadCover()
      };
      if (eventId) {
        const { organizationId: omittedOrganizationId, ...patch } = input;
        void omittedOrganizationId;
        await apiClient.updateEvent(eventId, patch);
      } else {
        const result = await apiClient.createEvent(input);
        setEventId(result.event.id);
      }
      setCover(null); setMessage('Event saved. You can now generate an AI operating brief.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Event could not be saved.'); }
    finally { setLoading(false); }
  }

  async function generateBrief(): Promise<void> {
    if (!eventId) { setMessage('Save the event before generating a brief.'); return; }
    setLoading(true); setMessage('');
    try {
      const queued = await apiClient.createAiBrief(eventId, aiInput.audience, aiInput.goal);
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const job = await apiClient.aiJob(queued.jobId);
        if (job.status === 'succeeded' && job.result) { setBrief(job.result); setMessage('AI brief generated and saved.'); return; }
        if (job.status === 'failed') throw new Error(job.error ?? 'AI generation failed.');
      }
      throw new Error('AI generation is still running. Return to the event later to see the result.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'AI generation failed.'); }
    finally { setLoading(false); }
  }

  if (!validOrganization) return <main className="container section"><div className="error-box">Choose a valid workspace from the dashboard.</div></main>;
  return <main className="container section page-stack">
    <div className="dashboard-head"><div className="section-head compact"><span>Organizer studio</span><h1>Build an event people remember.</h1></div><button className="ghost-btn" onClick={() => navigate('/dashboard')}>Back to workspace</button></div>
    {message && <div className={message.includes('failed') || message.includes('could not') ? 'error-box' : 'notice-box'}>{message}</div>}
    <div className="creator-grid">
      <form className="form-card large" onSubmit={(event) => void save(event)}>
        <div className="two-col"><label>Event title<input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} required minLength={4}/></label><label>Category<input value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} required/></label></div>
        <div className="two-col"><label>Venue<input value={form.venue} onChange={(e)=>setForm({...form,venue:e.target.value})} required/></label><label>City<input value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})} required/></label></div>
        <div className="two-col"><label>Starts<input type="datetime-local" value={form.startsAt} onChange={(e)=>setForm({...form,startsAt:e.target.value})} required/></label><label>Ends<input type="datetime-local" value={form.endsAt} onChange={(e)=>setForm({...form,endsAt:e.target.value})} required/></label></div>
        <div className="three-col"><label>Capacity<input type="number" min="1" value={form.capacity} onChange={(e)=>setForm({...form,capacity:Number(e.target.value)})}/></label><label>Price (₹)<input type="number" min="0" step="1" value={form.priceRupees} onChange={(e)=>setForm({...form,priceRupees:Number(e.target.value)})}/></label><label>Status<select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value as 'draft'|'published'})}><option value="draft">Draft</option><option value="published">Published</option></select></label></div>
        <label>Description<textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} required minLength={20}/></label>
        <label>Tags, comma separated<input value={form.tags} onChange={(e)=>setForm({...form,tags:e.target.value})}/></label>
        <label>Agenda, one item per line<textarea value={form.agenda} onChange={(e)=>setForm({...form,agenda:e.target.value})}/></label>
        <label className="file-input"><ImagePlus/>Cover image (JPEG, PNG, or WebP; max 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>setCover(e.target.files?.[0]??null)}/><span>{cover?.name ?? 'Choose a real event image'}</span></label>
        <button className="primary-btn" disabled={loading}><Save/>Save event</button>
      </form>
      <aside className="surface-panel ai-panel"><h2><Bot/>AI operating brief</h2><p>Uses an asynchronous Gemini job with structured validation and a daily quota.</p>
        <label>Target audience<textarea value={aiInput.audience} onChange={(e)=>setAiInput({...aiInput,audience:e.target.value})}/></label>
        <label>Primary outcome<textarea value={aiInput.goal} onChange={(e)=>setAiInput({...aiInput,goal:e.target.value})}/></label>
        <button className="secondary-btn full" disabled={loading || !eventId} onClick={() => void generateBrief()}>Generate with Gemini</button>
        {brief && <div className="brief-output"><h3>Strategy</h3><p>{brief.summary}</p><h3>Agenda</h3><ul>{brief.agenda.map((item)=><li key={item}>{item}</li>)}</ul><h3>Risks</h3><ul>{brief.risks.map((item)=><li key={item}>{item}</li>)}</ul><h3>Promotion copy</h3><p>{brief.promotionCopy}</p></div>}
      </aside>
    </div>
  </main>;
}
