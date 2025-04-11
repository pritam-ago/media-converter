import s3 from './s3Client.js';
import {
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const createEmptyFolder = async (Key) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key,
    Body: '',
  });
  await s3.send(command);
};

export const listObjects = async (Prefix) => {
  console.log("Listing objects with prefix:", Prefix);  // Add this log to see the exact prefix being used.
  const command = new ListObjectsV2Command({
    Bucket: process.env.AWS_BUCKET_NAME,
    Prefix,
  });
  const response = await s3.send(command);
  console.log("S3 response:", response);  // Log the S3 response to debug what comes back.
  return response.Contents || [];
};


export const deleteObject = async (Key) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key,
  });
  await s3.send(command);
};

export const deleteFolderRecursively = async (Prefix) => {
  const list = await listObjects(Prefix);
  if (!list.length) return;

  const command = new DeleteObjectsCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Delete: {
      Objects: list.map(obj => ({ Key: obj.Key })),
    },
  });
  await s3.send(command);
};

export const generateSignedUrl = async (Key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key,
  });
  return await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
};
