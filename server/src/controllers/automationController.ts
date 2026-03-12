import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { automations } from "../db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "../middleware/errorHandler";

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
    const result = await db
      .select()
      .from(automations)
      .where(eq(automations.eventId, eventId));
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

    console.log("=== TEST EMAIL ===");
    console.log(`To: ${email}`);
    console.log(`Automation: ${automation.name} (ID: ${automation.id})`);
    console.log(`Trigger: ${automation.triggerType}`);
    console.log(`Template ID: ${automation.templateId}`);
    if (automation.pdfPath) {
      console.log(`PDF Attachment: ${automation.pdfPath}`);
    }
    console.log("==================");

    res.json({ message: `Test email logged for ${email}` });
  } catch (err) {
    next(err);
  }
};
