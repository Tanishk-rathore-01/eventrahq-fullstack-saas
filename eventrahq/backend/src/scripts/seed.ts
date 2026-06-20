import 'dotenv/config';
import { getAdminClient } from '../lib/database.js';
import { slugify } from '../lib/security.js';

const demoPassword = process.env.DEMO_PASSWORD;
if (!demoPassword || demoPassword.length < 12) {
  throw new Error('Set DEMO_PASSWORD to at least 12 characters before running the seed.');
}

const admin = getAdminClient();
const demoUsers = [
  { email: 'admin@eventrahq.demo', name: 'Platform Admin', platformRole: 'admin' },
  { email: 'organizer@eventrahq.demo', name: 'Demo Organizer', platformRole: 'user' },
  { email: 'staff@eventrahq.demo', name: 'Check-in Staff', platformRole: 'user' },
  { email: 'attendee@eventrahq.demo', name: 'Demo Attendee', platformRole: 'user' }
] as const;

const users: Record<string, string> = {};
for (const demo of demoUsers) {
  const created = await admin.auth.admin.createUser({
    email: demo.email, password: demoPassword, email_confirm: true, user_metadata: { name: demo.name }
  });
  let userId = created.data.user?.id;
  if (created.error?.message.includes('already been registered')) {
    const listed = await admin.auth.admin.listUsers();
    userId = listed.data.users.find((user) => user.email === demo.email)?.id;
  } else if (created.error) {
    throw created.error;
  }
  if (!userId) throw new Error(`Could not create ${demo.email}`);
  users[demo.email] = userId;
  await admin.from('profiles').update({ name: demo.name, platform_role: demo.platformRole }).eq('id', userId);
}

const organizerId = users['organizer@eventrahq.demo']!;
const organizationResult = await admin.from('organizations').upsert({
  name: 'Eventra Demo Studio', slug: slugify('Eventra Demo Studio'),
  description: 'Recruiter demo workspace for end-to-end event operations.', created_by: organizerId
}, { onConflict: 'slug' }).select('id').single();
if (organizationResult.error) throw organizationResult.error;
const organizationId = organizationResult.data.id as string;

await admin.from('organization_memberships').upsert([
  { organization_id: organizationId, user_id: organizerId, role: 'owner' },
  { organization_id: organizationId, user_id: users['staff@eventrahq.demo'], role: 'checkin_staff' }
], { onConflict: 'organization_id,user_id' });

const now = Date.now();
const events = [
  {
    organization_id: organizationId, title: 'AI Product Leaders Forum', slug: 'ai-product-leaders-forum',
    category: 'Technology', status: 'published', venue: 'India Habitat Centre', city: 'New Delhi',
    starts_at: new Date(now + 14 * 86400000).toISOString(), ends_at: new Date(now + 14 * 86400000 + 6 * 3600000).toISOString(),
    capacity: 240, price_paise: 79900, description: 'A premium gathering for product leaders building responsible, scalable AI products.',
    tags: ['AI', 'product', 'leadership'], agenda: ['Opening keynote', 'Applied AI roundtable', 'Operator workshops', 'Networking'],
    created_by: organizerId
  },
  {
    organization_id: organizationId, title: 'Design Systems Community Night', slug: 'design-systems-community-night',
    category: 'Design', status: 'published', venue: 'Bengaluru Design District', city: 'Bengaluru',
    starts_at: new Date(now + 21 * 86400000).toISOString(), ends_at: new Date(now + 21 * 86400000 + 4 * 3600000).toISOString(),
    capacity: 120, price_paise: 0, description: 'A hands-on community event about accessible systems, tokens, and resilient product interfaces.',
    tags: ['design systems', 'accessibility', 'community'], agenda: ['Lightning talks', 'Token workshop', 'Accessibility clinic'],
    created_by: organizerId
  }
];
const seeded = await admin.from('events').upsert(events, { onConflict: 'slug' });
if (seeded.error) throw seeded.error;

console.log('Seed complete. Demo emails use the password supplied through DEMO_PASSWORD.');
