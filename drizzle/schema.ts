import { mysqlEnum, mysqlTable, text, timestamp, varchar, int, decimal, boolean, index, unique } from "drizzle-orm/mysql-core";

/**
 * Jarvis Database Schema
 * Comprehensive shop management for screen printing and embroidery
 */

// ============================================================================
// USERS TABLE (Core auth)
// ============================================================================

export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// CUSTOMERS
// ============================================================================

export const customers = mysqlTable("customers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  company: text("company"),
  billingAddress: text("billingAddress"), // JSON
  shippingAddress: text("shippingAddress"), // JSON
  notes: text("notes"),
  creditLimit: decimal("creditLimit", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
}, (table) => ({
  emailIdx: unique("email_idx").on(table.email),
}));

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ============================================================================
// QUOTES
// ============================================================================

export const quotes = mysqlTable("quotes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  quoteNumber: int("quoteNumber").notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["quote", "approved", "rejected", "converted"]).default("quote").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).default("0.00"),
  taxAmount: decimal("taxAmount", { precision: 10, scale: 2 }).default("0.00"),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).default("0.00"),
  deliveryMethod: varchar("deliveryMethod", { length: 100 }),
  poNumber: varchar("poNumber", { length: 100 }),
  terms: varchar("terms", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  createdBy: varchar("createdBy", { length: 64 }),
  productionDueDate: timestamp("productionDueDate"),
  customerDueDate: timestamp("customerDueDate"),
  updatedAt: timestamp("updatedAt").defaultNow(),
}, (table) => ({
  quoteNumberIdx: unique("quote_number_idx").on(table.quoteNumber),
  customerIdx: index("quote_customer_idx").on(table.customerId),
  statusIdx: index("quote_status_idx").on(table.status),
}));

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;

// ============================================================================
// INVOICES
// ============================================================================

export const invoices = mysqlTable("invoices", {
  id: varchar("id", { length: 64 }).primaryKey(),
  invoiceNumber: int("invoiceNumber").notNull(),
  quoteId: varchar("quoteId", { length: 64 }),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  status: mysqlEnum("status", [
    "quote",
    "pending",
    "in_production",
    "ready_to_print",
    "ready_to_sew",
    "production_finished",
    "shipped",
    "completed",
    "paid",
    "partial_paid",
    "overdue"
  ]).default("pending").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).default("0.00"),
  paidAmount: decimal("paidAmount", { precision: 10, scale: 2 }).default("0.00"),
  taxAmount: decimal("taxAmount", { precision: 10, scale: 2 }).default("0.00"),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).default("0.00"),
  deliveryMethod: varchar("deliveryMethod", { length: 100 }),
  poNumber: varchar("poNumber", { length: 100 }),
  terms: varchar("terms", { length: 100 }),
  paymentDueDate: timestamp("paymentDueDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  createdBy: varchar("createdBy", { length: 64 }),
  productionDueDate: timestamp("productionDueDate"),
  customerDueDate: timestamp("customerDueDate"),
  updatedAt: timestamp("updatedAt").defaultNow(),
}, (table) => ({
  invoiceNumberIdx: unique("invoice_number_idx").on(table.invoiceNumber),
  customerIdx: index("invoice_customer_idx").on(table.customerId),
  statusIdx: index("invoice_status_idx").on(table.status),
  quoteIdx: index("invoice_quote_idx").on(table.quoteId),
}));

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ============================================================================
// LINE ITEM GROUPS
// ============================================================================

export const lineItemGroups = mysqlTable("lineItemGroups", {
  id: varchar("id", { length: 64 }).primaryKey(),
  quoteId: varchar("quoteId", { length: 64 }),
  invoiceId: varchar("invoiceId", { length: 64 }),
  name: varchar("name", { length: 255 }).notNull(), // e.g., "Screen Print - Front", "Embroidery - Left Chest"
  decorationMethod: varchar("decorationMethod", { length: 100 }), // Screen Print, Embroidery, DTG, Vinyl, Heat Transfer
  notes: text("notes"),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  quoteIdx: index("lineitemgroup_quote_idx").on(table.quoteId),
  invoiceIdx: index("lineitemgroup_invoice_idx").on(table.invoiceId),
}));

export type LineItemGroup = typeof lineItemGroups.$inferSelect;
export type InsertLineItemGroup = typeof lineItemGroups.$inferInsert;

// ============================================================================
// IMPRINTS - Decoration details applied to line item groups
// ============================================================================

export const imprints = mysqlTable("imprints", {
  id: varchar("id", { length: 64 }).primaryKey(),
  groupId: varchar("groupId", { length: 64 }).notNull(),
  location: varchar("location", { length: 100 }), // Front, Back, Left Chest, Right Sleeve, etc.
  decorationMethod: varchar("decorationMethod", { length: 100 }), // Screen Print, Embroidery, DTG, Vinyl, Heat Transfer
  colors: int("colors").default(1), // Number of ink/thread colors
  stitchCount: int("stitchCount"), // For embroidery
  artworkUrl: text("artworkUrl"),
  setupFee: decimal("setupFee", { precision: 10, scale: 2 }).default("0.00"),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0.00"), // Price per item for this imprint
  notes: text("notes"),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  groupIdx: index("imprint_group_idx").on(table.groupId),
}));

export type Imprint = typeof imprints.$inferSelect;
export type InsertImprint = typeof imprints.$inferInsert;

// ============================================================================
// LINE ITEMS
// ============================================================================

export const lineItems = mysqlTable("lineItems", {
  id: varchar("id", { length: 64 }).primaryKey(),
  groupId: varchar("groupId", { length: 64 }), // Reference to lineItemGroups
  quoteId: varchar("quoteId", { length: 64 }),
  invoiceId: varchar("invoiceId", { length: 64 }),
  productId: varchar("productId", { length: 64 }), // Reference to products
  itemNumber: varchar("itemNumber", { length: 100 }),
  description: text("description"),
  color: varchar("color", { length: 100 }),
  // Size breakdown fields (like Printavo) - camelCase property names map to snake_case columns
  size2T: int("size_2T").default(0),
  size3T: int("size_3T").default(0),
  size4T: int("size_4T").default(0),
  size5T: int("size_5T").default(0),
  sizeYXS: int("size_YXS").default(0),
  sizeYS: int("size_YS").default(0),
  sizeYM: int("size_YM").default(0),
  sizeYL: int("size_YL").default(0),
  sizeYXL: int("size_YXL").default(0),
  sizeXS: int("size_XS").default(0),
  sizeS: int("size_S").default(0),
  sizeM: int("size_M").default(0),
  sizeL: int("size_L").default(0),
  sizeXL: int("size_XL").default(0),
  size2XL: int("size_2XL").default(0),
  size3XL: int("size_3XL").default(0),
  size4XL: int("size_4XL").default(0),
  size5XL: int("size_5XL").default(0),
  size6XL: int("size_6XL").default(0),
  sizeOther: int("size_Other").default(0),
  quantity: int("quantity").default(0), // Total quantity (sum of all sizes)
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0.00"),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).default("0.00"),
  artworkUrls: text("artworkUrls"), // JSON array of image URLs
  notes: text("notes"),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  groupIdx: index("lineitem_group_idx").on(table.groupId),
  quoteIdx: index("lineitem_quote_idx").on(table.quoteId),
  invoiceIdx: index("lineitem_invoice_idx").on(table.invoiceId),
  productIdx: index("lineitem_product_idx").on(table.productId),
}));

export type LineItem = typeof lineItems.$inferSelect;
export type InsertLineItem = typeof lineItems.$inferInsert;

// ============================================================================
// TASKS
// ============================================================================

export const tasks = mysqlTable("tasks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name").notNull(),
  invoiceId: varchar("invoiceId", { length: 64 }),
  quoteId: varchar("quoteId", { length: 64 }),
  assignedTo: varchar("assignedTo", { length: 64 }),
  dueDate: timestamp("dueDate"),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completedAt"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  createdBy: varchar("createdBy", { length: 64 }),
}, (table) => ({
  assignedIdx: index("task_assigned_idx").on(table.assignedTo),
  invoiceIdx: index("task_invoice_idx").on(table.invoiceId),
  completedIdx: index("task_completed_idx").on(table.completed),
}));

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ============================================================================
// PAYMENTS
// ============================================================================

export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  invoiceId: varchar("invoiceId", { length: 64 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  paymentDate: timestamp("paymentDate").defaultNow(),
  transactionId: varchar("transactionId", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  createdBy: varchar("createdBy", { length: 64 }),
}, (table) => ({
  invoiceIdx: index("payment_invoice_idx").on(table.invoiceId),
}));

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ============================================================================
// EXPENSES
// ============================================================================

export const expenses = mysqlTable("expenses", {
  id: varchar("id", { length: 64 }).primaryKey(),
  invoiceId: varchar("invoiceId", { length: 64 }), // nullable for shop-wide expenses
  category: varchar("category", { length: 100 }),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  expenseDate: timestamp("expenseDate").defaultNow(),
  vendor: varchar("vendor", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  createdBy: varchar("createdBy", { length: 64 }),
}, (table) => ({
  invoiceIdx: index("expense_invoice_idx").on(table.invoiceId),
}));

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

// ============================================================================
// PRODUCTS
// ============================================================================

export const products = mysqlTable("products", {
  id: varchar("id", { length: 64 }).primaryKey(),
  itemNumber: varchar("itemNumber", { length: 100 }),
  name: text("name").notNull(),
  brand: varchar("brand", { length: 100 }),
  category: varchar("category", { length: 50 }),
  description: text("description"),
  basePrice: decimal("basePrice", { precision: 10, scale: 2 }).default("0.00"),
  colors: text("colors"), // JSON array
  sizes: text("sizes"), // JSON array
  imageUrl: text("imageUrl"),
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  itemNumberIdx: index("product_item_number_idx").on(table.itemNumber),
}));

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ============================================================================
// MESSAGES
// ============================================================================

export const messages = mysqlTable("messages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  invoiceId: varchar("invoiceId", { length: 64 }),
  quoteId: varchar("quoteId", { length: 64 }),
  customerId: varchar("customerId", { length: 64 }),
  fromUserId: varchar("fromUserId", { length: 64 }),
  toEmail: varchar("toEmail", { length: 320 }),
  subject: text("subject"),
  body: text("body"),
  messageType: mysqlEnum("messageType", ["internal", "email", "sms"]).default("internal"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  invoiceIdx: index("message_invoice_idx").on(table.invoiceId),
  quoteIdx: index("message_quote_idx").on(table.quoteId),
  customerIdx: index("message_customer_idx").on(table.customerId),
}));

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ============================================================================
// ACTIVITY LOG
// ============================================================================

export const activityLog = mysqlTable("activityLog", {
  id: varchar("id", { length: 64 }).primaryKey(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  description: text("description"),
  userId: varchar("userId", { length: 64 }),
  metadata: text("metadata"), // JSON
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  entityIdx: index("activity_entity_idx").on(table.entityType, table.entityId),
}));

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

