import Student from "../models/student.js";
import Payment from "../models/payment.js";
import AdmissionPoint from "../models/admissionPoint.js";
import University from "../models/university.js";
import Program from "../models/program.js";
import ReportConversation from "../models/reportConversation.js";
import ReportMessage from "../models/reportMessage.js";
import mongoose from "mongoose";
import {
  executeReportPlan,
  interpretReportQuestion,
  summarizeReport,
} from "../services/report-ai.service.js";
import createError from "http-errors";

const DEFAULT_MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LIMIT = 50;

const getLocalAssistantReport = (question) => {
  const normalized = question.trim().toLowerCase();
  if (!/^(hello|hey|greetings|help|what can you do)[!?.,]*$/.test(normalized)) {
    return null;
  }

  return {
    question,
    title: "Hello! How can I help?",
    summary:
      "Ask me about students, applications, course fees, payments, partners, tickets, Documents & Services, or University Management.",
    insight:
      'For example: “Show tickets created today” or “How many active universities are there?”',
    rows: [],
    plan: {
      domain: "help",
      intent: "help",
      groupBy: "none",
      startDate: null,
      endDate: null,
      status: null,
      partnerName: null,
      universityName: null,
      programName: null,
      location: null,
      programType: null,
      mode: null,
    },
  };
};

const serializeConversation = (conversation, messages = []) => ({
  id: conversation._id.toString(),
  title: conversation.title,
  messageCount: conversation.messageCount || 0,
  lastMessageAt: conversation.lastMessageAt,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
  messages: messages.map((message) => ({
    id: message._id.toString(),
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  })),
});

const getOwnedConversation = async (conversationId, ownerId) => {
  if (!mongoose.isValidObjectId(conversationId)) {
    throw createError(400, "Invalid conversation ID");
  }

  const conversation = await ReportConversation.findOne({
    _id: conversationId,
    ownerId,
  });

  if (!conversation) {
    throw createError(404, "Conversation not found");
  }

  return conversation;
};

const getConversationMessages = async ({
  conversationId,
  ownerId,
  before,
  limit,
}) => {
  const requestedLimit = Number(limit) || DEFAULT_MESSAGE_LIMIT;
  const safeLimit = Math.min(
    Math.max(requestedLimit, 1),
    MAX_MESSAGE_LIMIT,
  );
  const match = { conversationId, ownerId };

  if (before) {
    if (!mongoose.isValidObjectId(before)) {
      throw createError(400, "Invalid message cursor");
    }
    match._id = { $lt: before };
  }

  const messages = await ReportMessage.find(match)
    .sort({ _id: -1 })
    .limit(safeLimit + 1)
    .lean();
  const hasMore = messages.length > safeLimit;
  const page = messages.slice(0, safeLimit).reverse();

  return {
    messages: page,
    pagination: {
      hasMore,
      nextCursor: hasMore ? page[0]._id.toString() : null,
      limit: safeLimit,
    },
  };
};

export const listReportConversations = async (req, res, next) => {
  try {
    const conversations = await ReportConversation.find({
      ownerId: req.user.userId,
    })
      .select("title messageCount lastMessageAt createdAt updatedAt")
      .sort({ lastMessageAt: -1 })
      .limit(30)
      .lean();

    res.json({
      success: true,
      data: conversations.map((conversation) => ({
        id: conversation._id.toString(),
        title: conversation.title,
        messageCount: conversation.messageCount || 0,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const getReportConversation = async (req, res, next) => {
  try {
    const conversation = await getOwnedConversation(
      req.params.conversationId,
      req.user.userId,
    );
    const { messages, pagination } = await getConversationMessages({
      conversationId: conversation._id,
      ownerId: req.user.userId,
      before: req.query.before,
      limit: req.query.limit,
    });

    res.json({
      success: true,
      data: {
        ...serializeConversation(conversation, messages),
        pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const askReport = async (req, res, next) => {
  try {
    const question = String(req.body.question || "").trim();
    if (question.length < 5) {
      throw createError(400, "Please enter a more specific report question");
    }
    if (question.length > 500) {
      throw createError(400, "Report questions must be 500 characters or fewer");
    }

    const requestedConversationId = String(
      req.body.conversationId || "",
    ).trim();
    const conversation = requestedConversationId
      ? await getOwnedConversation(
          requestedConversationId,
          req.user.userId,
        )
      : new ReportConversation({
          ownerId: req.user.userId,
          title: question.slice(0, 100),
          messageCount: 0,
          lastMessageAt: new Date(),
        });
    const previousAssistantMessage = requestedConversationId
      ? await ReportMessage.findOne({
          conversationId: conversation._id,
          ownerId: req.user.userId,
          role: "assistant",
        })
          .sort({ _id: -1 })
          .select("content.plan")
          .lean()
      : null;

    let report = getLocalAssistantReport(question);
    if (!report) {
      const plan = await interpretReportQuestion(question, {
        previousPlan: previousAssistantMessage?.content?.plan || null,
      });
      const rows = await executeReportPlan(plan);
      const narrative = await summarizeReport(question, plan, rows);
      report = {
        question,
        title: plan.title,
        summary:
          typeof narrative === "string" ? narrative : narrative.summary,
        insight: typeof narrative === "string" ? "" : narrative.insight,
        rows,
        plan: {
          domain: plan.domain,
          intent: plan.intent,
          groupBy: plan.groupBy,
          startDate: plan.startDate,
          endDate: plan.endDate,
          status: plan.status,
          partnerName: plan.partnerName,
          universityName: plan.universityName,
          programName: plan.programName,
          location: plan.location,
          programType: plan.programType,
          mode: plan.mode,
        },
      };
    }

    if (conversation.isNew) await conversation.save();

    const messageTimestamp = new Date();
    await ReportMessage.insertMany([
      {
        conversationId: conversation._id,
        ownerId: req.user.userId,
        role: "user",
        content: question,
        createdAt: messageTimestamp,
        updatedAt: messageTimestamp,
      },
      {
        conversationId: conversation._id,
        ownerId: req.user.userId,
        role: "assistant",
        content: report,
        createdAt: new Date(messageTimestamp.getTime() + 1),
        updatedAt: new Date(messageTimestamp.getTime() + 1),
      },
    ]);
    await ReportConversation.updateOne(
      { _id: conversation._id, ownerId: req.user.userId },
      {
        $inc: { messageCount: 2 },
        $set: { lastMessageAt: messageTimestamp },
      },
    );

    res.json({
      success: true,
      data: {
        ...report,
        conversationId: conversation._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAcademicReport = async (req, res) => {
  try {
    const { groupBy } = req.query; // 'year', 'course', 'batch'

    let aggregation = [];

    if (groupBy === "year") {
      aggregation = [
        {
          $group: {
            _id: "$completionYear",
            count: { $sum: 1 },
            students: {
              $push: {
                name: "$name",
                email: "$email",
                status: "$applicationStatus",
              },
            },
          },
        },
        { $sort: { _id: -1 } },
      ];
    } else if (groupBy === "course") {
      aggregation = [
        {
          $lookup: {
            from: "programs",
            localField: "program",
            foreignField: "_id",
            as: "programDetails",
          },
        },
        { $unwind: "$programDetails" },
        {
          $group: {
            _id: "$programDetails.name",
            count: { $sum: 1 },
            students: {
              $push: {
                name: "$name",
                email: "$email",
                status: "$applicationStatus",
              },
            },
          },
        },
      ];
    }

    const data = await Student.aggregate(aggregation);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdmissionReport = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query; // 'daily', 'weekly', 'monthly', 'yearly', 'center'

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    let grouping = {};
    if (type === "daily") {
      grouping = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    } else if (type === "weekly") {
      grouping = { $dateToString: { format: "%Y-W%V", date: "$createdAt" } };
    } else if (type === "monthly") {
      grouping = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
    } else if (type === "yearly") {
      grouping = { $dateToString: { format: "%Y", date: "$createdAt" } };
    } else if (type === "center") {
      const data = await Student.aggregate([
        { $match: dateFilter },
        {
          $lookup: {
            from: "admissionpoints",
            localField: "registeredBy",
            foreignField: "_id",
            as: "center",
          },
        },
        { $unwind: "$center" },
        {
          $group: {
            _id: "$center.centerName",
            count: { $sum: 1 },
            students: { $push: { name: "$name", createdAt: "$createdAt" } },
          },
        },
      ]);
      return res.json({ success: true, data });
    }

    const data = await Student.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: grouping,
          count: { $sum: 1 },
          students: { $push: { name: "$name", email: "$email" } },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDocumentReport = async (req, res) => {
  try {
    const { docType, startDate, endDate } = req.query; // 'affidavit', 'migration', 'project-submission'

    let field = docType;
    if (docType === "migration") field = "migrationCertificate";
    if (docType === "project-submission") field = "projectSubmission";

    // Summary Stats (Total, Uploaded, Pending)
    const stats = await Student.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          uploaded: [
            {
              $match: {
                [`${field}.path`]: { $exists: true, $ne: null, $ne: "" },
              },
            },
            { $count: "count" },
          ],
        },
      },
    ]);

    const totalCount = stats[0].total[0]?.count || 0;
    const uploadedGlobalCount = stats[0].uploaded[0]?.count || 0;
    const pendingCount = totalCount - uploadedGlobalCount;

    // Filtered Query for List
    let listQuery = {};
    if (startDate || endDate) {
      listQuery[`${field}.uploadedAt`] = {};
      if (startDate) listQuery[`${field}.uploadedAt`].$gte = new Date(startDate);
      if (endDate) listQuery[`${field}.uploadedAt`].$lte = new Date(endDate);
      // If filtering by date, only show those who uploaded
      listQuery[`${field}.path`] = { $exists: true, $ne: null, $ne: "" };
    }

    const students = await Student.find(listQuery)
      .select(
        `name email phone university program applicationStatus ${field}`,
      )
      .populate("university", "name")
      .populate("program", "name")
      .sort({ [`${field}.uploadedAt`]: -1 });

    res.json({
      success: true,
      data: {
        summary: {
          total: totalCount,
          uploaded: uploadedGlobalCount,
          pending: pendingCount,
          filteredCount: students.length,
        },
        students,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFinancialReport = async (req, res) => {
  try {
    const payments = await Payment.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          transactions: { $push: "$$ROOT" },
        },
      },
    ]);

    if (!payments.length)
      return res.json({ success: true, data: { total: 0, splits: {} } });

    const total = payments[0].totalAmount;

    // Split logic: 6A (40%), Team (20%), University (40%) - example percentages
    const data = {
      total,
      splits: {
        to6A: total * 0.4,
        toUniversity: total * 0.4,
        toAdmissionPoint: total * 0.2,
      },
      transactions: payments[0].transactions,
    };

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFeeWiseReport = async (req, res) => {
  try {
    const data = await Student.aggregate([
      {
        $lookup: {
          from: "programfees",
          localField: "programFee",
          foreignField: "_id",
          as: "feeDetails",
        },
      },
      { $unwind: { path: "$feeDetails", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$feeDetails.name",
          count: { $sum: 1 },
          totalPaid: { $sum: "$totalFeePaid" },
          totalExpected: { $sum: { $ifNull: ["$feeDetails.totalAmount", 0] } },
        },
      },
    ]);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
