import { parentPort, workerData, Worker } from "worker_threads";
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from 'uuid';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessionId = uuidv4();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const uploadPart = async ({ fileKey, uploadId, partNumber, chunk }) => {
  try {
    const { ETag } = await s3.send(
      new UploadPartCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: chunk,
      })
    );
    console.log(`✅ Part ${partNumber} uploaded for ${fileKey}`);
    return { PartNumber: partNumber, ETag };
  } catch (error) {
    console.error(`❌ Part ${partNumber} failed:`, error);
    return null;
  }
};

const uploadFile = async (file) => {
  try {
    const fileKey = `${sessionId}/${Date.now()}-${file.originalname}`;
    const partSize = 5 * 1024 * 1024; 
    const totalParts = Math.ceil(file.buffer.length / partSize);

    console.log(`📌 Uploading ${file.originalname} in ${totalParts} parts using parallel threads...`);

    const { UploadId } = await s3.send(
      new CreateMultipartUploadCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
      })
    );

    const uploadPromises = [];
    let partNumber = 1;

    for (let i = 0; i < file.buffer.length; i += partSize) {
      const chunk = file.buffer.slice(i, i + partSize);

      uploadPromises.push(
        new Promise((resolve) => {
          const worker = new Worker(__filename, {
            workerData: { fileKey, uploadId: UploadId, partNumber, chunk },
          });

          worker.on("message", resolve);
          worker.on("error", (error) => resolve(null));
        })
      );

      partNumber++;
    }

    const uploadedParts = (await Promise.all(uploadPromises)).filter((part) => part !== null);

    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
        UploadId,
        MultipartUpload: { Parts: uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber) },
      })
    );

    console.log(`🎉 Upload completed for ${file.originalname}!`);

    parentPort.postMessage({ success: true, fileUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}` });

  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
};

if (workerData?.chunk) {
  uploadPart(workerData).then((result) => parentPort.postMessage(result));
} else {
  uploadFile(workerData);
}