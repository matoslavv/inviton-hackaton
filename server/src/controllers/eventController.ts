import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { events } from "../db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "../middleware/errorHandler";

export const getEvents = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const allEvents = await db.select().from(events);
    res.json(allEvents);
  } catch (err) {
    next(err);
  }
};

export const getEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const [event] = await db.select().from(events).where(eq(events.id, id));
    if (!event) {
      throw new AppError(404, "Event not found");
    }
    res.json(event);
  } catch (err) {
    next(err);
  }
};

export const createEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, date, endDate } = req.body;
    if (!name || !date || !endDate) {
      throw new AppError(400, "name, date, and endDate are required");
    }
    const [event] = await db
      .insert(events)
      .values({ name, date: new Date(date), endDate: new Date(endDate) })
      .returning();
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
};
