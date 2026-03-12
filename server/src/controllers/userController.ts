import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "../db/schema";
import { AppError } from "../middleware/errorHandler";

export const getUsers = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const allUsers = await db.select().from(users);
    res.json(allUsers);
  } catch (err) {
    next(err);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      throw new AppError(400, "Name and email are required");
    }

    const [newUser] = await db.insert(users).values({ name, email }).returning();
    res.status(201).json(newUser);
  } catch (err) {
    next(err);
  }
};
