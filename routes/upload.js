import express from "express";
import multer from "multer";
import { Worker } from "worker_threads";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import Session from "../models/Session.js";

dotenv.config();
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", upload.array("files", 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded!" });
  }

  const sessionId = req.body.sessionId || uuidv4();
  console.log(`Upload session started: ${sessionId} (${req.files.length} files)`);

  const uploadPromises = req.files.map((file) => {
    return new Promise((resolve) => {
      const worker = new Worker(path.join(__dirname, "../workers/upload-worker.js"), {
        workerData: { file, sessionId },
      });

      worker.on("message", resolve);
      worker.on("error", (error) =>
        resolve({ success: false, error: error.message, file })
      );
    });
  });

  const results = await Promise.all(uploadPromises);

  const uploadedFiles = results
    .map((result, index) => {
      if (result.success) {
        return {
          fileName: req.files[index].originalname,
          filePath: result.fileUrl,
          convertionType: req.body.convertionType || "mp4-mp3",
          fileSize: req.files[index].size,
          uploadedAt: new Date(),
        };
      }
      return null;
    })
    .filter(Boolean);

  if (uploadedFiles.length > 0) {
    await Session.findOneAndUpdate(
      { sessionId },
      {
        sessionId,
        $push: { files: { $each: uploadedFiles } },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true }
    );
  }

  res.json({
    message: "Upload process completed!",
    sessionId,
    uploads: results,
  });
});

export default router;
