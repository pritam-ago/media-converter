import express from 'express';
import multer from 'multer';
import { verifyToken } from '../middlewares/auth.middleware.js';
import {
  uploadFiles,
  createFolder,
  listFiles,
  deleteFileOrFolder,
  getSignedUrl,
  copyFile,
  moveFile,
  renameFileOrFolder
} from '../controllers/file.controller.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/upload', verifyToken, upload.array('files'), uploadFiles);
router.post('/folder', verifyToken, createFolder);
router.get('/list', verifyToken, listFiles);
router.delete('/', verifyToken, deleteFileOrFolder);
router.get('/url', verifyToken, getSignedUrl);
router.post('/move', verifyToken, moveFile);
router.post('/copy', verifyToken, copyFile);
router.post('/rename', verifyToken, renameFileOrFolder);

export default router;
