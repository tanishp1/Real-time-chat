import http from "node:http";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import chatRoutes from "./routes/chats.js";
import userRoutes from "./routes/users.js";
import Conversation from "./models/Conversation.js";
import Message from "./models/Message.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const app = express();
const server = http.createServer(app);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const allowOrigin = (origin, callback) => {
  const isLocalDevelopmentOrigin = process.env.NODE_ENV !== "production" &&
    /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin || "");
  callback(null, !origin || origin === clientUrl || isLocalDevelopmentOrigin);
};
const corsOptions = { origin: allowOrigin, methods: ["GET", "POST"] };
const io = new Server(server, {
  cors: corsOptions
});

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/users", userRoutes);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Something went wrong." });
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required."));
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.userId;
    next();
  } catch {
    next(new Error("Invalid or expired authentication token."));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.userId}`);

  socket.on("message:send", async (payload, acknowledge = () => {}) => {
    const reply = typeof acknowledge === "function" ? acknowledge : () => {};
    try {
      const text = typeof payload?.text === "string" ? payload.text.trim() : "";
      if (!text || text.length > 4000) {
        return reply({ error: "Messages must contain between 1 and 4000 characters." });
      }

      const conversation = await Conversation.findOne({
        _id: payload.conversationId,
        participants: socket.userId
      });
      if (!conversation) return reply({ error: "Conversation not found." });

      const message = await Message.create({
        conversation: conversation._id,
        sender: socket.userId,
        text
      });
      conversation.lastMessage = message._id;
      await conversation.save();
      const populatedMessage = await message.populate("sender", "name email avatar");
      const result = {
        conversationId: conversation.id,
        message: populatedMessage
      };

      for (const participantId of conversation.participants) {
        io.to(`user:${participantId}`).emit("message:new", result);
      }
      reply({ message: populatedMessage });
    } catch (error) {
      console.error("Unable to send message:", error);
      reply({ error: "Unable to send message." });
    }
  });
});

const port = Number(process.env.PORT) || 5000;
const isOrbitApiRunning = async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1500)
    });
    if (!response.ok) return false;
    const health = await response.json();
    return health.status === "ok";
  } catch (error) {
    if (
      error instanceof TypeError ||
      error instanceof SyntaxError ||
      error.name === "AbortError" ||
      error.name === "TimeoutError"
    ) {
      return false;
    }
    throw error;
  }
};

const listen = () => new Promise((resolve, reject) => {
  const onError = (error) => {
    server.off("listening", onListening);
    reject(error);
  };
  const onListening = () => {
    server.off("error", onError);
    resolve();
  };

  server.once("error", onError);
  server.once("listening", onListening);
  server.listen(port);
});

const start = async () => {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    throw new Error("Set MONGO_URI and JWT_SECRET in the environment before starting the server.");
  }
  await mongoose.connect(process.env.MONGO_URI);
  try {
    await listen();
  } catch (error) {
    await mongoose.disconnect();
    if (error.code === "EADDRINUSE" && await isOrbitApiRunning()) {
      console.log(`Orbit Chat API is already running on port ${port}; reusing the existing server.`);
      return;
    }
    throw error;
  }
  console.log(`Orbit Chat API listening on port ${port}`);
};

start().catch((error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is in use by another application. Stop it or set a different PORT in server/.env.`);
  } else {
    console.error("Server startup failed:", error);
  }
  process.exitCode = 1;
});
