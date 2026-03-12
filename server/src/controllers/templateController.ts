import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { emailTemplates } from "../db/schema";
import { AppError } from "../middleware/errorHandler";

export const getTemplates = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const templates = await db.select().from(emailTemplates);
    res.json(templates);
  } catch (err) {
    next(err);
  }
};

export const getTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, id));
    if (!template) {
      throw new AppError(404, "Template not found");
    }
    res.json(template);
  } catch (err) {
    next(err);
  }
};

export const createTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, subject, body } = req.body;
    if (!name || !subject || !body) {
      throw new AppError(400, "name, subject, and body are required");
    }
    const [template] = await db
      .insert(emailTemplates)
      .values({ name, subject, body })
      .returning();
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
};

export const updateTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const { name, subject, body } = req.body;
    if (!name || !subject || !body) {
      throw new AppError(400, "name, subject, and body are required");
    }
    const [updated] = await db
      .update(emailTemplates)
      .set({ name, subject, body })
      .where(eq(emailTemplates.id, id))
      .returning();
    if (!updated) {
      throw new AppError(404, "Template not found");
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

export const deleteTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db
      .delete(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .returning();
    if (!deleted) {
      throw new AppError(404, "Template not found");
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
