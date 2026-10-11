import { Router } from "express";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const query = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const filter = { _id: { $ne: req.userId } };
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } }
      ];
    }
    const users = await User.find(filter).select("name email avatar").sort({ name: 1 }).limit(30).lean();
    res.json(users.map(({ _id, name, email, avatar }) => ({
      id: String(_id),
      name,
      email,
      avatar
    })));
  } catch (error) {
    next(error);
  }
});

export default router;
