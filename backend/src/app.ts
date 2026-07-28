import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import sendersRouter from './routes/senders';
import emailsRouter from './routes/emails';

const app = express();

// Configure CORS to allow frontend calls with cookie credentials
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Base health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Register routers
app.use('/api/auth', authRouter);
app.use('/api/senders', sendersRouter);
app.use('/api', emailsRouter); // Mounts /campaigns, /emails, /stats, /leads/parse

// Error handling
app.use(errorHandler);

export default app;
