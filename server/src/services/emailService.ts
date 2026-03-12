import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  pdfPath?: string | null;
}

export async function sendEmail({ to, subject, html, pdfPath }: SendEmailOptions) {
  const attachments: nodemailer.SendMailOptions["attachments"] = [];

  if (pdfPath) {
    const absPath = path.resolve(__dirname, "../../uploads", path.basename(pdfPath));
    if (fs.existsSync(absPath)) {
      attachments.push({
        filename: path.basename(pdfPath),
        path: absPath,
      });
    }
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@example.com",
    to,
    subject,
    html,
    attachments,
  });

  console.log(`Email sent to ${to} — messageId: ${info.messageId}`);

  // When using Ethereal, log the preview URL
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`Preview URL: ${previewUrl}`);
  }

  return info;
}
