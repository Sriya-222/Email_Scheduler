"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
// Load env variables
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const envSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().default(4000),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    DB_HOST: zod_1.z.string().default('localhost'),
    DB_PORT: zod_1.z.coerce.number().default(3306),
    DB_USER: zod_1.z.string().default('scheduler'),
    DB_PASSWORD: zod_1.z.string().default('scheduler_pw'),
    DB_NAME: zod_1.z.string().default('reachinbox_scheduler'),
    REDIS_HOST: zod_1.z.string().default('localhost'),
    REDIS_PORT: zod_1.z.coerce.number().default(6379),
    REDIS_PASSWORD: zod_1.z.string().default(''),
    SMTP_HOST: zod_1.z.string().default('smtp.ethereal.email'),
    SMTP_PORT: zod_1.z.coerce.number().default(587),
    SMTP_USER: zod_1.z.string().default(''),
    SMTP_PASS: zod_1.z.string().default(''),
    GOOGLE_CLIENT_ID: zod_1.z.string().default(''),
    GOOGLE_CLIENT_SECRET: zod_1.z.string().default(''),
    FRONTEND_URL: zod_1.z.string().optional(),
    JWT_SECRET: zod_1.z.string().default('replace_with_random_string'),
    WORKER_CONCURRENCY: zod_1.z.coerce.number().default(5),
    MIN_DELAY_BETWEEN_EMAILS_MS: zod_1.z.coerce.number().default(2000),
    MAX_EMAILS_PER_HOUR: zod_1.z.coerce.number().default(200),
});
exports.env = envSchema.parse(process.env);
