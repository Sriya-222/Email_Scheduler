"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendViaEthereal = sendViaEthereal;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
let cachedTransporterPromise = null;
async function getTransporter(sender) {
    // Use sender-specific SMTP settings if they are filled in and valid
    if (sender.smtp_user && sender.smtp_pass && !sender.smtp_user.startsWith('mock_')) {
        return nodemailer_1.default.createTransport({
            host: env_1.env.SMTP_HOST,
            port: env_1.env.SMTP_PORT,
            secure: env_1.env.SMTP_PORT === 465,
            auth: {
                user: sender.smtp_user,
                pass: sender.smtp_pass,
            },
        });
    }
    // Fallback to environment SMTP settings if available
    if (env_1.env.SMTP_USER && env_1.env.SMTP_PASS) {
        return nodemailer_1.default.createTransport({
            host: env_1.env.SMTP_HOST,
            port: env_1.env.SMTP_PORT,
            secure: env_1.env.SMTP_PORT === 465,
            auth: {
                user: env_1.env.SMTP_USER,
                pass: env_1.env.SMTP_PASS,
            },
        });
    }
    // Programmatic Ethereal SMTP generator for development convenience (single-instance cached promise)
    if (!cachedTransporterPromise) {
        cachedTransporterPromise = (async () => {
            console.log('Generating Ethereal SMTP credentials programmatically...');
            const testAccount = await nodemailer_1.default.createTestAccount();
            console.log(`Generated Ethereal test credentials:`);
            console.log(`  User: ${testAccount.user}`);
            console.log(`  Pass: ${testAccount.pass}`);
            return nodemailer_1.default.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
        })();
    }
    return cachedTransporterPromise;
}
async function sendViaEthereal(sender, email) {
    const transporter = await getTransporter(sender);
    const fromAddress = sender.smtp_user && !sender.smtp_user.startsWith('mock_')
        ? sender.smtp_user
        : transporter.options.auth?.user || 'test-sender@ethereal.email';
    const info = await transporter.sendMail({
        from: `"${sender.name}" <${fromAddress}>`,
        to: email.to,
        subject: email.subject,
        html: email.html,
    });
    console.log(`Email sent successfully: ${info.messageId}`);
    const previewUrl = nodemailer_1.default.getTestMessageUrl(info);
    if (previewUrl) {
        console.log(`View email at: ${previewUrl}`);
    }
    return info;
}
