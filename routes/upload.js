import express from "express";
import multer from "multer";
import { Worker } from "worker_threads";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
const router = express.Router();

// 🔹 Multer Setup (Memory Storage for Faster Processing)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 🔹 Route: Upload Multiple Files with Worker Threads
router.post("/multiple", upload.array("files", 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded!" });
  }

  console.log(`📌 Starting upload for ${req.files.length} files...`);

  // 🔹 Start Worker Threads for Each File
  const uploadPromises = req.files.map((file) => {
    return new Promise((resolve) => {
      const worker = new Worker(path.resolve("workers/upload-worker.js"), { workerData: file });

      worker.on("message", resolve);
      worker.on("error", (error) => resolve({ success: false, error: error.message }));
    });
  });

  // 🔹 Wait for All Workers to Finish
  const results = await Promise.all(uploadPromises);

  // 🔹 Send Response
  res.json({
    message: "Upload process completed!",
    uploads: results,
  });
});

export default router;
