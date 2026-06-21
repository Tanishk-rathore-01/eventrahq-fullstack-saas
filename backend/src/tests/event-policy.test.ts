import { describe, expect, it } from 'vitest';
import { canTransitionEvent, eventMutationConflict } from '../lib/event-policy.js';

describe('event lifecycle policy', () => {
  it('allows forward operational transitions', () => {
    expect(canTransitionEvent('draft', 'published')).toBe(true);
    expect(canTransitionEvent('published', 'completed')).toBe(true);
    expect(canTransitionEvent('published', 'cancelled')).toBe(true);
  });

  it('keeps terminal event states terminal', () => {
    expect(canTransitionEvent('cancelled', 'published')).toBe(false);
    expect(canTransitionEvent('completed', 'published')).toBe(false);
  });

  it('prevents capacity and price changes that invalidate active registrations', () => {
    expect(eventMutationConflict({ currentPricePaise: 5000, nextCapacity: 9, activeRegistrations: 10 })?.code)
      .toBe('capacity_below_registrations');
    expect(eventMutationConflict({ currentPricePaise: 5000, nextPricePaise: 6000, activeRegistrations: 1 })?.code)
      .toBe('price_locked');
    expect(eventMutationConflict({ currentPricePaise: 5000, nextPricePaise: 6000, activeRegistrations: 0 })).toBeNull();
  });
});
