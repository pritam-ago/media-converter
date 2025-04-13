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

const formatSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const listObjects = async (Prefix) => {
  const command = new ListObjectsV2Command({
    Bucket: process.env.AWS_BUCKET_NAME,
    Prefix,
    Delimiter: '/',
  });

  const result = await s3.send(command);

  const folders = (result.CommonPrefixes || []).map(cp => ({
    key: cp.Prefix,
    name: cp.Prefix.split("/").filter(Boolean).pop(), // Get last folder name
  }));

  const files = (result.Contents || [])
    .filter(obj => obj.Key !== Prefix)
    .map(obj => ({
      key: obj.Key,
      name: obj.Key.split("/").pop(), // Just filename
      size: formatSize(obj.Size || 0),
    }));

  return { folders, files };
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
