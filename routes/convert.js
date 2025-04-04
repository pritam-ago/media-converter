import express from "express";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { pipeline } from "stream";
import { exec } from "child_process";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
const pipelineAsync = promisify(pipeline);
const execAsync = promisify(exec);

// 🔹 AWS S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// 🔹 Convert Route
router.post("/", async (req, res) => {
  try {
    const { sessionId, files } = req.body; 

    if (!sessionId || !files || !files.length) {
      return res.status(400).json({ error: "Invalid request parameters!" });
    }

    const tempDir = `temp/${sessionId}`;
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const convertedFiles = [];

    for (const fileName of files) {
      const s3Key = `${sessionId}/${fileName}`;
      const localMp4 = path.join(tempDir, fileName);
      const localMp3 = localMp4.replace(".mp4", ".mp3");

      // 🔹 Step 1: Download MP4 from S3
      console.log(`📥 Downloading ${fileName} from S3...`);
      const { Body } = await s3.send(new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
      }));
      await pipelineAsync(Body, fs.createWriteStream(localMp4));

      // 🔹 Step 2: Convert MP4 to MP3 using FFmpeg
      console.log(`🎵 Converting ${fileName} to MP3...`);
      await execAsync(`ffmpeg -i ${localMp4} -q:a 0 -map a ${localMp3}`);

      // 🔹 Step 3: Upload MP3 back to S3
      const mp3Key = `${sessionId}/${path.basename(localMp3)}`;
      console.log(`📤 Uploading ${mp3Key} to S3...`);
      const mp3FileStream = fs.createReadStream(localMp3);
      await s3.send(new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: mp3Key,
        Body: mp3FileStream,
        ContentType: "audio/mpeg",
      }));

      convertedFiles.push(`https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${mp3Key}`);

      // 🔹 Cleanup Local Files
      fs.unlinkSync(localMp4);
      fs.unlinkSync(localMp3);
    }

    res.json({ message: "Conversion complete!", files: convertedFiles });

  } catch (err) {
    console.error("Conversion Error:", err);
    res.status(500).json({ error: "Conversion failed!" });
  }
});

export default router;
