import s3 from './s3Client.js';
import {
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  CopyObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import Readable from 'stream';

const formatSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const createEmptyFolder = async (Key) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key,
    Body: '',
  });
  await s3.send(command);
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
    name: cp.Prefix.split("/").filter(Boolean).pop(), 
  }));

  const files = (result.Contents || [])
    .filter(obj => obj.Key !== Prefix)
    .map(obj => ({
      key: obj.Key,
      name: obj.Key.split("/").pop(), 
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

export const deleteFolder = async (folderPrefix) => {
  const listParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Prefix: folderPrefix,
  };

  const listCommand = new ListObjectsV2Command(listParams);
  const listedObjects = await s3.send(listCommand);

  if (!listedObjects.Contents || listedObjects.Contents.length === 0) return;

  const deleteParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Delete: {
      Objects: listedObjects.Contents.map(obj => ({ Key: obj.Key })),
    },
  };

  const deleteCommand = new DeleteObjectsCommand(deleteParams);
  await s3.send(deleteCommand);

  if (listedObjects.IsTruncated) {
    await deleteFolder(process.env.AWS_BUCKET_NAME, folderPrefix);
  }
}

export const generateSignedUrl = async (Key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key,
  });
  return await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
};

export const copyObject = async (sourceKey, destinationKey) => {
  const command = new CopyObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    CopySource: encodeURIComponent(`${process.env.AWS_BUCKET_NAME}/${sourceKey}`),
    Key: destinationKey,
  });
  await s3.send(command);
};

export const moveObject = async (sourceKey, destinationKey) => {
  if (sourceKey.endsWith('/')) {
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.AWS_BUCKET_NAME,
      Prefix: sourceKey,
    });

    const listedObjects = await s3.send(listCommand);
    if (!listedObjects.Contents || listedObjects.Contents.length === 0) return;

    for (const obj of listedObjects.Contents) {
      const newObjectKey = obj.Key.replace(sourceKey, destinationKey);
      await copyObject(obj.Key, newObjectKey);
    }

    const deleteParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Delete: {
        Objects: listedObjects.Contents.map(obj => ({ Key: obj.Key })),
      },
    };
    await s3.send(new DeleteObjectsCommand(deleteParams));
  } else {
    await copyObject(sourceKey, destinationKey);
    await deleteObject(sourceKey);
  }
};

export const listFolderObjects = async (folderKey) => {
  const command = new ListObjectsV2Command({
    Bucket: process.env.AWS_BUCKET_NAME,
    Prefix: folderKey.endsWith('/') ? folderKey : `${folderKey}/`,
  });

  const data = await s3.send(command);
  return data.Contents || [];
};

export const getFileStream = async (Key) => {
  const command = new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key });
  const response = await s3.send(command);
  return response.Body;
};