import { fetchJson } from './api.ts';
import type { Event } from '../types/index.ts';

export function getEvents(): Promise<Event[]> {
  return fetchJson<Event[]>('/events');
}

export function getEvent(id: number): Promise<Event> {
  return fetchJson<Event>(`/events/${id}`);
}
