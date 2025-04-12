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
  const commandFiles = new ListObjectsV2Command({
    Bucket: process.env.AWS_BUCKET_NAME,
    Prefix,
  });

  const commandFolders = new ListObjectsV2Command({
    Bucket: process.env.AWS_BUCKET_NAME,
    Prefix,
    Delimiter: '/',
  });

  const responseFolders = await s3.send(commandFolders);
  const responseFiles = await s3.send(commandFiles);

  const commonPrefixesFolders = responseFolders.CommonPrefixes || [];
  const contents = responseFiles.Contents || [];

  // 🔥 Only get actual files (exclude "folders" with size === 0)
  const files = contents
    .filter(item => item.Size > 0)
    .map(item => ({
      Key: item.Key,
      FileName: item.Key.split('/').pop(), // get the actual file name
      Size: item.Size,
      LastModified: item.LastModified,
    }));

  const folders = commonPrefixesFolders.map(prefix => ({ Key: prefix.Prefix }));

  console.log('files: ', files);
  console.log('folders: ', folders);

  return { files, folders };
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
