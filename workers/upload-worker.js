import { parentPort, workerData } from "worker_threads";
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

// 🔹 Initialize S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// 🔹 Upload File in Parts
const uploadFile = async (file) => {
  try {
    const fileKey = `uploads/${Date.now()}-${file.originalname}`;
    const partSize = 5 * 1024 * 1024; // 5MB per part
    const totalParts = Math.ceil(file.buffer.length / partSize);
    
    console.log(`📌 Uploading ${file.originalname} in ${totalParts} parts...`);

    // 🔹 Step 1: Start Multipart Upload
    const { UploadId } = await s3.send(
      new CreateMultipartUploadCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
      })
    );

    // 🔹 Step 2: Upload Parts
    let uploadedParts = [];
    let partNumber = 1;

    for (let i = 0; i < file.buffer.length; i += partSize) {
      const chunk = file.buffer.slice(i, i + partSize);

      const { ETag } = await s3.send(
        new UploadPartCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: fileKey,
          UploadId,
          PartNumber: partNumber,
          Body: chunk,
        })
      );

      console.log(`✅ Part ${partNumber} uploaded for ${file.originalname}`);
      uploadedParts.push({ PartNumber: partNumber, ETag });
      partNumber++;
    }

    // 🔹 Step 3: Complete Multipart Upload
    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
        UploadId,
        MultipartUpload: { Parts: uploadedParts },
      })
    );

    console.log(`🎉 Upload completed for ${file.originalname}!`);

    // 🔹 Send Response Back to Main Thread
    parentPort.postMessage({ success: true, fileUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}` });

  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
};

// 🔹 Run Upload
uploadFile(workerData);
