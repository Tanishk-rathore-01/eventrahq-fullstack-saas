import type { EventRecord } from '@eventrahq/contracts';
import { env } from '../config/env.js';

type EventRow = Record<string, unknown> & { registrations?: Array<{ status: string; checked_in_at: string | null }> };

export function mapEvent(row: EventRow): EventRecord {
  const registrations = row.registrations ?? [];
  const confirmed = registrations.filter((item) => item.status === 'confirmed');
  const coverPath = row.cover_path ? String(row.cover_path) : null;
  const storage = env.supabaseUrl ? `${env.supabaseUrl}/storage/v1/object/public/event-covers/` : '';
  return {
    id: String(row.id), organizationId: String(row.organization_id), title: String(row.title), slug: String(row.slug),
    category: String(row.category), status: row.status as EventRecord['status'], venue: String(row.venue), city: String(row.city),
    startsAt: String(row.starts_at), endsAt: String(row.ends_at), capacity: Number(row.capacity),
    pricePaise: Number(row.price_paise), currency: 'INR', description: String(row.description),
    tags: (row.tags as string[] | null) ?? [], agenda: (row.agenda as string[] | null) ?? [], coverPath,
    coverUrl: coverPath ? `${storage}${coverPath}` : null,
    registeredCount: confirmed.length, checkedInCount: confirmed.filter((item) => item.checked_in_at).length,
    seatsLeft: Math.max(Number(row.capacity) - confirmed.length, 0),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at)
  };
}
