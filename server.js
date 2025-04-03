import express from 'express';
import dotenv from 'dotenv';
import uploadRouter from './routes/upload.js';
import convertRouter from './routes/convert.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/upload', uploadRouter);
app.use('/convert', convertRouter);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});