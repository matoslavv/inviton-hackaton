import "dotenv/config";
import { db } from "./index";
import {
  events,
  ticketTypes,
  emailTemplates,
  orders,
  automations,
} from "./schema";

async function seed() {
  console.log("Seeding database...");

  // ── 1. Events ────────────────────────────────────────────────────────────
  const createdEvents = await db
    .insert(events)
    .values([
      {
        name: "Inviton Summit 2026",
        date: new Date("2026-06-15T09:00:00Z"),
        endDate: new Date("2026-06-16T18:00:00Z"),
      },
      {
        name: "Tech Conference Praha",
        date: new Date("2026-04-10T08:00:00Z"),
        endDate: new Date("2026-04-11T20:00:00Z"),
      },
      {
        name: "Startup Weekend Bratislava",
        date: new Date("2026-02-20T17:00:00Z"),
        endDate: new Date("2026-02-22T21:00:00Z"),
      },
      {
        name: "Music Festival Košice",
        date: new Date("2026-08-05T12:00:00Z"),
        endDate: new Date("2026-08-07T23:59:00Z"),
      },
      {
        name: "New Year Gala 2027",
        date: new Date("2026-12-31T20:00:00Z"),
        endDate: new Date("2027-01-01T04:00:00Z"),
      },
    ])
    .returning();

  const [summit, techConf, startupWknd, musicFest, nyGala] = createdEvents;
  console.log(
    `Created ${createdEvents.length} events: ${createdEvents.map((e) => e.name).join(", ")}`
  );

  // ── 2. Ticket Types ─────────────────────────────────────────────────────
  const createdTicketTypes = await db
    .insert(ticketTypes)
    .values([
      // Inviton Summit — 3 types
      { eventId: summit.id, name: "Standard" },
      { eventId: summit.id, name: "VIP" },
      { eventId: summit.id, name: "Premium" },
      // Tech Conference Praha — 3 types
      { eventId: techConf.id, name: "Early Bird" },
      { eventId: techConf.id, name: "Standard" },
      { eventId: techConf.id, name: "VIP" },
      // Startup Weekend Bratislava — 2 types
      { eventId: startupWknd.id, name: "Participant" },
      { eventId: startupWknd.id, name: "Mentor" },
      // Music Festival Košice — 4 types
      { eventId: musicFest.id, name: "1-Day Pass" },
      { eventId: musicFest.id, name: "3-Day Pass" },
      { eventId: musicFest.id, name: "VIP" },
      { eventId: musicFest.id, name: "Backstage" },
      // New Year Gala — 2 types
      { eventId: nyGala.id, name: "Standard" },
      { eventId: nyGala.id, name: "VIP Table" },
    ])
    .returning();

  console.log(
    `Created ${createdTicketTypes.length} ticket types`
  );

  // Helper to find a ticket type by event id + name
  const tt = (eventId: number, name: string) => {
    const found = createdTicketTypes.find(
      (t) => t.eventId === eventId && t.name === name
    );
    if (!found) throw new Error(`Ticket type "${name}" for event ${eventId} not found`);
    return found;
  };

  // ── 3. Email Templates ──────────────────────────────────────────────────
  const createdTemplates = await db
    .insert(emailTemplates)
    .values([
      {
        name: "Welcome",
        subject: "Welcome to {{eventName}}!",
        body: "Hi {{customerName}},\n\nThank you for purchasing your {{ticketType}} ticket for {{eventName}}.\n\nWe look forward to seeing you!",
      },
      {
        name: "Event Reminder",
        subject: "Reminder: {{eventName}} is coming up!",
        body: "Hi {{customerName}},\n\n{{eventName}} starts on {{eventDate}}. Don't forget to attend!\n\nSee you there!",
      },
      {
        name: "Thank You",
        subject: "Thank you for attending {{eventName}}!",
        body: "Hi {{customerName}},\n\nThank you for attending {{eventName}}. We hope you had a great time!\n\nSee you at our next event.",
      },
      {
        name: "VIP Welcome",
        subject: "Exclusive VIP Access — {{eventName}}",
        body: "Hi {{customerName}},\n\nWelcome to the VIP experience at {{eventName}}! As a VIP guest you get priority seating, backstage access, and a complimentary welcome drink.\n\nPlease arrive 30 minutes early to collect your VIP badge.\n\nSee you soon!",
      },
      {
        name: "Last Minute Reminder",
        subject: "Tomorrow: {{eventName}} — don't forget!",
        body: "Hi {{customerName}},\n\n{{eventName}} is TOMORROW! Here's a quick checklist:\n\n- Bring your ticket (digital or printed)\n- Check the venue address: {{venueAddress}}\n- Doors open at {{doorsOpen}}\n\nWe can't wait to see you there!",
      },
    ])
    .returning();

  const tmpl = (name: string) => {
    const found = createdTemplates.find((t) => t.name === name);
    if (!found) throw new Error(`Template "${name}" not found`);
    return found;
  };

  console.log(
    `Created ${createdTemplates.length} templates: ${createdTemplates.map((t) => t.name).join(", ")}`
  );

  // ── 4. Orders ───────────────────────────────────────────────────────────
  const createdOrders = await db
    .insert(orders)
    .values([
      // Inviton Summit (4 orders)
      {
        eventId: summit.id,
        ticketTypeId: tt(summit.id, "Standard").id,
        customerEmail: "alice@example.com",
        customerName: "Alice Johnson",
        purchaseDate: new Date("2026-03-01T10:15:00Z"),
      },
      {
        eventId: summit.id,
        ticketTypeId: tt(summit.id, "VIP").id,
        customerEmail: "bob@example.com",
        customerName: "Bob Smith",
        purchaseDate: new Date("2026-03-05T14:30:00Z"),
      },
      {
        eventId: summit.id,
        ticketTypeId: tt(summit.id, "Premium").id,
        customerEmail: "carol@example.com",
        customerName: "Carol Williams",
        purchaseDate: new Date("2026-04-12T09:00:00Z"),
      },
      {
        eventId: summit.id,
        ticketTypeId: tt(summit.id, "VIP").id,
        customerEmail: "daniel@techcorp.io",
        customerName: "Daniel Novák",
        purchaseDate: new Date("2026-05-20T16:45:00Z"),
      },
      // Tech Conference Praha (3 orders)
      {
        eventId: techConf.id,
        ticketTypeId: tt(techConf.id, "Early Bird").id,
        customerEmail: "eva@startup.sk",
        customerName: "Eva Kováčová",
        purchaseDate: new Date("2026-01-15T08:00:00Z"),
      },
      {
        eventId: techConf.id,
        ticketTypeId: tt(techConf.id, "Standard").id,
        customerEmail: "frank@gmail.com",
        customerName: "František Dvořák",
        purchaseDate: new Date("2026-02-28T11:20:00Z"),
      },
      {
        eventId: techConf.id,
        ticketTypeId: tt(techConf.id, "VIP").id,
        customerEmail: "greta@company.cz",
        customerName: "Greta Horáková",
        purchaseDate: new Date("2026-03-25T13:10:00Z"),
      },
      // Startup Weekend Bratislava (3 orders — past event)
      {
        eventId: startupWknd.id,
        ticketTypeId: tt(startupWknd.id, "Participant").id,
        customerEmail: "hana@university.sk",
        customerName: "Hana Šimková",
        purchaseDate: new Date("2026-01-10T09:30:00Z"),
      },
      {
        eventId: startupWknd.id,
        ticketTypeId: tt(startupWknd.id, "Participant").id,
        customerEmail: "ivan@devhouse.io",
        customerName: "Ivan Procházka",
        purchaseDate: new Date("2026-01-22T17:00:00Z"),
      },
      {
        eventId: startupWknd.id,
        ticketTypeId: tt(startupWknd.id, "Mentor").id,
        customerEmail: "jana@vc-fund.com",
        customerName: "Jana Benešová",
        purchaseDate: new Date("2026-02-01T10:00:00Z"),
      },
      // Music Festival Košice (2 orders)
      {
        eventId: musicFest.id,
        ticketTypeId: tt(musicFest.id, "3-Day Pass").id,
        customerEmail: "karol@mail.sk",
        customerName: "Karol Tóth",
        purchaseDate: new Date("2026-04-01T20:00:00Z"),
      },
      {
        eventId: musicFest.id,
        ticketTypeId: tt(musicFest.id, "VIP").id,
        customerEmail: "lucia@musiclabel.com",
        customerName: "Lucia Molnárová",
        purchaseDate: new Date("2026-05-15T12:30:00Z"),
      },
      // New Year Gala (2 orders)
      {
        eventId: nyGala.id,
        ticketTypeId: tt(nyGala.id, "VIP Table").id,
        customerEmail: "martin@corp.sk",
        customerName: "Martin Krajčír",
        purchaseDate: new Date("2026-10-01T08:00:00Z"),
      },
      {
        eventId: nyGala.id,
        ticketTypeId: tt(nyGala.id, "Standard").id,
        customerEmail: "natalia@email.com",
        customerName: "Natália Ondrejková",
        purchaseDate: new Date("2026-11-15T19:45:00Z"),
      },
    ])
    .returning();

  console.log(`Created ${createdOrders.length} orders`);

  // ── 5. Automations ──────────────────────────────────────────────────────
  const createdAutomations = await db
    .insert(automations)
    .values([
      {
        eventId: summit.id,
        name: "Welcome Email",
        triggerType: "after_purchase",
        daysOffset: 0,
        templateId: tmpl("Welcome").id,
        ticketTypeId: null, // all ticket types
        active: true,
        sentCount: 4,
      },
      {
        eventId: summit.id,
        name: "VIP Pre-Event Package",
        triggerType: "before_event",
        daysOffset: 3,
        templateId: tmpl("VIP Welcome").id,
        ticketTypeId: tt(summit.id, "VIP").id, // VIP only
        active: true,
        sentCount: 0,
      },
      {
        eventId: startupWknd.id,
        name: "Post-Event Survey",
        triggerType: "after_event",
        daysOffset: 1,
        templateId: tmpl("Thank You").id,
        ticketTypeId: null, // all ticket types
        active: true,
        sentCount: 3,
      },
      {
        eventId: techConf.id,
        name: "Last Minute Reminder",
        triggerType: "before_event",
        daysOffset: 1,
        templateId: tmpl("Last Minute Reminder").id,
        ticketTypeId: null, // all ticket types
        active: false,
        sentCount: 0,
      },
    ])
    .returning();

  console.log(
    `Created ${createdAutomations.length} automations: ${createdAutomations.map((a) => a.name).join(", ")}`
  );

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
