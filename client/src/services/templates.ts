import { fetchJson } from './api.ts';
import type { EmailTemplate } from '../types/index.ts';

export function getTemplates(): Promise<EmailTemplate[]> {
  return fetchJson<EmailTemplate[]>('/templates');
}
