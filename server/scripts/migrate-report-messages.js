import "../config/env.js";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import ReportConversation from "../models/reportConversation.js";
import ReportMessage from "../models/reportMessage.js";

const migrateReportMessages = async () => {
  await connectDB();

  let migratedConversations = 0;
  let migratedMessages = 0;
  const cursor = ReportConversation.collection.find({
    "messages.0": { $exists: true },
  });

  for await (const conversation of cursor) {
    const legacyMessages = Array.isArray(conversation.messages)
      ? conversation.messages
      : [];
    if (!legacyMessages.length) continue;

    const operations = legacyMessages.map((message, index) => {
      const createdAt =
        message.createdAt ||
        new Date(
          new Date(conversation.createdAt || conversation._id.getTimestamp())
            .getTime() + index,
        );
      const legacyMessageId = `${conversation._id}:${message._id || index}`;

      return {
        updateOne: {
          filter: { legacyMessageId },
          update: {
            $setOnInsert: {
              conversationId: conversation._id,
              ownerId: conversation.ownerId,
              role: message.role,
              content: message.content,
              legacyMessageId,
              createdAt,
            },
          },
          upsert: true,
        },
      };
    });

    const result = await ReportMessage.bulkWrite(operations, {
      ordered: false,
    });
    const messageCount = await ReportMessage.countDocuments({
      conversationId: conversation._id,
      ownerId: conversation.ownerId,
    });
    const latestMessage = await ReportMessage.findOne({
      conversationId: conversation._id,
      ownerId: conversation.ownerId,
    })
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean();

    await ReportConversation.collection.updateOne(
      { _id: conversation._id },
      {
        $unset: { messages: "" },
        $set: {
          messageCount,
          lastMessageAt:
            latestMessage?.createdAt ||
            conversation.updatedAt ||
            conversation.createdAt,
        },
      },
    );

    migratedConversations += 1;
    migratedMessages += result.upsertedCount;
  }

  console.log(
    `Report-message migration complete: ${migratedConversations} conversations, ${migratedMessages} messages copied.`,
  );
};

try {
  await migrateReportMessages();
  await mongoose.disconnect();
  process.exit(0);
} catch (error) {
  console.error("Report-message migration failed:", error);
  await mongoose.disconnect();
  process.exit(1);
}
