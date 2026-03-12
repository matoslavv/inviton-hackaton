import { fetchJson } from './api.ts';
import type { EmailTemplate } from '../types/index.ts';

export function getTemplates(): Promise<EmailTemplate[]> {
  return fetchJson<EmailTemplate[]>('/templates');
}

export function getTemplate(id: number): Promise<EmailTemplate> {
  return fetchJson<EmailTemplate>(`/templates/${id}`);
}

export function createTemplate(data: Omit<EmailTemplate, 'id'>): Promise<EmailTemplate> {
  return fetchJson<EmailTemplate>('/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTemplate(id: number, data: Omit<EmailTemplate, 'id'>): Promise<EmailTemplate> {
  return fetchJson<EmailTemplate>(`/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteTemplate(id: number): Promise<void> {
  return fetchJson<void>(`/templates/${id}`, {
    method: 'DELETE',
  });
}
