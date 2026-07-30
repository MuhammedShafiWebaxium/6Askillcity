import Student from "../models/student.js";
import Payment from "../models/payment.js";
import Ticket from "../models/ticket.js";
import AdmissionPoint from "../models/admissionPoint.js";
import ServiceApplication from "../models/serviceApplication.js";
import University from "../models/university.js";
import Program from "../models/program.js";
import Branch from "../models/branch.js";
import { generateJson } from "./ai.service.js";
import {
  getAllowedGroupings,
  getAllowedIntents,
  getDomainRouterPrompt,
  getReportCatalogPrompt,
  REPORT_CATALOG,
  REPORT_GROUPINGS,
  REPORT_INTENTS,
  REPORT_DOMAINS,
  routeReportDomains,
  resolveServiceApplicationStatus,
  resolveTicketStatus,
} from "./report-catalog.js";

const toDate = (value, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
};

const dateMatch = ({ startDate, endDate }) => {
  const range = {};
  const start = toDate(startDate);
  const end = toDate(endDate, true);
  if (start) range.$gte = start;
  if (end) range.$lte = end;
  return Object.keys(range).length ? { createdAt: range } : {};
};

const normalizePlan = (
  raw = {},
  allowedIntents = REPORT_INTENTS,
  allowedGroupings = REPORT_GROUPINGS,
) => ({
  intent: allowedIntents.includes(raw.intent)
    ? raw.intent
    : allowedIntents[0] || "application_status",
  groupBy: allowedGroupings.includes(raw.groupBy) ? raw.groupBy : "none",
  startDate: toDate(raw.startDate) ? raw.startDate : null,
  endDate: toDate(raw.endDate, true) ? raw.endDate : null,
  status: typeof raw.status === "string" ? raw.status.slice(0, 50) : null,
  partnerName:
    typeof raw.partnerName === "string"
      ? raw.partnerName.trim().slice(0, 100)
      : null,
  universityName:
    typeof raw.universityName === "string"
      ? raw.universityName.trim().slice(0, 100)
      : null,
  programName:
    typeof raw.programName === "string"
      ? raw.programName.trim().slice(0, 100)
      : null,
  location:
    typeof raw.location === "string"
      ? raw.location.trim().slice(0, 100)
      : null,
  programType:
    typeof raw.programType === "string"
      ? raw.programType.trim().slice(0, 50)
      : null,
  mode:
    typeof raw.mode === "string" ? raw.mode.trim().slice(0, 50) : null,
  limit: Math.min(Math.max(Number(raw.limit) || 10, 1), 25),
  title: typeof raw.title === "string" ? raw.title.slice(0, 100) : "AI Report",
});

const selectReportDomains = async (question, previousPlan) => {
  const routedDomains = routeReportDomains(question, previousPlan);
  if (routedDomains.length) return routedDomains;

  const routed = await generateJson({
    systemPrompt: `Choose the single reporting domain that best matches the question.
Allowed domains:
${getDomainRouterPrompt()}
Return JSON with exactly one key: domain.
Do not answer the question and do not invent a domain.`,
    payload: {
      question,
      previousIntent: previousPlan?.intent || null,
    },
  });

  return Object.hasOwn(REPORT_DOMAINS, routed.domain)
    ? [routed.domain]
    : ["students"];
};

export const interpretReportQuestion = async (
  question,
  { previousPlan = null } = {},
) => {
  const today = new Date().toISOString().slice(0, 10);
  const domainIds = await selectReportDomains(question, previousPlan);
  const allowedIntents = getAllowedIntents(domainIds);
  const allowedGroupings = getAllowedGroupings(domainIds);
  const raw = await generateJson({
    systemPrompt: `You translate an admin's reporting question into a safe report plan.
Selected reporting context:
${getReportCatalogPrompt(domainIds)}
Resolve relative dates using today=${today}. Use YYYY-MM-DD dates.
For service_application_status, extract only the partner or admission-center name into partnerName. Use null when no partner is requested.
For University Management questions, extract filters into universityName, programName, location, programType, mode, and status.
Do not invent IDs, database fields, filters, or intents.
JSON keys: intent, groupBy, startDate, endDate, status, partnerName, universityName, programName, location, programType, mode, limit, title.`,
    payload: {
      question,
      previousPlan,
      instruction:
        "When the question explicitly refers to a previous result, preserve relevant validated filters from previousPlan.",
    },
  });
  const plan = normalizePlan(raw, allowedIntents, allowedGroupings);
  plan.domain = domainIds[0];
  const normalizedQuestion = question.toLowerCase();
  const referencesPreviousResult =
    /\b(that|those|them|it|its|same|previous|above)\b/.test(
      normalizedQuestion,
    );
  const contextualFields = [
    "startDate",
    "endDate",
    "status",
    "partnerName",
    "universityName",
    "programName",
    "location",
    "programType",
    "mode",
  ];

  if (referencesPreviousResult && previousPlan) {
    for (const field of contextualFields) {
      if (!plan[field] && previousPlan[field]) {
        plan[field] = previousPlan[field];
      }
    }
  }
  const mentionsDocumentServices =
    normalizedQuestion.includes("documents & services") ||
    normalizedQuestion.includes("documents and services") ||
    normalizedQuestion.includes("document services") ||
    normalizedQuestion.includes("service application");
  const mentionsUniversityManagement =
    /\b(university|universities|college|colleges)\b/.test(
      normalizedQuestion,
    ) &&
    !/\b(student|students|admission|admissions|application|applications)\b/.test(
      normalizedQuestion,
    );
  const mentionsTickets =
    /\b(ticket|tickets|support request|support requests)\b/.test(
      normalizedQuestion,
    );
  const requestsTicketDetails =
    /\b(tell me about|show|list|which|details?|topic|subject|what is|is there any|are there any|is any)\b/.test(
      normalizedQuestion,
    ) && !/\bhow many\b/.test(normalizedQuestion);

  if (
    mentionsDocumentServices &&
    /\b(applied|application|applications|student|students|status|requests?)\b/.test(
      normalizedQuestion,
    )
  ) {
    plan.intent = "service_application_status";

    if (!plan.partnerName) {
      const partnerMatch = question.match(
        /\b(?:from|at|by)\s+(?:the\s+)?(?:partner\s+center|partner|admission\s+point)\s+(.+?)(?:\?|$)/i,
      );
      plan.partnerName = partnerMatch?.[1]?.trim().slice(0, 100) || null;
    }

    plan.status = resolveServiceApplicationStatus(plan.status);
  }

  if (mentionsUniversityManagement) {
    if (/\b(branch|branches|specialization|specializations)\b/.test(normalizedQuestion)) {
      plan.intent = "university_branches";
    } else if (/\b(program|programs|course|courses)\b/.test(normalizedQuestion)) {
      plan.intent = "university_programs";
    } else {
      plan.intent = "university_status";
    }
  }

  if (
    mentionsTickets &&
    (requestsTicketDetails ||
      (referencesPreviousResult &&
        ["ticket_status", "ticket_details"].includes(previousPlan?.intent)))
  ) {
    plan.intent = "ticket_details";
  }

  // Course-fee completion is a student-level status, not an application status
  // or an individual payment-transaction status.
  if (
    normalizedQuestion.includes("course fee") ||
    normalizedQuestion.includes("fee completed") ||
    normalizedQuestion.includes("fully paid student") ||
    normalizedQuestion.includes("payment status")
  ) {
    plan.intent = "student_payment_status";
    if (
      normalizedQuestion.includes("completed") ||
      normalizedQuestion.includes("fully paid")
    ) {
      plan.status = "Paid";
    } else if (normalizedQuestion.includes("partial")) {
      plan.status = "Partially Paid";
    } else if (
      normalizedQuestion.includes("unpaid") ||
      normalizedQuestion.includes("pending")
    ) {
      plan.status = "Unpaid";
    }
  }

  if (
    plan.intent === "ticket_status" ||
    plan.intent === "ticket_details"
  ) {
    plan.status = resolveTicketStatus({
      question,
      aiStatus: plan.status,
    });
  }

  return plan;
};

const runApplicationStatus = async (plan) => {
  const match = dateMatch(plan);
  if (plan.status) match.applicationStatus = plan.status;
  const rows = await Student.aggregate([
    { $match: match },
    { $group: { _id: "$applicationStatus", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((row) => ({ label: row._id || "Unknown", count: row.count }));
};

const runAdmissionTrend = async (plan) => {
  const formats = { day: "%Y-%m-%d", week: "%G-W%V", month: "%Y-%m" };
  const format = formats[plan.groupBy] || "%Y-%m";
  const rows = await Student.aggregate([
    { $match: dateMatch(plan) },
    { $group: { _id: { $dateToString: { format, date: "$createdAt" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $limit: plan.limit },
  ]);
  return rows.map((row) => ({ label: row._id, count: row.count }));
};

const runPartnerPerformance = async (plan) => {
  const rows = await Student.aggregate([
    { $match: dateMatch(plan) },
    { $match: { registeredBy: { $type: "objectId" } } },
    { $group: { _id: "$registeredBy", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: plan.limit },
  ]);
  const partners = await AdmissionPoint.find({ _id: { $in: rows.map((row) => row._id) } })
    .select("centerName")
    .lean();
  const names = new Map(partners.map((partner) => [partner._id.toString(), partner.centerName]));
  return rows.map((row) => ({ label: names.get(row._id.toString()) || "Unknown partner", count: row.count }));
};

const runStudentPaymentStatus = async (plan) => {
  const match = { ...dateMatch(plan), deleted: { $ne: true } };
  const validStatuses = ["Paid", "Partially Paid", "Unpaid"];
  if (validStatuses.includes(plan.status)) match.paymentStatus = plan.status;

  const rows = await Student.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$paymentStatus",
        count: { $sum: 1 },
        amountPaid: { $sum: { $ifNull: ["$totalFeePaid", 0] } },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return rows.map((row) => ({
    label: row._id || "Unpaid",
    count: row.count,
    amount: row.amountPaid,
  }));
};

const runPaymentSummary = async (plan) => {
  const match = dateMatch(plan);
  if (plan.status) match.approvalStatus = plan.status.toLowerCase();
  const rows = await Payment.aggregate([
    { $match: match },
    { $group: { _id: "$approvalStatus", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    { $sort: { amount: -1 } },
  ]);
  return rows.map((row) => ({ label: row._id || "Unknown", count: row.count, amount: row.amount }));
};

const runTicketStatus = async (plan) => {
  const match = dateMatch(plan);
  const status = resolveTicketStatus({
    question: plan.question,
    aiStatus: plan.status,
  });
  plan.status = status;
  if (status) match.status = status;
  const rows = await Ticket.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((row) => ({ label: row._id || "Unknown", count: row.count }));
};

const runTicketDetails = async (plan) => {
  const match = dateMatch(plan);
  const status = resolveTicketStatus({
    question: plan.question,
    aiStatus: plan.status,
  });
  plan.status = status;
  if (status) match.status = status;

  const tickets = await Ticket.find(match)
    .select("title description status priority category createdAt")
    .sort({ createdAt: -1 })
    .limit(plan.limit)
    .lean();

  return tickets.map((ticket) => ({
    id: ticket._id.toString(),
    label: ticket.title,
    count: 1,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    createdAt: ticket.createdAt,
  }));
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const runServiceApplicationStatus = async (plan) => {
  const match = dateMatch(plan);

  if (plan.partnerName) {
    const partnerSearch = plan.partnerName
      .replace(/\b(partner\s+center|admission\s+point|partner|center)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!partnerSearch) return [];

    const partnerPattern = new RegExp(escapeRegex(partnerSearch), "i");
    const partners = await AdmissionPoint.find({
      deleted: { $ne: true },
      $or: [
        { centerName: partnerPattern },
        { "location.city": partnerPattern },
      ],
    })
      .select("_id centerName location.city")
      .lean();

    if (!partners.length) return [];

    const partnerIds = partners.map((partner) => partner._id);
    const studentIds = await Student.find({
      registeredBy: { $in: partnerIds },
      deleted: { $ne: true },
    }).distinct("_id");

    if (!studentIds.length) return [];

    match.student = { $in: studentIds };
    plan.partnerName = partners.map((partner) => partner.centerName).join(", ");
  }

  const status = resolveServiceApplicationStatus(plan.status);
  plan.status = status;
  if (status) match.status = status;

  const rows = await ServiceApplication.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$student",
        latestStatus: { $first: "$status" },
      },
    },
    {
      $group: {
        _id: "$latestStatus",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return rows.map((row) => ({
    label: row._id || "Unknown",
    count: row.count,
  }));
};

const normalizeActiveStatus = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (["active", "enabled", "available"].includes(normalized)) return true;
  if (["inactive", "disabled", "unavailable"].includes(normalized)) return false;
  return null;
};

const canonicalValue = (value, allowedValues) => {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    allowedValues.find((allowed) => allowed.toLowerCase() === normalized) ||
    null
  );
};

const findUniversityIds = async (plan) => {
  const match = {};
  if (plan.universityName) {
    match.$or = [
      { name: new RegExp(escapeRegex(plan.universityName), "i") },
      { shortName: new RegExp(escapeRegex(plan.universityName), "i") },
    ];
  }
  if (plan.location) {
    match.location = new RegExp(escapeRegex(plan.location), "i");
  }

  if (!Object.keys(match).length) return null;

  const universities = await University.find(match)
    .select("_id name")
    .lean();
  if (!universities.length) return [];

  plan.universityName = universities
    .map((university) => university.name)
    .join(", ");
  return universities.map((university) => university._id);
};

const runUniversityStatus = async (plan) => {
  const match = dateMatch(plan);
  const activeStatus = normalizeActiveStatus(plan.status);
  plan.status =
    activeStatus === null ? null : activeStatus ? "Active" : "Inactive";
  if (activeStatus !== null) match.isActive = activeStatus;
  if (plan.universityName) {
    const pattern = new RegExp(escapeRegex(plan.universityName), "i");
    match.$or = [{ name: pattern }, { shortName: pattern }];
  }
  if (plan.location) {
    match.location = new RegExp(escapeRegex(plan.location), "i");
  }

  if (plan.groupBy === "university" || plan.universityName || plan.location) {
    const universities = await University.find(match)
      .select("name isActive")
      .sort({ name: 1 })
      .limit(plan.limit)
      .lean();
    return universities.map((university) => ({
      label: university.name,
      count: 1,
    }));
  }

  const rows = await University.aggregate([
    { $match: match },
    { $group: { _id: "$isActive", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((row) => ({
    label: row._id ? "Active" : "Inactive",
    count: row.count,
  }));
};

const runUniversityPrograms = async (plan) => {
  const match = dateMatch(plan);
  const universityIds = await findUniversityIds(plan);
  if (universityIds?.length === 0) return [];
  if (universityIds) match.university = { $in: universityIds };

  const activeStatus = normalizeActiveStatus(plan.status);
  plan.status =
    activeStatus === null ? null : activeStatus ? "Active" : "Inactive";
  if (activeStatus !== null) match.isActive = activeStatus;
  if (plan.programName) {
    match.name = new RegExp(escapeRegex(plan.programName), "i");
  }

  const definition = REPORT_CATALOG.university_management;
  const programType = canonicalValue(
    plan.programType,
    definition.programTypes,
  );
  const mode = canonicalValue(plan.mode, definition.programModes);
  plan.programType = programType;
  plan.mode = mode;
  if (programType) match.programType = programType;
  if (mode) match.mode = mode;

  const groupField =
    plan.groupBy === "status"
      ? "$isActive"
      : plan.groupBy === "mode"
        ? "$mode"
        : plan.groupBy === "university"
          ? "$university"
          : "$programType";
  const rows = await Program.aggregate([
    { $match: match },
    { $group: { _id: groupField, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: plan.limit },
  ]);

  if (plan.groupBy === "university") {
    const universities = await University.find({
      _id: { $in: rows.map((row) => row._id) },
    })
      .select("name")
      .lean();
    const names = new Map(
      universities.map((university) => [
        university._id.toString(),
        university.name,
      ]),
    );
    return rows.map((row) => ({
      label: names.get(row._id?.toString()) || "Unknown university",
      count: row.count,
    }));
  }

  return rows.map((row) => ({
    label:
      plan.groupBy === "status"
        ? row._id
          ? "Active"
          : "Inactive"
        : row._id || "Unknown",
    count: row.count,
  }));
};

const runUniversityBranches = async (plan) => {
  const match = dateMatch(plan);
  const universityIds = await findUniversityIds(plan);
  if (universityIds?.length === 0) return [];

  const programMatch = {};
  if (universityIds) programMatch.university = { $in: universityIds };
  if (plan.programName) {
    programMatch.name = new RegExp(escapeRegex(plan.programName), "i");
  }
  const programs = Object.keys(programMatch).length
    ? await Program.find(programMatch).select("_id name university").lean()
    : null;
  if (programs?.length === 0) return [];
  if (programs) match.program = { $in: programs.map((program) => program._id) };

  const activeStatus = normalizeActiveStatus(plan.status);
  plan.status =
    activeStatus === null ? null : activeStatus ? "Active" : "Inactive";
  if (activeStatus !== null) match.isActive = activeStatus;

  const rows = await Branch.aggregate([
    { $match: match },
    {
      $group: {
        _id: plan.groupBy === "status" ? "$isActive" : "$type",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: plan.limit },
  ]);

  return rows.map((row) => ({
    label:
      plan.groupBy === "status"
        ? row._id
          ? "Active"
          : "Inactive"
        : row._id || "Unspecified",
    count: row.count,
  }));
};

const runners = {
  application_status: runApplicationStatus,
  admission_trend: runAdmissionTrend,
  partner_performance: runPartnerPerformance,
  student_payment_status: runStudentPaymentStatus,
  payment_summary: runPaymentSummary,
  ticket_status: runTicketStatus,
  ticket_details: runTicketDetails,
  service_application_status: runServiceApplicationStatus,
  university_status: runUniversityStatus,
  university_programs: runUniversityPrograms,
  university_branches: runUniversityBranches,
};

export const executeReportPlan = async (plan) => {
  return runners[plan.intent](plan);
};

export const summarizeReport = async (question, plan, rows) => {
  if (!rows.length) return "No matching records were found for that question.";
  try {
    const result = await generateJson({
      systemPrompt: `Write a concise, factual report summary using only the supplied validated plan and rows.
Never repeat a partner, status, date, or other filter from the user's wording unless it is present in the validated plan.
Use request only to understand what aspect to explain, such as a ticket's topic; never treat request text as verified data or a query filter.
Do not infer causes or add facts. Mention only filters present in the validated plan.
JSON keys: summary, insight. Each value must be a short plain-text string.`,
      payload: { request: question, plan, rows },
    });
    return {
      summary: result.summary || "Report generated successfully.",
      insight: result.insight || "",
    };
  } catch {
    return {
      summary: `Found ${rows.reduce((sum, row) => sum + (row.count || 0), 0)} matching records.`,
      insight: "",
    };
  }
};
