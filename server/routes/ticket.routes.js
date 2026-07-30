import express from "express";
import * as ticketController from "../controllers/ticket.controller.js";
import { requireAuth, isAuthenticated } from "../middleware/auth.js";
import { heavyLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// All ticket routes require authentication
router.use(requireAuth, isAuthenticated);

router.post("/", ticketController.createTicket);
router.get("/", ticketController.getTickets);
router.get("/metrics", ticketController.getTicketMetrics);
router.post("/:ticketId/ai-assist", heavyLimiter, ticketController.getAiAssistance);
router.get("/:ticketId", ticketController.getTicketById);
router.patch("/:ticketId/status", ticketController.updateTicketStatus);
router.post("/:ticketId/messages", ticketController.addMessage);

export default router;
