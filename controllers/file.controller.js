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
  let prefix = `users/`;
  if (req.query.prefix) {
    prefix += req.query.prefix.endsWith('/') ? req.query.prefix : `${req.query.prefix}/`;
  }

  try {
    const { files, folders } = await listObjects(prefix);

    const folderList = folders.map((folderKey) => {
      return {
        type: 'folder',
        name: folderKey.Key.split('/').slice(-2, -1)[0], // Last folder name before slash
        key: folderKey.Key,
      };
    });

    const fileList = files
      .filter((item) => item.Key !== prefix) // Ignore the "folder" placeholder
      .map((item) => ({
        type: 'file',
        name: item.Key.split('/').pop(),
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
      }));

    res.status(200).json([...folderList, ...fileList]);
  } catch (err) {
    console.error('Error listing files:', err);
    res.status(500).json({ error: err.message });
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
