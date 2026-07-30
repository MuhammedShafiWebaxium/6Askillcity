import mongoose from "mongoose";

const ReportConversationSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

ReportConversationSchema.index({ ownerId: 1, lastMessageAt: -1 });

export default mongoose.model(
  "ReportConversation",
  ReportConversationSchema,
);
