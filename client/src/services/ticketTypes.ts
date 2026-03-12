import { fetchJson } from './api.ts';
import type { TicketType } from '../types/index.ts';

export function getTicketTypes(eventId: number): Promise<TicketType[]> {
  return fetchJson<TicketType[]>(`/events/${eventId}/ticket-types`);
}
