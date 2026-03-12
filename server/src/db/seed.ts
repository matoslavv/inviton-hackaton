import "dotenv/config";
import { db } from "./index";
import { events, ticketTypes, emailTemplates, orders } from "./schema";

async function seed() {
  console.log("Seeding database...");

  // 1. Create event
  const [event] = await db
    .insert(events)
    .values({
      name: "Inviton Summit 2026",
      date: new Date("2026-06-15T09:00:00Z"),
      endDate: new Date("2026-06-16T18:00:00Z"),
    })
    .returning();
  console.log(`Created event: ${event.name} (ID: ${event.id})`);

  // 2. Create ticket types
  const ticketTypeNames = ["Standard", "VIP", "Premium"];
  const createdTicketTypes = await db
    .insert(ticketTypes)
    .values(ticketTypeNames.map((name) => ({ eventId: event.id, name })))
    .returning();
  console.log(
    `Created ticket types: ${createdTicketTypes.map((t) => t.name).join(", ")}`
  );

  // 3. Create email templates
  const templates = [
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
  ];
  const createdTemplates = await db
    .insert(emailTemplates)
    .values(templates)
    .returning();
  console.log(
    `Created templates: ${createdTemplates.map((t) => t.name).join(", ")}`
  );

  // 4. Create sample orders
  const sampleOrders = [
    {
      eventId: event.id,
      ticketTypeId: createdTicketTypes[0].id, // Standard
      customerEmail: "alice@example.com",
      customerName: "Alice Johnson",
    },
    {
      eventId: event.id,
      ticketTypeId: createdTicketTypes[1].id, // VIP
      customerEmail: "bob@example.com",
      customerName: "Bob Smith",
    },
  ];
  const createdOrders = await db.insert(orders).values(sampleOrders).returning();
  console.log(`Created ${createdOrders.length} sample orders`);

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
