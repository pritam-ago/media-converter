import path from 'path';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import {
  createEmptyFolder,
  listObjects,
  deleteObject,
  generateSignedUrl,
  deleteFolder,
  copyObject,
  moveObject,
  listFolderObjects,
  getFileStream
} from '../utils/s3Helpers.js';
import archiver from 'archiver';


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
  const { folderPath, currentFolder } = req.body;
  
  const folderPathFinal = currentFolder ? `${currentFolder}/${folderPath}` : `${folderPath}`;


  if (!folderPath) return res.status(400).json({ message: 'Folder path required' });
  
  
  try {
    
    const key = `users/${userId}/${folderPathFinal.replace(/\/?$/, '/')}`;
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
      await deleteFolder(fullKey);
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

export const copyFile = async (req, res) => {
  const userId = req.user.id;
  const { sourceKey, destinationKey } = req.body;

  if (!sourceKey || !destinationKey) return res.status(400).json({ message: 'Source and destination keys are required' });

  const sourceFullKey = `users/${userId}/${sourceKey.replace(/^\/+/, '')}`;
  const destinationFullKey = `users/${userId}/${destinationKey.replace(/^\/+/, '')}`;

  try {
    await copyObject(sourceFullKey, destinationFullKey);
    res.status(200).json({ message: 'File copied successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const moveFile = async (req, res) => {
  const userId = req.user.id;
  const { sourceKey, destinationKey } = req.body;

  if (!sourceKey || !destinationKey) return res.status(400).json({ message: 'Source and destination keys are required' });

  const sourceFullKey = `users/${userId}/${sourceKey.replace(/^\/+/, '')}`;
  const destinationFullKey = `users/${userId}/${destinationKey.replace(/^\/+/, '')}`;

  try {
    await moveObject(sourceFullKey, destinationFullKey);
    res.status(200).json({ message: 'File moved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const renameFileOrFolder = async (req, res) => {
  const userId = req.user.id;
  const { oldKey, newKey } = req.body;

  if (!oldKey || !newKey) return res.status(400).json({ message: 'Old and new keys are required' });

  const oldFullKey = `users/${userId}/${oldKey.replace(/^\/+/, '')}`;
  const newFullKey = `users/${userId}/${newKey.replace(/^\/+/, '')}`;

  try {
    await moveObject(oldFullKey, newFullKey);
    res.status(200).json({ message: 'File or folder renamed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const downloadFolderAsZip = async (req, res) => {
  const { folder } = req.params;
  const userId = req.user.id;

  const folderKey = `users/${userId}/${folder}/`;

  try {
    const objects = await listFolderObjects(folderKey);
    if (objects.length === 0) {
      return res.status(404).json({ message: 'Folder not found or empty' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${folder}.zip"`
    );

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).send({ message: 'Error creating archive' });
    });

    archive.pipe(res);

    for (const obj of objects) {
      if (obj.Key.endsWith('/')) continue;

      const relativePath = obj.Key.replace(folderKey, ''); // make it relative to the zip root
      const stream = await getFileStream(obj.Key);
      archive.append(stream, { name: relativePath });
    }

    await archive.finalize();
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Failed to download folder' });
  }
};