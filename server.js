import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import userAuthRouter from './routes/auth.user.js';
import fileRoutes from './routes/file.routes.js';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = 3000;
const corsOptions = {
  origin: ['https://kzmgdwzhhmzrrp39ip84.lite.vusercontent.net', 'http://localhost:5000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/api/auth/user', userAuthRouter);
app.use('/api/files', fileRoutes);

app.get('/', (req, res) => {
  res.send('Hello World!');
});
app.head('/', (req, res) => {
  res.status(200).send(); 
});


mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('Error connecting to MongoDB:', error.message);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});