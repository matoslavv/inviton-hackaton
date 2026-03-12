import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";

export const uploadPdf = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.file) {
      throw new AppError(400, "No file uploaded");
    }
    res.status(201).json({
      message: "File uploaded successfully",
      path: req.file.path,
      filename: req.file.filename,
    });
  } catch (err) {
    next(err);
  }
};
