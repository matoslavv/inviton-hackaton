import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Events ──────────────────────────────────────────────────────────────────
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: timestamp("date").notNull(),
  endDate: timestamp("end_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const eventsRelations = relations(events, ({ many }) => ({
  ticketTypes: many(ticketTypes),
  automations: many(automations),
  orders: many(orders),
}));

// ── Ticket Types ────────────────────────────────────────────────────────────
export const ticketTypes = pgTable("ticket_types", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id),
  name: text("name").notNull(),
});

export const ticketTypesRelations = relations(ticketTypes, ({ one, many }) => ({
  event: one(events, {
    fields: [ticketTypes.eventId],
    references: [events.id],
  }),
  automations: many(automations),
  orders: many(orders),
}));

// ── Email Templates ─────────────────────────────────────────────────────────
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
});

export const emailTemplatesRelations = relations(
  emailTemplates,
  ({ many }) => ({
    automations: many(automations),
  })
);

// ── Automations ─────────────────────────────────────────────────────────────
export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(), // 'after_purchase' | 'before_event' | 'after_event' | 'reminder'
  daysOffset: integer("days_offset"),
  templateId: integer("template_id")
    .notNull()
    .references(() => emailTemplates.id),
  ticketTypeId: integer("ticket_type_id").references(() => ticketTypes.id),
  pdfPath: text("pdf_path"),
  active: boolean("active").default(false).notNull(),
  sentCount: integer("sent_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const automationsRelations = relations(automations, ({ one }) => ({
  event: one(events, {
    fields: [automations.eventId],
    references: [events.id],
  }),
  template: one(emailTemplates, {
    fields: [automations.templateId],
    references: [emailTemplates.id],
  }),
  ticketType: one(ticketTypes, {
    fields: [automations.ticketTypeId],
    references: [ticketTypes.id],
  }),
}));

// ── Orders ──────────────────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id),
  ticketTypeId: integer("ticket_type_id")
    .notNull()
    .references(() => ticketTypes.id),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  purchaseDate: timestamp("purchase_date").defaultNow().notNull(),
});

export const ordersRelations = relations(orders, ({ one }) => ({
  event: one(events, {
    fields: [orders.eventId],
    references: [events.id],
  }),
  ticketType: one(ticketTypes, {
    fields: [orders.ticketTypeId],
    references: [ticketTypes.id],
  }),
}));
