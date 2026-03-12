import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { automations, automationLogs, emailTemplates, events, ticketTypes } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { AppError } from "../middleware/errorHandler";
import { sendEmail } from "../services/emailService";

function replaceVariables(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    text
  );
}

const VALID_TRIGGER_TYPES: string[] = [
  "after_purchase",
  "before_event",
  "after_event",
  "reminder",
];

export const getAutomations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = Number(req.params.eventId);
    const result = await db.query.automations.findMany({
      where: eq(automations.eventId, eventId),
      with: { template: true, ticketType: true },
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createAutomation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = Number(req.params.eventId);
    const { name, triggerType, daysOffset, templateId, ticketTypeId, pdfPath } =
      req.body;

    if (!name || !triggerType || !templateId) {
      throw new AppError(400, "name, triggerType, and templateId are required");
    }
    if (!VALID_TRIGGER_TYPES.includes(triggerType)) {
      throw new AppError(
        400,
        `triggerType must be one of: ${VALID_TRIGGER_TYPES.join(", ")}`
      );
    }

    const [automation] = await db
      .insert(automations)
      .values({
        eventId,
        name,
        triggerType,
        daysOffset: daysOffset ?? null,
        templateId,
        ticketTypeId: ticketTypeId ?? null,
        pdfPath: pdfPath ?? null,
      })
      .returning();
    await db.insert(automationLogs).values({
      automationId: automation.id,
      action: 'created',
      detail: `Created automation "${automation.name}"`,
    });
    res.status(201).json(automation);
  } catch (err) {
    next(err);
  }
};

export const updateAutomation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const { name, triggerType, daysOffset, templateId, ticketTypeId, pdfPath, active } =
      req.body;

    if (triggerType && !VALID_TRIGGER_TYPES.includes(triggerType)) {
      throw new AppError(
        400,
        `triggerType must be one of: ${VALID_TRIGGER_TYPES.join(", ")}`
      );
    }

    const values: Record<string, unknown> = {};
    if (name !== undefined) values.name = name;
    if (triggerType !== undefined) values.triggerType = triggerType;
    if (daysOffset !== undefined) values.daysOffset = daysOffset;
    if (templateId !== undefined) values.templateId = templateId;
    if (ticketTypeId !== undefined) values.ticketTypeId = ticketTypeId;
    if (pdfPath !== undefined) values.pdfPath = pdfPath;
    if (active !== undefined) values.active = active;

    const [updated] = await db
      .update(automations)
      .set(values)
      .where(eq(automations.id, id))
      .returning();

    if (!updated) {
      throw new AppError(404, "Automation not found");
    }
    await db.insert(automationLogs).values({
      automationId: updated.id,
      action: 'updated',
      detail: `Updated automation "${updated.name}"`,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

export const toggleAutomation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(automations)
      .where(eq(automations.id, id));
    if (!existing) {
      throw new AppError(404, "Automation not found");
    }

    const [updated] = await db
      .update(automations)
      .set({ active: !existing.active })
      .where(eq(automations.id, id))
      .returning();
    await db.insert(automationLogs).values({
      automationId: updated.id,
      action: 'toggled',
      detail: `Automation ${updated.active ? 'activated' : 'deactivated'}`,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

export const deleteAutomation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db
      .delete(automations)
      .where(eq(automations.id, id))
      .returning();
    if (!deleted) {
      throw new AppError(404, "Automation not found");
    }
    res.json({ message: "Automation deleted" });
    // Note: logs are cascade-deleted with the automation
  } catch (err) {
    next(err);
  }
};

export const testAutomation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const { email } = req.body;
    if (!email) {
      throw new AppError(400, "email is required");
    }

    const [automation] = await db
      .select()
      .from(automations)
      .where(eq(automations.id, id));
    if (!automation) {
      throw new AppError(404, "Automation not found");
    }

    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, automation.templateId));
    if (!template) {
      throw new AppError(404, "Email template not found");
    }

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, automation.eventId));
    if (!event) {
      throw new AppError(404, "Event not found");
    }

    let ticketTypeName = "General";
    if (automation.ticketTypeId) {
      const [ticketType] = await db
        .select()
        .from(ticketTypes)
        .where(eq(ticketTypes.id, automation.ticketTypeId));
      if (ticketType) {
        ticketTypeName = ticketType.name;
      }
    }

    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    const vars: Record<string, string> = {
      // snake_case
      event_name: event.name,
      customer_name: "Test User",
      customer_email: email,
      event_date: formatDate(new Date(event.date)),
      event_end_date: formatDate(new Date(event.endDate)),
      ticket_type: ticketTypeName,
      // camelCase aliases
      eventName: event.name,
      customerName: "Test User",
      customerEmail: email,
      eventDate: formatDate(new Date(event.date)),
      eventEndDate: formatDate(new Date(event.endDate)),
      ticketType: ticketTypeName,
    };

    const subject = replaceVariables(template.subject, vars);
    const body = replaceVariables(template.body, vars);

    await sendEmail({
      to: email,
      subject: `[TEST] ${subject}`,
      html: body,
      pdfPath: automation.pdfPath,
    });

    await db.insert(automationLogs).values({
      automationId: automation.id,
      action: 'test_sent',
      detail: `Test email sent to ${email}`,
    });
    res.json({ message: `Test email sent to ${email}` });
  } catch (err) {
    next(err);
  }
};

export const duplicateAutomation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(automations)
      .where(eq(automations.id, id));
    if (!existing) {
      throw new AppError(404, "Automation not found");
    }

    const [duplicate] = await db
      .insert(automations)
      .values({
        eventId: existing.eventId,
        name: `${existing.name} (copy)`,
        triggerType: existing.triggerType,
        daysOffset: existing.daysOffset,
        templateId: existing.templateId,
        ticketTypeId: existing.ticketTypeId,
        pdfPath: existing.pdfPath,
        active: false,
        sentCount: 0,
      })
      .returning();
    await db.insert(automationLogs).values({
      automationId: duplicate.id,
      action: 'duplicated',
      detail: `Duplicated from "${existing.name}" (id: ${existing.id})`,
    });
    res.status(201).json(duplicate);
  } catch (err) {
    next(err);
  }
};

export const getAutomationLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const logs = await db
      .select()
      .from(automationLogs)
      .where(eq(automationLogs.automationId, id))
      .orderBy(desc(automationLogs.createdAt))
      .limit(50);
    res.json(logs);
  } catch (err) {
    next(err);
  }
};
