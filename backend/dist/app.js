"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = __importDefault(require("./routes/auth"));
const senders_1 = __importDefault(require("./routes/senders"));
const emails_1 = __importDefault(require("./routes/emails"));
const env_1 = require("./config/env");
const app = (0, express_1.default)();
// Trust reverse proxy (Render / Cloudflare) for secure cookies
app.set('trust proxy', 1);
// Configure CORS to allow frontend calls with cookie credentials
const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://email-scheduler-ecru.vercel.app',
    env_1.env.FRONTEND_URL,
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }
        return callback(null, true); // Allow for production flexibility
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// Base health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});
// Register routers
app.use('/api/auth', auth_1.default);
app.use('/api/senders', senders_1.default);
app.use('/api', emails_1.default); // Mounts /campaigns, /emails, /stats, /leads/parse
// Error handling
app.use(errorHandler_1.errorHandler);
exports.default = app;
