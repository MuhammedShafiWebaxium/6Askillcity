import mongoose from "mongoose";

const ReportMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportConversation",
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    legacyMessageId: {
      type: String,
    },
  },
  { timestamps: true },
);

ReportMessageSchema.index({ conversationId: 1, createdAt: -1 });
ReportMessageSchema.index({ ownerId: 1, conversationId: 1 });
ReportMessageSchema.index(
  { legacyMessageId: 1 },
  { unique: true, sparse: true },
);

export default mongoose.model("ReportMessage", ReportMessageSchema);
