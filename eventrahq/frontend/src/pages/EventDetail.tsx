import type { EventRecord } from '@eventrahq/contracts';
import { Calendar, MapPin, ShieldCheck, TicketCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(); script.onerror = () => reject(new Error('Razorpay checkout could not load.'));
    document.head.appendChild(script);
  });
}

export default function EventDetail() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { session, me } = useAuth();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { void apiClient.event(eventId).then(({event}) => setEvent(event)).catch((e:Error) => setMessage(e.message)).finally(() => setLoading(false)); }, [eventId]);

  async function checkout(): Promise<void> {
    if (!session) { navigate('/auth'); return; }
    if (!event) return;
    setLoading(true); setMessage('');
    try {
      const result = await apiClient.checkout(event.id);
      if (result.kind === 'free') { navigate('/tickets'); return; }
      await loadRazorpay();
      new window.Razorpay({
        key: result.keyId, amount: result.amount, currency: result.currency, order_id: result.orderId,
        name: 'EventraHQ', description: event.title,
        prefill: { ...(me?.profile.name ? { name: me.profile.name } : {}), ...(me?.profile.email ? { email: me.profile.email } : {}) },
        theme: { color: '#8b5cf6' },
        handler: (payment) => void apiClient.verifyPayment({
          razorpayOrderId: payment.razorpay_order_id, razorpayPaymentId: payment.razorpay_payment_id,
          razorpaySignature: payment.razorpay_signature
        }).then(() => navigate('/tickets')).catch((e:Error) => setMessage(e.message)),
        modal: { ondismiss: () => setLoading(false) }
      }).open();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Checkout failed.'); setLoading(false); }
  }
  if (loading && !event) return <main className="screen-center">Loading event…</main>;
  if (!event) return <main className="container section"><div className="error-box">{message || 'Event not found.'}</div></main>;
  return <main className="container section detail-layout">
    <section className="detail-main">{event.coverUrl && <img className="detail-cover" src={event.coverUrl} alt=""/>}
      <div className="eyebrow">{event.category}</div><h1>{event.title}</h1><p className="lead">{event.description}</p>
      <div className="detail-facts"><span><Calendar/>{new Date(event.startsAt).toLocaleString()}</span><span><MapPin/>{event.venue}, {event.city}</span><span><Users/>{event.seatsLeft} seats remaining</span></div>
      <h2>Agenda</h2><ol className="agenda-list">{event.agenda.map((item) => <li key={item}>{item}</li>)}</ol>
    </section>
    <aside className="checkout-card"><TicketCheck/><h2>{event.pricePaise ? `₹${(event.pricePaise/100).toLocaleString('en-IN')}` : 'Free registration'}</h2>
      <p>Inventory is reserved atomically. Paid tickets are confirmed only after signature verification.</p>
      {message && <div className="error-box">{message}</div>}<button className="primary-btn full" disabled={loading || event.seatsLeft===0} onClick={() => void checkout()}>{loading?'Processing…':event.seatsLeft?'Reserve ticket':'Sold out'}</button>
      <span className="secure-note"><ShieldCheck/>Verified checkout and QR ticket</span>
    </aside>
  </main>;
}
