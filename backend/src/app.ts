import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import sendersRouter from './routes/senders';
import emailsRouter from './routes/emails';

import { env } from './config/env';

const app = express();

// Trust reverse proxy (Render / Cloudflare) for secure cookies
app.set('trust proxy', 1);

// Configure CORS to allow frontend calls with cookie credentials
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://email-scheduler-ecru.vercel.app',
  env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true); // Allow for production flexibility
  },
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
