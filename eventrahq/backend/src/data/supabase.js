import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env, assertSupabaseConfig } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

assertSupabaseConfig();

export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

export function publicUser(user) {
  if (!user) return null;
  const { password_hash, passwordHash, ...safe } = user;
  return {
    ...safe,
    createdAt: safe.created_at || safe.createdAt
  };
}

export function mapEvent(row) {
  const registrations = row.registrations || [];
  const registeredCount = registrations.length;
  const checkInCount = registrations.filter((item) => item.checked_in).length;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    status: row.status,
    location: row.location,
    city: row.city,
    date: row.event_date,
    time: row.event_time?.slice(0, 5),
    capacity: row.capacity,
    price: Number(row.price || 0),
    cover: row.cover,
    organizerId: row.organizer_id,
    description: row.description,
    tags: row.tags || [],
    agenda: row.agenda || [],
    createdAt: row.created_at,
    registeredCount,
    checkInCount,
    seatsLeft: Math.max(Number(row.capacity || 0) - registeredCount, 0)
  };
}

export async function requireRow(query, notFoundMessage = 'Resource not found.') {
  const { data, error } = await query.single();
  if (error) throw new HttpError(error.code === 'PGRST116' ? 404 : 500, error.code === 'PGRST116' ? notFoundMessage : error.message);
  return data;
}

export async function insertAudit(actorId, action, payload = {}) {
  await supabase.from('audit_logs').insert({
    id: `log_${randomUUID()}`, 
    actor_id: actorId || 'system',
    action,
    payload
  });
}
