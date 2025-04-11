import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const s3 = new S3Client({ region: process.env.AWS_REGION });

const createS3Folders = async (userId) => {
  const bucketName = process.env.AWS_BUCKET_NAME;
  const baseKey = `users/${userId}/`;

  const folders = ['images/', 'documents/', 'videos/'];

  const commands = folders.map(folder => {
    return new PutObjectCommand({
      Bucket: bucketName,
      Key: baseKey + folder,
      Body: '', 
    });
  });

  await Promise.all(commands.map(cmd => s3.send(cmd)));

  return {
    bucketName,
    userFolderKey: baseKey,
  };
};

export const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ message: 'Email already in use' });

    const existingUsername = await User.findOne({ username });
    if (existingUsername) return res.status(400).json({ message: 'Username already taken' });

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    const s3Data = await createS3Folders(user._id);
    user.s3Folder = s3Data;
    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      userId: user._id,
      username: user.username,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Signup failed' });
  }
};


export const login = async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: 'Invalid credentials' });
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
  
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  
      res.json({ token, user });
    } catch (err) {
      res.status(500).json({ message: 'Login failed' });
    }
  };
  