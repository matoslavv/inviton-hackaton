import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { AppError } from "../middleware/errorHandler";

import { getEvents, getEvent, createEvent } from "../controllers/eventController";
import { getTicketTypes, createTicketType } from "../controllers/ticketTypeController";
import { getTemplates, createTemplate } from "../controllers/templateController";
import {
  getAutomations,
  createAutomation,
  updateAutomation,
  toggleAutomation,
  deleteAutomation,
  testAutomation,
} from "../controllers/automationController";
import { getOrders, createOrder } from "../controllers/orderController";
import { uploadPdf } from "../controllers/uploadController";

export const router = Router();

// ── Multer config for PDF uploads ───────────────────────────────────────────
const uploadsDir = path.resolve(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new AppError(400, "Only PDF files are allowed"));
      return;
    }
    cb(null, true);
  },
});

// ── Events ──────────────────────────────────────────────────────────────────
router.get("/events", getEvents);
router.post("/events", createEvent);
router.get("/events/:id", getEvent);

// ── Ticket Types ────────────────────────────────────────────────────────────
router.get("/events/:eventId/ticket-types", getTicketTypes);
router.post("/events/:eventId/ticket-types", createTicketType);

// ── Email Templates ─────────────────────────────────────────────────────────
router.get("/templates", getTemplates);
router.post("/templates", createTemplate);

// ── Automations ─────────────────────────────────────────────────────────────
router.get("/events/:eventId/automations", getAutomations);
router.post("/events/:eventId/automations", createAutomation);
router.put("/automations/:id", updateAutomation);
router.patch("/automations/:id/toggle", toggleAutomation);
router.delete("/automations/:id", deleteAutomation);
router.post("/automations/:id/test", testAutomation);

// ── PDF Upload ──────────────────────────────────────────────────────────────
router.post("/upload/pdf", upload.single("pdf"), uploadPdf);

// ── Orders ──────────────────────────────────────────────────────────────────
router.get("/events/:eventId/orders", getOrders);
router.post("/events/:eventId/orders", createOrder);
