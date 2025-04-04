import express from "express";
import { v4 as uuidv4 } from 'uuid';


const router = express.Router();

router.post("/start-session", async (req, res) => {
  const sessionId = uuidv4();
  res.json({
    message: "Session started successfully!",
    sessionId: sessionId,
  });
});

export default router;