/**
 * Email Service
 * 
 * Send quotes and invoices via email with PDF attachments
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

// Email configuration from environment variables
// For production, use environment variables
// For development, you can use a service like Ethereal Email (https://ethereal.email)
const emailConfig: EmailConfig = {
  host: process.env.EMAIL_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASS || "",
  },
};

let transporter: Transporter | null = null;

/**
 * Initialize email transporter
 */
export async function initEmailTransporter() {
  if (transporter) return transporter;

  // If no email credentials are provided, create a test account
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.log("⚠️  No email credentials found. Creating test account...");
    const testAccount = await nodemailer.createTestAccount();
    emailConfig.host = "smtp.ethereal.email";
    emailConfig.port = 587;
    emailConfig.secure = false;
    emailConfig.auth.user = testAccount.user;
    emailConfig.auth.pass = testAccount.pass;
    console.log("✅ Test email account created:");
    console.log(`   User: ${testAccount.user}`);
    console.log(`   Pass: ${testAccount.pass}`);
    console.log(`   Preview emails at: https://ethereal.email`);
  }

  transporter = nodemailer.createTransport(emailConfig);

  // Verify connection
  try {
    await transporter.verify();
    console.log("✅ Email service ready");
  } catch (error) {
    console.error("❌ Email service error:", error);
    transporter = null;
    throw error;
  }

  return transporter;
}

/**
 * Send an email
 */
export async function sendEmail(options: SendEmailOptions) {
  const transport = await initEmailTransporter();
  
  const info = await transport.sendMail({
    from: `"${process.env.COMPANY_NAME || "Jarvis Print Shop"}" <${emailConfig.auth.user}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments,
  });

  console.log("📧 Email sent:", info.messageId);
  
  // For test accounts, log the preview URL
  if (emailConfig.host === "smtp.ethereal.email") {
    console.log("📧 Preview URL:", nodemailer.getTestMessageUrl(info));
  }

  return info;
}

/**
 * Send a quote via email
 */
export async function sendQuoteEmail(
  to: string,
  quoteNumber: number,
  customerName: string,
  total: string,
  pdfBuffer?: Buffer
) {
  const subject = `Quote #${quoteNumber} from ${process.env.COMPANY_NAME || "Jarvis Print Shop"}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .total { font-size: 24px; font-weight: bold; color: #2563eb; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Quote #${quoteNumber}</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          
          <p>Thank you for your interest! Please find attached your quote for the requested items.</p>
          
          <div class="total">Total: ${total}</div>
          
          <p>This quote is valid for 30 days from the date of issue. If you have any questions or would like to proceed with this order, please don't hesitate to contact us.</p>
          
          <p>To approve this quote and proceed with production, simply reply to this email or give us a call.</p>
          
          <p>We look forward to working with you!</p>
          
          <p>Best regards,<br>
          ${process.env.COMPANY_NAME || "Jarvis Print Shop"}<br>
          ${process.env.COMPANY_PHONE || "(555) 123-4567"}<br>
          ${process.env.COMPANY_EMAIL || "info@yourprintshop.com"}</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const attachments = pdfBuffer
    ? [
        {
          filename: `Quote_${quoteNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ]
    : [];

  return sendEmail({ to, subject, html, attachments });
}

/**
 * Send an invoice via email
 */
export async function sendInvoiceEmail(
  to: string,
  invoiceNumber: number,
  customerName: string,
  total: string,
  dueDate: string | null,
  pdfBuffer?: Buffer
) {
  const subject = `Invoice #${invoiceNumber} from ${process.env.COMPANY_NAME || "Jarvis Print Shop"}`;
  
  const dueDateText = dueDate 
    ? `<p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>`
    : "";
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .total { font-size: 24px; font-weight: bold; color: #16a34a; margin: 20px 0; }
        .due-date { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Invoice #${invoiceNumber}</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          
          <p>Thank you for your business! Please find attached your invoice for the completed work.</p>
          
          <div class="total">Amount Due: ${total}</div>
          
          ${dueDateText ? `<div class="due-date">${dueDateText}</div>` : ""}
          
          <p>Payment can be made via:</p>
          <ul>
            <li>Check or Cash (in person)</li>
            <li>Bank Transfer</li>
            <li>Credit Card (call us)</li>
          </ul>
          
          <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
          
          <p>Thank you for your business!</p>
          
          <p>Best regards,<br>
          ${process.env.COMPANY_NAME || "Jarvis Print Shop"}<br>
          ${process.env.COMPANY_PHONE || "(555) 123-4567"}<br>
          ${process.env.COMPANY_EMAIL || "info@yourprintshop.com"}</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const attachments = pdfBuffer
    ? [
        {
          filename: `Invoice_${invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ]
    : [];

  return sendEmail({ to, subject, html, attachments });
}

/**
 * Send a payment reminder
 */
export async function sendPaymentReminderEmail(
  to: string,
  invoiceNumber: number,
  customerName: string,
  amountDue: string,
  dueDate: string | null
) {
  const subject = `Payment Reminder: Invoice #${invoiceNumber}`;
  
  const dueDateText = dueDate 
    ? `This invoice was due on ${new Date(dueDate).toLocaleDateString()}.`
    : "This invoice is now overdue.";
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .amount { font-size: 24px; font-weight: bold; color: #dc2626; margin: 20px 0; }
        .urgent { background: #fee2e2; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Reminder</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          
          <p>This is a friendly reminder that we have not yet received payment for Invoice #${invoiceNumber}.</p>
          
          <div class="urgent">
            <strong>Amount Due:</strong>
            <div class="amount">${amountDue}</div>
            <p>${dueDateText}</p>
          </div>
          
          <p>If you have already sent payment, please disregard this reminder. Otherwise, please submit payment at your earliest convenience.</p>
          
          <p>If you have any questions or concerns about this invoice, please contact us immediately so we can assist you.</p>
          
          <p>Thank you for your prompt attention to this matter.</p>
          
          <p>Best regards,<br>
          ${process.env.COMPANY_NAME || "Jarvis Print Shop"}<br>
          ${process.env.COMPANY_PHONE || "(555) 123-4567"}<br>
          ${process.env.COMPANY_EMAIL || "info@yourprintshop.com"}</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
}

