import { workerData, parentPort } from 'worker_threads';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import s3 from '../utils/s3Client.js';
import fs from 'fs';

const { file, userId, folderPath } = workerData;
const prefix = folderPath ? `${folderPath}/` : '';
const Key = `users/${userId}/${prefix}${file.originalname}`;

const uploadToS3 = async () => {
  const fileStream = fs.createReadStream(file.path);

  try {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key,
      Body: fileStream,
      ContentType: file.mimetype,
    }));
    fs.unlinkSync(file.path);
    parentPort.postMessage({ success: true, filename: file.originalname, key: Key });
  } catch (err) {
    parentPort.postMessage({ success: false, error: err.message });
  }
};

uploadToS3();
