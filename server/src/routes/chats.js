import { Router } from "express";
import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ participants: req.userId })
      .populate("participants", "name email avatar")
      .populate({ path: "lastMessage", populate: { path: "sender", select: "name" } })
      .sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (!Array.isArray(body.participantIds) || body.participantIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "Provide valid participant IDs." });
    }
    const participantIds = [...new Set(body.participantIds.map(String))];
    const isGroup = body.isGroup === true;
    const groupName = typeof body.groupName === "string" ? body.groupName.trim() : "";
    if (participantIds.length < (isGroup ? 2 : 1) || participantIds.length > 30) {
      return res.status(400).json({ message: isGroup ? "Select between 2 and 30 people." : "Select a person to chat with." });
    }
    if (isGroup && (groupName.length < 2 || groupName.length > 80)) {
      return res.status(400).json({ message: "Group name must be between 2 and 80 characters." });
    }
    const ids = [...new Set([String(req.userId), ...participantIds])];
    const existingUsers = await User.countDocuments({ _id: { $in: ids } });
    if (existingUsers !== ids.length) return res.status(400).json({ message: "One or more selected accounts no longer exist." });

    if (!isGroup && ids.length === 2) {
      const existing = await Conversation.findOne({
        isGroup: false,
        participants: { $all: ids, $size: 2 }
      }).populate("participants", "name email avatar");
      if (existing) return res.json(existing);
    }

    const conversation = await Conversation.create({
      participants: ids,
      isGroup,
      groupName: isGroup ? groupName : ""
    });
    const populated = await conversation.populate("participants", "name email avatar");
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/messages", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid conversation ID." });
    const conversation = await Conversation.exists({ _id: req.params.id, participants: req.userId });
    if (!conversation) return res.status(404).json({ message: "Conversation not found." });
    const messages = await Message.find({ conversation: req.params.id })
      .populate("sender", "name email avatar")
      .sort({ createdAt: 1 })
      .limit(200);
    res.json(messages);
  } catch (error) {
    next(error);
  }
});

export default router;
