import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { orders } from "../db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "../middleware/errorHandler";

export const getOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = Number(req.params.eventId);
    const result = await db
      .select()
      .from(orders)
      .where(eq(orders.eventId, eventId));
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = Number(req.params.eventId);
    const { ticketTypeId, customerEmail, customerName } = req.body;
    if (!ticketTypeId || !customerEmail || !customerName) {
      throw new AppError(
        400,
        "ticketTypeId, customerEmail, and customerName are required"
      );
    }
    const [order] = await db
      .insert(orders)
      .values({ eventId, ticketTypeId, customerEmail, customerName })
      .returning();
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
};
