import { Router } from "express";
import requireAuth from "../middleware/auth.js";

const router = Router();
const OLLAMA_URL = (process.env.OLLAMA_URL?.trim() || "http://127.0.0.1:11434").replace(/\/+$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:1.5b";
const SYSTEM_PROMPT = "You are Orbit AI, a friendly and thoughtful assistant inside the Orbit chat app. Be clear, useful, and concise. Be honest about uncertainty. Never claim to be a human.";

router.use(requireAuth);

async function hasLocalModel() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result.models?.some((model) => model.name === OLLAMA_MODEL || model.name.startsWith(`${OLLAMA_MODEL}:`)) || false;
  } catch (error) {
    if (error instanceof TypeError || error.name === "AbortError" || error.name === "TimeoutError") {
      return false;
    }
    throw error;
  }
}

router.get("/status", async (_req, res, next) => {
  try {
    res.json({
      configured: await hasLocalModel(),
      provider: "ollama",
      model: OLLAMA_MODEL
    });
  } catch (error) {
    next(error);
  }
});

router.post("/chat", async (req, res, next) => {
  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    return res.status(400).json({ message: "Send between 1 and 20 recent messages." });
  }

  let totalLength = 0;
  for (const message of messages) {
    if (
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim() ||
      message.content.length > 4000
    ) {
      return res.status(400).json({ message: "Each message must have a valid role and contain 1 to 4000 characters." });
    }
    totalLength += message.content.length;
  }

  if (totalLength > 12000) {
    return res.status(400).json({ message: "The recent chat history is too long. Start a new conversation." });
  }
  if (messages.at(-1).role !== "user") {
    return res.status(400).json({ message: "The latest message must be from you." });
  }

  try {
    if (!(await hasLocalModel())) {
      return res.status(503).json({
        message: `The local Orbit AI model is not available. Start Ollama and download ${OLLAMA_MODEL} with "ollama run ${OLLAMA_MODEL}".`
      });
    }

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: false,
        options: { num_predict: 800 }
      }),
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      console.error(`Local Ollama chat request failed with status ${response.status}.`);
      return res.status(502).json({ message: "The local Orbit AI model couldn't complete the request. Please try again." });
    }

    const result = await response.json();
    const reply = result.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      console.error("Local Ollama chat request returned no message content.");
      return res.status(502).json({ message: "The local Orbit AI model returned an empty reply. Please try again." });
    }

    res.json({ reply: reply.trim(), provider: "ollama", model: OLLAMA_MODEL });
  } catch (error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return res.status(504).json({ message: "The local Orbit AI model took too long to respond. Please try again." });
    }
    if (error instanceof TypeError) {
      console.error("Unable to connect to local Ollama:", error.message);
      return res.status(503).json({ message: "Ollama is not running. Start Ollama to use local Orbit AI." });
    }
    next(error);
  }
});

export default router;
