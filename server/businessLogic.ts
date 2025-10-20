/**
 * Business Logic Service
 * 
 * Core business rules and workflows for the print shop
 */

import * as db from "./db";
import { sendPaymentReminderEmail } from "./email";

// ============================================================================
// QUOTE WORKFLOW
// ============================================================================

/**
 * Quote statuses and their transitions
 */
export const QUOTE_STATUSES = {
  DRAFT: "draft",
  SENT: "sent",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
  CONVERTED: "converted", // Converted to invoice
} as const;

export type QuoteStatus = typeof QUOTE_STATUSES[keyof typeof QUOTE_STATUSES];

/**
 * Check if a quote has expired (30 days from creation)
 */
export function isQuoteExpired(createdAt: Date): boolean {
  const now = new Date();
  const expirationDate = new Date(createdAt);
  expirationDate.setDate(expirationDate.getDate() + 30);
  return now > expirationDate;
}

/**
 * Update expired quotes to expired status
 */
export async function updateExpiredQuotes() {
  const quotes = await db.getAllQuotes();
  const updates: Promise<any>[] = [];

  for (const quote of quotes) {
    if (
      quote.createdAt &&
      (quote.status === QUOTE_STATUSES.SENT || quote.status === QUOTE_STATUSES.DRAFT) &&
      isQuoteExpired(quote.createdAt)
    ) {
      updates.push(
        db.updateQuote(quote.id, { status: QUOTE_STATUSES.EXPIRED })
      );
    }
  }

  return Promise.all(updates);
}

/**
 * Approve a quote and optionally create production tasks
 */
export async function approveQuote(
  quoteId: string,
  createTasks: boolean = true
) {
  // Update quote status
  await db.updateQuote(quoteId, { status: QUOTE_STATUSES.APPROVED });

  // Create production tasks if requested
  if (createTasks) {
    const quote = await db.getQuote(quoteId);
    if (!quote) throw new Error("Quote not found");

    const lineItemGroups = await db.getLineItemGroupsByQuote(quoteId);

    for (const group of lineItemGroups) {
      // Create a task for each line item group
      await db.createTask({
        title: `Production: ${group.name}`,
        description: `Quote #${quote.quoteNumber} - ${group.name}`,
        status: "pending",
        priority: "medium",
        dueDate: quote.dueDate,
      });
    }
  }

  // Log activity
  await logActivity({
    entityType: "quote",
    entityId: quoteId,
    action: "approved",
    description: `Quote #${(await db.getQuote(quoteId))?.quoteNumber} approved`,
  });

  return { success: true };
}

/**
 * Reject a quote with reason
 */
export async function rejectQuote(quoteId: string, reason?: string) {
  await db.updateQuote(quoteId, { 
    status: QUOTE_STATUSES.REJECTED,
    notes: reason ? `Rejected: ${reason}` : undefined,
  });

  await logActivity({
    entityType: "quote",
    entityId: quoteId,
    action: "rejected",
    description: `Quote #${(await db.getQuote(quoteId))?.quoteNumber} rejected${reason ? `: ${reason}` : ""}`,
  });

  return { success: true };
}

// ============================================================================
// INVOICE WORKFLOW
// ============================================================================

/**
 * Invoice statuses and their transitions
 */
export const INVOICE_STATUSES = {
  DRAFT: "draft",
  PENDING: "pending",
  PAID: "paid",
  PARTIAL: "partial",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
} as const;

export type InvoiceStatus = typeof INVOICE_STATUSES[keyof typeof INVOICE_STATUSES];

/**
 * Check if an invoice is overdue
 */
export function isInvoiceOverdue(dueDate: Date | null, status: string): boolean {
  if (!dueDate) return false;
  if (status === INVOICE_STATUSES.PAID || status === INVOICE_STATUSES.CANCELLED) {
    return false;
  }
  const now = new Date();
  return now > new Date(dueDate);
}

/**
 * Calculate invoice balance
 */
export function calculateInvoiceBalance(
  totalAmount: string | null,
  paidAmount: string | null
): number {
  const total = parseFloat(totalAmount || "0");
  const paid = parseFloat(paidAmount || "0");
  return total - paid;
}

/**
 * Record a payment on an invoice
 */
export async function recordPayment(
  invoiceId: string,
  amount: number,
  paymentMethod: string,
  notes?: string
) {
  const invoice = await db.getInvoice(invoiceId);
  if (!invoice) throw new Error("Invoice not found");

  const currentPaid = parseFloat(invoice.paidAmount || "0");
  const newPaid = currentPaid + amount;
  const total = parseFloat(invoice.totalAmount || "0");

  // Determine new status
  let newStatus: InvoiceStatus;
  if (newPaid >= total) {
    newStatus = INVOICE_STATUSES.PAID;
  } else if (newPaid > 0) {
    newStatus = INVOICE_STATUSES.PARTIAL;
  } else {
    newStatus = invoice.status as InvoiceStatus;
  }

  // Update invoice
  await db.updateInvoice(invoiceId, {
    paidAmount: newPaid.toFixed(2),
    status: newStatus,
  });

  // Record payment
  await db.createPayment({
    invoiceId,
    amount: amount.toFixed(2),
    paymentMethod,
    paymentDate: new Date(),
    notes,
  });

  // Log activity
  await logActivity({
    entityType: "invoice",
    entityId: invoiceId,
    action: "payment_recorded",
    description: `Payment of $${amount.toFixed(2)} recorded for Invoice #${invoice.invoiceNumber}`,
  });

  return { success: true, newStatus, balance: total - newPaid };
}

/**
 * Update overdue invoices
 */
export async function updateOverdueInvoices() {
  const invoices = await db.getAllInvoices();
  const updates: Promise<any>[] = [];

  for (const invoice of invoices) {
    if (
      invoice.dueDate &&
      invoice.status !== INVOICE_STATUSES.PAID &&
      invoice.status !== INVOICE_STATUSES.CANCELLED &&
      isInvoiceOverdue(invoice.dueDate, invoice.status)
    ) {
      updates.push(
        db.updateInvoice(invoice.id, { status: INVOICE_STATUSES.OVERDUE })
      );
    }
  }

  return Promise.all(updates);
}

/**
 * Send payment reminders for overdue invoices
 */
export async function sendOverdueReminders() {
  const invoices = await db.getAllInvoices();
  const reminders: Promise<any>[] = [];

  for (const invoice of invoices) {
    if (invoice.status === INVOICE_STATUSES.OVERDUE) {
      const customer = await db.getCustomer(invoice.customerId);
      if (customer?.email) {
        const balance = calculateInvoiceBalance(
          invoice.totalAmount,
          invoice.paidAmount
        );

        reminders.push(
          sendPaymentReminderEmail(
            customer.email,
            invoice.invoiceNumber,
            customer.name,
            balance.toFixed(2),
            invoice.dueDate ? invoice.dueDate.toISOString() : null
          )
        );
      }
    }
  }

  return Promise.all(reminders);
}

// ============================================================================
// CUSTOMER CREDIT MANAGEMENT
// ============================================================================

/**
 * Calculate customer's outstanding balance
 */
export async function getCustomerOutstandingBalance(customerId: string): Promise<number> {
  const invoices = await db.getInvoicesByCustomer(customerId);
  
  let outstanding = 0;
  for (const invoice of invoices) {
    if (
      invoice.status !== INVOICE_STATUSES.PAID &&
      invoice.status !== INVOICE_STATUSES.CANCELLED
    ) {
      outstanding += calculateInvoiceBalance(
        invoice.totalAmount,
        invoice.paidAmount
      );
    }
  }

  return outstanding;
}

/**
 * Check if customer has exceeded credit limit
 */
export async function checkCreditLimit(
  customerId: string,
  additionalAmount: number
): Promise<{ allowed: boolean; outstanding: number; limit: number }> {
  const customer = await db.getCustomer(customerId);
  if (!customer) throw new Error("Customer not found");

  const creditLimit = parseFloat(customer.creditLimit || "0");
  const outstanding = await getCustomerOutstandingBalance(customerId);
  const newTotal = outstanding + additionalAmount;

  return {
    allowed: creditLimit === 0 || newTotal <= creditLimit,
    outstanding,
    limit: creditLimit,
  };
}

// ============================================================================
// DISCOUNT & TAX CALCULATIONS
// ============================================================================

/**
 * Apply discount to amount
 */
export function applyDiscount(
  amount: number,
  discountType: "percentage" | "fixed",
  discountValue: number
): number {
  if (discountType === "percentage") {
    return amount * (1 - discountValue / 100);
  } else {
    return Math.max(0, amount - discountValue);
  }
}

/**
 * Calculate tax
 */
export function calculateTax(amount: number, taxRate: number): number {
  return amount * (taxRate / 100);
}

/**
 * Calculate quote/invoice total with discounts and tax
 */
export function calculateTotalWithDiscountAndTax(
  subtotal: number,
  discountType: "percentage" | "fixed" | null,
  discountValue: number,
  taxRate: number
): {
  subtotal: number;
  discount: number;
  subtotalAfterDiscount: number;
  tax: number;
  total: number;
} {
  const discount =
    discountType && discountValue > 0
      ? subtotal - applyDiscount(subtotal, discountType, discountValue)
      : 0;

  const subtotalAfterDiscount = subtotal - discount;
  const tax = calculateTax(subtotalAfterDiscount, taxRate);
  const total = subtotalAfterDiscount + tax;

  return {
    subtotal,
    discount,
    subtotalAfterDiscount,
    tax,
    total,
  };
}

// ============================================================================
// ACTIVITY LOGGING
// ============================================================================

interface ActivityLog {
  entityType: "quote" | "invoice" | "customer" | "product" | "task";
  entityId: string;
  action: string;
  description: string;
  userId?: string;
}

/**
 * Log an activity
 */
export async function logActivity(activity: ActivityLog) {
  return db.logActivity({
    ...activity,
    timestamp: new Date(),
  });
}

/**
 * Get activity log for an entity
 */
export async function getActivityLog(
  entityType: string,
  entityId: string
) {
  return db.getActivityLogByEntity(entityType, entityId);
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

interface Notification {
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Get pending notifications for user
 */
export async function getPendingNotifications(): Promise<Notification[]> {
  const notifications: Notification[] = [];

  // Check for expiring quotes (within 7 days)
  const quotes = await db.getAllQuotes();
  for (const quote of quotes) {
    if (quote.createdAt && quote.status === QUOTE_STATUSES.SENT) {
      const expirationDate = new Date(quote.createdAt);
      expirationDate.setDate(expirationDate.getDate() + 30);
      const daysUntilExpiration = Math.ceil(
        (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiration <= 7 && daysUntilExpiration > 0) {
        notifications.push({
          type: "warning",
          title: "Quote Expiring Soon",
          message: `Quote #${quote.quoteNumber} expires in ${daysUntilExpiration} days`,
          entityType: "quote",
          entityId: quote.id,
        });
      }
    }
  }

  // Check for overdue invoices
  const invoices = await db.getAllInvoices();
  for (const invoice of invoices) {
    if (invoice.status === INVOICE_STATUSES.OVERDUE) {
      const customer = await db.getCustomer(invoice.customerId);
      notifications.push({
        type: "error",
        title: "Invoice Overdue",
        message: `Invoice #${invoice.invoiceNumber} for ${customer?.name} is overdue`,
        entityType: "invoice",
        entityId: invoice.id,
      });
    }
  }

  // Check for pending tasks
  const tasks = await db.getAllTasks();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const task of tasks) {
    if (task.status === "pending" && task.dueDate) {
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate <= today) {
        notifications.push({
          type: "warning",
          title: "Task Due",
          message: `Task "${task.title}" is due`,
          entityType: "task",
          entityId: task.id,
        });
      }
    }
  }

  return notifications;
}

// ============================================================================
// SCHEDULED JOBS
// ============================================================================

/**
 * Run daily maintenance tasks
 * Should be called by a cron job or scheduler
 */
export async function runDailyMaintenance() {
  console.log("🔄 Running daily maintenance...");

  try {
    // Update expired quotes
    await updateExpiredQuotes();
    console.log("✅ Updated expired quotes");

    // Update overdue invoices
    await updateOverdueInvoices();
    console.log("✅ Updated overdue invoices");

    // Send payment reminders
    await sendOverdueReminders();
    console.log("✅ Sent payment reminders");

    console.log("✅ Daily maintenance complete");
  } catch (error) {
    console.error("❌ Daily maintenance failed:", error);
    throw error;
  }
}

/**
 * Run weekly reports
 * Should be called by a cron job or scheduler
 */
export async function runWeeklyReports() {
  console.log("📊 Running weekly reports...");

  // Calculate weekly revenue
  const invoices = await db.getAllInvoices();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const weeklyRevenue = invoices
    .filter(
      (inv) =>
        inv.status === INVOICE_STATUSES.PAID &&
        inv.createdAt &&
        new Date(inv.createdAt) >= weekAgo
    )
    .reduce((sum, inv) => sum + parseFloat(inv.totalAmount || "0"), 0);

  console.log(`💰 Weekly revenue: $${weeklyRevenue.toFixed(2)}`);

  // Count new quotes
  const quotes = await db.getAllQuotes();
  const newQuotes = quotes.filter(
    (q) => q.createdAt && new Date(q.createdAt) >= weekAgo
  ).length;

  console.log(`📝 New quotes: ${newQuotes}`);

  return {
    weeklyRevenue,
    newQuotes,
    period: { start: weekAgo, end: new Date() },
  };
}

