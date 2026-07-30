import express from "express";
import {
  getAcademicReport,
  getAdmissionReport,
  getDocumentReport,
  getFinancialReport,
  getFeeWiseReport,
  askReport,
  getReportConversation,
  listReportConversations,
} from "../controllers/report.controller.js";
import { requireAuth, isAuthorized } from "../middleware/auth.js";
import { heavyLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.use(requireAuth);
router.use(isAuthorized({ roles: ["admin"] }));

router.get("/academic", getAcademicReport);
router.get("/admission", getAdmissionReport);
router.get("/documents", getDocumentReport);
router.get("/financial", getFinancialReport);
router.get("/fee-wise", getFeeWiseReport);
router.get("/conversations", listReportConversations);
router.get("/conversations/:conversationId", getReportConversation);
router.post("/ask", heavyLimiter, askReport);

export default router;
