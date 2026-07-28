import nodemailer from 'nodemailer';
import { env } from '../config/env';

let cachedTransporterPromise: Promise<nodemailer.Transporter> | null = null;

async function getTransporter(sender: { smtp_user: string; smtp_pass: string }) {
  // Use sender-specific SMTP settings if they are filled in and valid
  if (sender.smtp_user && sender.smtp_pass && !sender.smtp_user.startsWith('mock_')) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: sender.smtp_user,
        pass: sender.smtp_pass,
      },
    });
  }

  // Fallback to environment SMTP settings if available
  if (env.SMTP_USER && env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  // Programmatic Ethereal SMTP generator for development convenience (single-instance cached promise)
  if (!cachedTransporterPromise) {
    cachedTransporterPromise = (async () => {
      console.log('Generating Ethereal SMTP credentials programmatically...');
      const testAccount = await nodemailer.createTestAccount();
      console.log(`Generated Ethereal test credentials:`);
      console.log(`  User: ${testAccount.user}`);
      console.log(`  Pass: ${testAccount.pass}`);
      return nodemailer.createTransport({
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

export async function sendViaEthereal(
  sender: { smtp_user: string; smtp_pass: string; name: string },
  email: { to: string; subject: string; html: string }
) {
  const transporter = await getTransporter(sender);
  const fromAddress = sender.smtp_user && !sender.smtp_user.startsWith('mock_') 
    ? sender.smtp_user 
    : (transporter.options as any).auth?.user || 'test-sender@ethereal.email';

  const info = await transporter.sendMail({
    from: `"${sender.name}" <${fromAddress}>`,
    to: email.to,
    subject: email.subject,
    html: email.html,
  });

  console.log(`Email sent successfully: ${info.messageId}`);
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`View email at: ${previewUrl}`);
  }
  return info;
}
