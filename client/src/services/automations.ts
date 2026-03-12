import { fetchJson } from './api.ts';
import type { Automation } from '../types/index.ts';

export function getAutomations(eventId: number): Promise<Automation[]> {
  return fetchJson<Automation[]>(`/events/${eventId}/automations`);
}

export function createAutomation(
  eventId: number,
  data: Partial<Automation>
): Promise<Automation> {
  return fetchJson<Automation>(`/events/${eventId}/automations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAutomation(
  id: number,
  data: Partial<Automation>
): Promise<Automation> {
  return fetchJson<Automation>(`/automations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function toggleAutomation(id: number): Promise<Automation> {
  return fetchJson<Automation>(`/automations/${id}/toggle`, {
    method: 'PATCH',
  });
}

export function deleteAutomation(id: number): Promise<void> {
  return fetchJson<void>(`/automations/${id}`, {
    method: 'DELETE',
  });
}

export function sendTestEmail(id: number, email: string): Promise<void> {
  return fetchJson<void>(`/automations/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function duplicateAutomation(id: number): Promise<Automation> {
  return fetchJson<Automation>(`/automations/${id}/duplicate`, { method: 'POST' });
}

export interface AutomationLog {
  id: number;
  automationId: number;
  action: string;
  detail: string | null;
  createdAt: string;
}

export function getAutomationLogs(automationId: number): Promise<AutomationLog[]> {
  return fetchJson<AutomationLog[]>(`/automations/${automationId}/logs`);
}
