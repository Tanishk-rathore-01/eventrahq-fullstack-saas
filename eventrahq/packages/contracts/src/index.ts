import { z } from 'zod';

export const platformRoleSchema = z.enum(['user', 'admin']);
export const membershipRoleSchema = z.enum(['owner', 'manager', 'checkin_staff']);
export const eventStatusSchema = z.enum(['draft', 'published', 'cancelled', 'completed']);
export const registrationStatusSchema = z.enum(['pending', 'confirmed', 'cancelled', 'refunded']);
export const jobStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);

export type PlatformRole = z.infer<typeof platformRoleSchema>;
export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type RegistrationStatus = z.infer<typeof registrationStatusSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const profileSchema = z.object({
  id: z.uuid(), name: z.string().min(2).max(80), email: z.email(),
  platformRole: platformRoleSchema, avatarUrl: z.url().nullable(), createdAt: z.string()
});

export const organizationSchema = z.object({
  id: z.uuid(), name: z.string().min(2).max(100), slug: z.string().min(2).max(80),
  description: z.string().max(500).nullable(), createdAt: z.string()
});

export const membershipSchema = z.object({
  organizationId: z.uuid(), organizationName: z.string(), organizationSlug: z.string(), role: membershipRoleSchema
});

export const meResponseSchema = z.object({ profile: profileSchema, memberships: z.array(membershipSchema) });
export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).optional().default('')
});
export const inviteMemberSchema = z.object({ email: z.email(), role: membershipRoleSchema });

const eventFieldsSchema = z.object({
  organizationId: z.uuid(),
  title: z.string().trim().min(4).max(120),
  category: z.string().trim().min(2).max(60),
  status: eventStatusSchema.default('draft'),
  venue: z.string().trim().min(2).max(140),
  city: z.string().trim().min(2).max(80),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  capacity: z.number().int().min(1).max(100_000),
  pricePaise: z.number().int().min(0).max(100_000_000),
  currency: z.literal('INR').default('INR'),
  description: z.string().trim().min(20).max(3000),
  tags: z.array(z.string().trim().min(1).max(24)).max(10),
  agenda: z.array(z.string().trim().min(2).max(160)).max(20),
  coverPath: z.string().max(500).nullable().default(null)
});

export const eventInputSchema = eventFieldsSchema.refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
  message: 'Event end time must be after its start time.', path: ['endsAt']
});

export const eventPatchSchema = eventFieldsSchema.partial().omit({ organizationId: true });
export const eventSchema = eventFieldsSchema.extend({
  id: z.uuid(), slug: z.string(), coverUrl: z.url().nullable(),
  registeredCount: z.number().int().nonnegative(), checkedInCount: z.number().int().nonnegative(),
  seatsLeft: z.number().int().nonnegative(), createdAt: z.string(), updatedAt: z.string()
});
export const eventListResponseSchema = z.object({ events: z.array(eventSchema), nextCursor: z.string().nullable() });

export const checkoutResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('free'), registrationId: z.uuid(), ticketId: z.uuid() }),
  z.object({
    kind: z.literal('razorpay'), registrationId: z.uuid(), orderId: z.string(), amount: z.number().int().positive(),
    currency: z.literal('INR'), keyId: z.string(), expiresAt: z.string()
  })
]);

export const paymentVerificationSchema = z.object({
  razorpayOrderId: z.string().min(1), razorpayPaymentId: z.string().min(1), razorpaySignature: z.string().min(1)
});

export const aiBriefRequestSchema = z.object({
  eventId: z.uuid(), audience: z.string().trim().min(10).max(500), goal: z.string().trim().min(10).max(800)
});
export const aiBriefSchema = z.object({
  summary: z.string().min(20), agenda: z.array(z.string()).min(3).max(8), risks: z.array(z.string()).min(3).max(6),
  marketingAngles: z.array(z.string()).min(3).max(6), staffingPlan: z.array(z.string()).min(3).max(8),
  promotionCopy: z.string().min(20).max(1200)
});
export const aiJobSchema = z.object({
  id: z.uuid(), status: jobStatusSchema, result: aiBriefSchema.nullable(), error: z.string().nullable(),
  attempts: z.number().int().nonnegative(), createdAt: z.string(), completedAt: z.string().nullable()
});

export const checkInSchema = z.object({ token: z.string().min(20).max(200) });
export const ticketSchema = z.object({
  id: z.uuid(), registrationId: z.uuid(), eventId: z.uuid(), eventTitle: z.string(), startsAt: z.string(),
  venue: z.string(), city: z.string(), status: registrationStatusSchema, checkedInAt: z.string().nullable(),
  qrDataUrl: z.string().nullable()
});
export const errorResponseSchema = z.object({
  status: z.literal('error'), code: z.string(), message: z.string(), requestId: z.string().optional(),
  details: z.unknown().optional()
});

export type Profile = z.infer<typeof profileSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export type EventPatch = z.infer<typeof eventPatchSchema>;
export type EventRecord = z.infer<typeof eventSchema>;
export type EventListResponse = z.infer<typeof eventListResponseSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
export type AiBrief = z.infer<typeof aiBriefSchema>;
export type AiJob = z.infer<typeof aiJobSchema>;
export type Ticket = z.infer<typeof ticketSchema>;
