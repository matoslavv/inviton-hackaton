import { Request, Response, NextFunction } from "express";
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
