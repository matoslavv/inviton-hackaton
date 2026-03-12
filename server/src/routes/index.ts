import { Router } from "express";
import { getUsers, createUser } from "../controllers/userController";

export const router = Router();

router.get("/users", getUsers);
router.post("/users", createUser);
