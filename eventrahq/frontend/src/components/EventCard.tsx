import type { EventRecord } from '@eventrahq/contracts';
import { ArrowRight, Calendar, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function EventCard({ event }: { event: EventRecord }) {
  return <article className="event-card">
    {event.coverUrl && <img className="event-cover" src={event.coverUrl} alt="" loading="lazy"/>}
    <div className="event-card-body">
      <div className="event-topline"><span>{event.category}</span><strong>{event.pricePaise ? money.format(event.pricePaise / 100) : 'Free'}</strong></div>
      <h3>{event.title}</h3><p>{event.description}</p>
      <div className="event-meta">
        <span><Calendar size={15}/>{new Date(event.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
        <span><MapPin size={15}/>{event.city}</span><span><Users size={15}/>{event.seatsLeft} seats left</span>
      </div>
      <div className="tag-row">{event.tags.slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}</div>
      <Link className="primary-btn" to={`/events/${event.slug}`}>View event <ArrowRight size={16}/></Link>
    </div>
  </article>;
}
