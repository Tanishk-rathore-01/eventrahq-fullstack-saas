import { eventInputSchema } from '@eventrahq/contracts';
import { describe, expect, it } from 'vitest';

const validEvent = {
  organizationId: '6aa7dc17-7845-4e97-b7ae-661484dd9977',
  title: 'Production Event', category: 'Technology', status: 'published',
  venue: 'Convention Centre', city: 'New Delhi',
  startsAt: '2027-01-10T10:00:00.000Z', endsAt: '2027-01-10T14:00:00.000Z',
  capacity: 100, pricePaise: 50000, currency: 'INR',
  description: 'A sufficiently detailed event description for validation.',
  tags: ['AI'], agenda: ['Opening keynote'], coverPath: null
};

describe('event contract', () => {
  it('accepts a valid event', () => expect(eventInputSchema.parse(validEvent).capacity).toBe(100));
  it('rejects negative prices', () => expect(() => eventInputSchema.parse({ ...validEvent, pricePaise: -1 })).toThrow());
  it('rejects end times before start times', () => {
    expect(() => eventInputSchema.parse({ ...validEvent, endsAt: '2027-01-10T09:00:00.000Z' })).toThrow('end time');
  });
});
