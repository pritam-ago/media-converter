import { parentPort, workerData } from "worker_threads";
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const uploadFile = async ({ file, sessionId }) => {
  try {
    const fileKey = `${sessionId}/${Date.now()}-${file.originalname}`;
    const partSize = 5 * 1024 * 1024;
    const totalParts = Math.ceil(file.buffer.length / partSize);

    console.log(`Uploading ${file.originalname} in ${totalParts} parts to folder: ${sessionId}`);

    const { UploadId } = await s3.send(
      new CreateMultipartUploadCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
      })
    );

    const uploadedParts = [];

    for (let partNumber = 1, i = 0; i < file.buffer.length; i += partSize, partNumber++) {
      const chunk = file.buffer.slice(i, i + partSize);

      try {
        const { ETag } = await s3.send(new UploadPartCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: fileKey,
          UploadId,
          PartNumber: partNumber,
          Body: chunk,
        }));

        uploadedParts.push({ PartNumber: partNumber, ETag });
        console.log(`Part ${partNumber} uploaded successfully.`);
      } catch (error) {
        console.error(`Part ${partNumber} failed:`, error.message);
        throw new Error(`Failed to upload part ${partNumber}: ${error.message}`);
      }
    }

    await s3.send(new CompleteMultipartUploadCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
      UploadId,
      MultipartUpload: { Parts: uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber) },
    }));

    console.log(`Upload completed for ${file.originalname} -> s3://${process.env.AWS_BUCKET_NAME}/${fileKey}`);

    parentPort.postMessage({ success: true, fileUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}` });

  } catch (error) {
    console.error(`Upload failed for ${workerData.file?.originalname}:`, error.message);
    parentPort.postMessage({ success: false, error: error.message });
  }
};

uploadFile(workerData);
