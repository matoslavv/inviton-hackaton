export interface Event {
  id: number;
  name: string;
  date: string;
  endDate: string;
}

export interface TicketType {
  id: number;
  eventId: number;
  name: string;
}

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
}

export interface Automation {
  id: number;
  eventId: number;
  name: string;
  triggerType: 'after_purchase' | 'before_event' | 'after_event' | 'reminder';
  daysOffset: number | null;
  templateId: number;
  ticketTypeId: number | null;
  pdfPath: string | null;
  active: boolean;
  sentCount: number;
  template?: EmailTemplate;
  ticketType?: TicketType;
}
