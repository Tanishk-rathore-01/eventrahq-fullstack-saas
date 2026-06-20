import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, MapPin, Users } from 'lucide-react';

export default function EventCard({ event, onRegister }) {
  return (
    <article className={`event-card cover-${event.cover || 'aurora'}`}>
      <div className="event-card-glow" />
      <div className="event-topline">
        <span>{event.category}</span>
        <strong>{event.price ? `₹${event.price}` : 'Free'}</strong>
      </div>
      <h3>{event.title}</h3>
      <p>{event.description}</p>
      <div className="event-meta">
        <span><Calendar size={15} /> {event.date} · {event.time}</span>
        <span><MapPin size={15} /> {event.city}</span>
        <span><Users size={15} /> {event.seatsLeft} seats left</span>
      </div>
      <div className="tag-row">
        {(event.tags || []).slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}
      </div>
      <div className="card-actions">
        {onRegister && <button className="primary-btn" onClick={() => onRegister(event.id)}>Reserve Seat</button>}
        <Link to="/events" className="text-link">Explore <ArrowRight size={15} /></Link>
      </div>
    </article>
  );
}
