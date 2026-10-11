import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
  isGroup: { type: Boolean, default: false },
  groupName: { type: String, trim: true, maxlength: 80, default: "" },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null }
}, { timestamps: true });

conversationSchema.index({ participants: 1, updatedAt: -1 });

export default mongoose.model("Conversation", conversationSchema);
