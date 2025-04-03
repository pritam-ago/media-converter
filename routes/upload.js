import express from "express";
import multer from "multer";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { Readable } from "stream";

dotenv.config();
const router = express.Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// 🔹 Use Memory Storage (No Local File Storage)
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded!" });

    const fileBuffer = req.file.buffer;
    const fileSize = fileBuffer.length;
    const partSize = 8 * 1024 * 1024; // 🔹 8MB per part
    const totalParts = Math.ceil(fileSize / partSize);
    const fileKey = `uploads/${Date.now()}-${req.file.originalname}`;

    console.log(`📌 Uploading ${req.file.originalname} in ${totalParts} parts...`);

    // 🔹 Step 1: Start Multipart Upload
    const { UploadId } = await s3.send(
      new CreateMultipartUploadCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
      })
    );

    // 🔹 Step 2: Upload Parts in Parallel
    const uploadPromises = [];
    const uploadedParts = [];

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(start + partSize, fileSize);
      const chunk = fileBuffer.slice(start, end);

      uploadPromises.push(
        s3
          .send(
            new UploadPartCommand({
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: fileKey,
              UploadId,
              PartNumber: partNumber,
              Body: Readable.from(chunk),
              ContentLength: chunk.length, // 🔹 Explicitly set Content-Length
            })
          )
          .then(({ ETag }) => {
            console.log(`✅ Part ${partNumber} uploaded`);
            uploadedParts.push({ PartNumber: partNumber, ETag });
          })
      );
    }

    await Promise.all(uploadPromises); // Wait for all uploads to finish

    // 🔹 Step 3: Complete Multipart Upload
    uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);
    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
        UploadId,
        MultipartUpload: { Parts: uploadedParts },
      })
    );

    console.log("🎉 File uploaded successfully to S3!");
    res.json({
      message: "File uploaded successfully!",
      fileUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`,
    });
  } catch (err) {
    console.error("Multipart Upload Error:", err.message);
    res.status(500).json({ error: `Upload failed: ${err.message}` });
  }
});

export default router;
