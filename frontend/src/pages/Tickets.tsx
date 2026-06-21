import type { Ticket } from '@eventrahq/contracts';
import { Calendar, MapPin, QrCode } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void apiClient.tickets().then((data)=>setTickets(data.tickets)).catch((e:Error)=>setError(e.message)); }, []);
  return <main className="container section page-stack">
    <div className="section-head"><span>Ticket wallet</span><h1>Your verified passes.</h1><p>Each QR is signed and validated against the registration before check-in.</p></div>
    {error&&<div className="error-box">{error}</div>}
    <div className="ticket-grid">{tickets.map((ticket)=><article className="ticket-card" key={ticket.id}>
      <div className="ticket-info"><span className="eyebrow">{ticket.status}</span><h2>{ticket.eventTitle}</h2><p><Calendar/>{new Date(ticket.startsAt).toLocaleString()}</p><p><MapPin/>{ticket.venue}, {ticket.city}</p>
      <span className={ticket.checkedInAt?'status good':'status'}>{ticket.checkedInAt?'Checked in':'Ready to scan'}</span></div>
      <div className="qr-panel">{ticket.qrDataUrl?<img src={ticket.qrDataUrl} alt={`QR ticket for ${ticket.eventTitle}`}/>:<QrCode/>}<small>Do not share this code publicly.</small></div>
    </article>)}</div>
    {!tickets.length&&!error&&<div className="empty-state"><QrCode/><h2>No tickets yet</h2><p>Reserve a published event to receive a verified pass.</p></div>}
  </main>;
}
