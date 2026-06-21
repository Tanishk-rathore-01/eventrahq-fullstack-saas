import type { EventStatus } from '@eventrahq/contracts';

const transitions: Record<EventStatus, ReadonlySet<EventStatus>> = {
  draft: new Set(['published', 'cancelled']),
  published: new Set(['completed', 'cancelled']),
  cancelled: new Set(),
  completed: new Set()
};

export function canTransitionEvent(current: EventStatus, next: EventStatus): boolean {
  return current === next || transitions[current].has(next);
}

export function eventMutationConflict(input: {
  currentPricePaise: number;
  nextPricePaise?: number;
  nextCapacity?: number;
  activeRegistrations: number;
}): { code: string; message: string } | null {
  if (input.nextCapacity !== undefined && input.nextCapacity < input.activeRegistrations) {
    return {
      code: 'capacity_below_registrations',
      message: `Capacity cannot be lower than ${input.activeRegistrations} active registrations.`
    };
  }
  if (input.nextPricePaise !== undefined && input.nextPricePaise !== input.currentPricePaise && input.activeRegistrations > 0) {
    return { code: 'price_locked', message: 'Price cannot change after registration has started.' };
  }
  return null;
}
