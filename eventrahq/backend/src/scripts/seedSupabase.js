import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { supabase } from '../data/supabase.js';

const now = new Date().toISOString();

const users = [
  { id: 'usr_admin', name: 'Admin Operator', email: 'admin@eventrahq.com', role: 'admin', password: 'Admin@12345' },
  { id: 'usr_organizer', name: 'Organizer Demo', email: 'organizer@eventrahq.com', role: 'organizer', password: 'Organizer@12345' },
  { id: 'usr_user', name: 'Demo Attendee', email: 'user@eventrahq.com', role: 'user', password: 'User@12345' }
];

const userRows = await Promise.all(users.map(async (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  password_hash: await bcrypt.hash(user.password, 10),
  created_at: now
})));

const events = [
  {
    id: 'evt_future_summit_2030',
    title: 'Future Founders Summit 2030',
    slug: 'future-founders-summit-2030',
    category: 'Startup',
    status: 'published',
    location: 'Delhi Innovation Center',
    city: 'Delhi NCR',
    event_date: '2030-03-18',
    event_time: '10:00',
    capacity: 600,
    price: 999,
    cover: 'aurora',
    organizer_id: 'usr_organizer',
    description: 'A premium startup conference for founders, investors, product builders, and students building future-ready companies.',
    tags: ['startup', 'networking', 'founders', 'AI', 'product'],
    agenda: ['AI-native startups and product strategy', 'Fundraising readiness workshop', 'Live pitch evaluation', 'Founder networking roundtable'],
    created_at: now
  },
  {
    id: 'evt_design_intelligence',
    title: 'Design Intelligence Expo',
    slug: 'design-intelligence-expo',
    category: 'Design',
    status: 'published',
    location: 'Mumbai Creative Lab',
    city: 'Mumbai',
    event_date: '2029-11-07',
    event_time: '14:30',
    capacity: 350,
    price: 499,
    cover: 'prism',
    organizer_id: 'usr_organizer',
    description: 'A high-end creative technology expo focused on 2026+ UI/UX systems, motion design, interactive interfaces, and AI-assisted brand workflows.',
    tags: ['design', 'uiux', 'creative-tech', 'portfolio'],
    agenda: ['Design systems', 'Motion-first UI', 'Creative AI workflows', 'Portfolio critique'],
    created_at: now
  },
  {
    id: 'evt_cloud_ops_night',
    title: 'CloudOps Night Run',
    slug: 'cloudops-night-run',
    category: 'Technology',
    status: 'published',
    location: 'Bangalore Tech Park',
    city: 'Bangalore',
    event_date: '2028-08-22',
    event_time: '18:00',
    capacity: 220,
    price: 0,
    cover: 'matrix',
    organizer_id: 'usr_admin',
    description: 'An invite-style engineering event about scalable backend systems, distributed queues, observability, and production reliability.',
    tags: ['backend', 'cloud', 'reliability', 'devops'],
    agenda: ['Scaling Node.js APIs', 'Queue architecture', 'Incident drills', 'Observability patterns'],
    created_at: now
  }
];

const registrations = [
  { id: `reg_${nanoid(12)}`, event_id: 'evt_future_summit_2030', user_id: 'usr_user', checked_in: false },
  { id: `reg_${nanoid(12)}`, event_id: 'evt_cloud_ops_night', user_id: 'usr_user', checked_in: true, checked_in_at: now }
];

async function upsert(table, rows, conflict = 'id') {
  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict });
  if (error) throw error;
}

await upsert('app_users', userRows);
await upsert('events', events);
await upsert('registrations', registrations, 'event_id,user_id');
await supabase.from('audit_logs').insert({
  id: `log_${nanoid(12)}`,
  actor_id: 'system',
  action: 'seed.completed',
  payload: { users: users.length, events: events.length },
  created_at: now
});

console.log('Supabase seed completed. Demo accounts:');
console.log('admin@eventrahq.com / Admin@12345');
console.log('organizer@eventrahq.com / Organizer@12345');
console.log('user@eventrahq.com / User@12345');
