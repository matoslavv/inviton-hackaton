import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { ticketTypes } from "../db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "../middleware/errorHandler";

export const getTicketTypes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = Number(req.params.eventId);
    const types = await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, eventId));
    res.json(types);
  } catch (err) {
    next(err);
  }
};

export const createTicketType = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = Number(req.params.eventId);
    const { name } = req.body;
    if (!name) {
      throw new AppError(400, "name is required");
    }
    const [ticketType] = await db
      .insert(ticketTypes)
      .values({ eventId, name })
      .returning();
    res.status(201).json(ticketType);
  } catch (err) {
    next(err);
  }
};
