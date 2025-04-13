import path from 'path';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import {
  createEmptyFolder,
  listObjects,
  deleteObject,
  generateSignedUrl,
  deleteFolderRecursively
} from '../utils/s3Helpers.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const uploadFiles = async (req, res) => {
  const userId = req.user.id;
  const files = req.files;
  const folderPath = req.body.folder || '';

  if (!files?.length) return res.status(400).json({ message: 'No files uploaded' });

  const results = [];
  let completed = 0;

  files.forEach((file) => {
    const worker = new Worker(path.join(__dirname, '../workers/uploadWorker.js'), {
      workerData: { file, userId, folderPath }
    });

    worker.on('message', (data) => {
      results.push(data);
      completed++;
      if (completed === files.length) {
        res.status(200).json({ message: 'Files uploaded', results });
      }
    });

    worker.on('error', (err) => res.status(500).json({ error: err.message }));
  });
};

export const createFolder = async (req, res) => {
  const userId = req.user.id;
  const { folderPath } = req.body;

  if (!folderPath) return res.status(400).json({ message: 'Folder path required' });

  try {
    const key = `users/${userId}/${folderPath.replace(/\/?$/, '/')}`;
    await createEmptyFolder(key);
    res.status(201).json({ message: 'Folder created', key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const listFiles = async (req, res) => {
  const userId = req.user.id;
  let { prefix } = req.query;

  if (prefix && !prefix.endsWith('/')) {
    prefix += '/';
  }
  
  const Prefix = `users/${userId}/${prefix || ''}`;

  try {
    const { folders, files } = await listObjects(Prefix);
    res.status(200).json({ folders, files });
  } catch (err) {
    console.error("S3 List Error:", err);
    res.status(500).json({ error: "Failed to list files and folders" });
  }
};


export const deleteFileOrFolder = async (req, res) => {
  const userId = req.user.id;
  const { key, isFolder } = req.body;

  if (!key) return res.status(400).json({ message: 'Key is required' });

  const fullKey = `users/${userId}/${key.replace(/^\/+/, '')}`;
  try {
    if (isFolder) {
      await deleteFolderRecursively(fullKey);
      res.status(200).json({ message: 'Folder deleted' });
    } else {
      await deleteObject(fullKey);
      res.status(200).json({ message: 'File deleted' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getSignedUrl = async (req, res) => {
  const userId = req.user.id;
  const { key } = req.query;

  if (!key) return res.status(400).json({ message: 'Key is required' });

  const fullKey = `users/${userId}/${key.replace(/^\/+/, '')}`;
  try {
    const url = await generateSignedUrl(fullKey);
    res.status(200).json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
