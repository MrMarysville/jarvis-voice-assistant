import { eq, desc, and, or, gte, lte, sql, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  customers,
  InsertCustomer,
  Customer,
  quotes,
  InsertQuote,
  Quote,
  invoices,
  InsertInvoice,
  Invoice,
  lineItemGroups,
  InsertLineItemGroup,
  LineItemGroup,
  lineItems,
  InsertLineItem,
  LineItem,
  imprints,
  InsertImprint,
  Imprint,
  tasks,
  InsertTask,
  Task,
  payments,
  InsertPayment,
  Payment,
  expenses,
  InsertExpense,
  Expense,
  products,
  InsertProduct,
  Product,
  messages,
  InsertMessage,
  Message,
  activityLog,
  InsertActivityLog,
  ActivityLog,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// USERS
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      id: user.id,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role === undefined) {
      if (user.id === ENV.ownerId) {
        user.role = "admin";
        values.role = "admin";
        updateSet.role = "admin";
      }
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

// ============================================================================
// CUSTOMERS
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function createCustomer(customer: Omit<InsertCustomer, "id">): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = generateId("cust");
  const newCustomer: InsertCustomer = {
    ...customer,
    id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(customers).values(newCustomer);
  return (await db.select().from(customers).where(eq(customers.id, id)).limit(1))[0];
}

export async function updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(customers).set({ ...updates, updatedAt: new Date() }).where(eq(customers.id, id));
  return getCustomer(id);
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(customers).where(eq(customers.id, id));
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0];
}

export async function getCustomerByEmail(email: string): Promise<Customer | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
  return result[0];
}

export async function getAllCustomers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(customers).orderBy(desc(customers.createdAt));
}

export async function getCustomerByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;

  const results = await db
    .select()
    .from(customers)
    .where(eq(customers.name, name))
    .limit(1);

  return results.length > 0 ? results[0] : undefined;
}

export async function searchCustomers(query: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(customers)
    .where(
      or(
        like(customers.name, `%${query}%`),
        like(customers.email, `%${query}%`),
        like(customers.company, `%${query}%`)
      )
    )
    .orderBy(desc(customers.createdAt));
}

// ============================================================================
// QUOTES
// ============================================================================

export async function getNextQuoteNumber(): Promise<number> {
  const db = await getDb();
  if (!db) return 1;

  const result = await db.select({ maxNum: sql<number>`MAX(${quotes.quoteNumber})` }).from(quotes);
  return (result[0]?.maxNum || 0) + 1;
}

export async function createQuote(quote: Omit<InsertQuote, "id" | "quoteNumber">): Promise<Quote> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = generateId("quote");
  const quoteNumber = await getNextQuoteNumber();

  const newQuote: InsertQuote = {
    ...quote,
    id,
    quoteNumber,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(quotes).values(newQuote);
  return (await db.select().from(quotes).where(eq(quotes.id, id)).limit(1))[0];
}

export async function updateQuote(id: string, updates: Partial<InsertQuote>): Promise<Quote | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(quotes).set({ ...updates, updatedAt: new Date() }).where(eq(quotes.id, id));
  return getQuote(id);
}

export async function getQuote(id: string): Promise<Quote | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  return result[0];
}

export async function getQuotesByCustomer(customerId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(quotes).where(eq(quotes.customerId, customerId)).orderBy(desc(quotes.createdAt));
}

export async function getAllQuotes() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(quotes).orderBy(desc(quotes.createdAt));
}

export async function deleteQuote(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete line items first
  await db.delete(lineItems).where(eq(lineItems.quoteId, id));

  // Delete line item groups and imprints
  const groups = await db.select().from(lineItemGroups).where(eq(lineItemGroups.quoteId, id));
  for (const group of groups) {
    await db.delete(imprints).where(eq(imprints.groupId, group.id));
  }
  await db.delete(lineItemGroups).where(eq(lineItemGroups.quoteId, id));

  // Delete the quote
  await db.delete(quotes).where(eq(quotes.id, id));
}

export async function getQuotesByStatus(status: Quote["status"]) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(quotes).where(eq(quotes.status, status)).orderBy(desc(quotes.createdAt));
}

// ============================================================================
// INVOICES
// ============================================================================

export async function getNextInvoiceNumber(): Promise<number> {
  const db = await getDb();
  if (!db) return 1;

  const result = await db.select({ maxNum: sql<number>`MAX(${invoices.invoiceNumber})` }).from(invoices);
  return (result[0]?.maxNum || 0) + 1;
}

export async function createInvoice(invoice: Omit<InsertInvoice, "id" | "invoiceNumber">): Promise<Invoice> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = generateId("inv");
  const invoiceNumber = await getNextInvoiceNumber();

  const newInvoice: InsertInvoice = {
    ...invoice,
    id,
    invoiceNumber,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(invoices).values(newInvoice);
  return (await db.select().from(invoices).where(eq(invoices.id, id)).limit(1))[0];
}

export async function updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(invoices).set({ ...updates, updatedAt: new Date() }).where(eq(invoices.id, id));
  return getInvoice(id);
}

export async function getInvoice(id: string): Promise<Invoice | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return result[0];
}

export async function getInvoicesByCustomer(customerId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(invoices).where(eq(invoices.customerId, customerId)).orderBy(desc(invoices.createdAt));
}

export async function getAllInvoices() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
}

export async function getInvoicesByStatus(status: Invoice["status"]) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(invoices).where(eq(invoices.status, status)).orderBy(desc(invoices.createdAt));
}

export async function getInvoicesByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(invoices)
    .where(and(gte(invoices.createdAt, startDate), lte(invoices.createdAt, endDate)))
    .orderBy(desc(invoices.createdAt));
}

// ============================================================================
// LINE ITEMS
// ============================================================================

export async function createLineItem(item: Omit<InsertLineItem, "id">): Promise<LineItem> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = generateId("item");
  const newItem: InsertLineItem = {
    ...item,
    id,
    createdAt: new Date(),
  };

  await db.insert(lineItems).values(newItem);
  return (await db.select().from(lineItems).where(eq(lineItems.id, id)).limit(1))[0];
}

export async function updateLineItem(id: string, updates: Partial<InsertLineItem>): Promise<LineItem | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(lineItems).set(updates).where(eq(lineItems.id, id));
  return getLineItem(id);
}

export async function getLineItem(id: string): Promise<LineItem | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(lineItems).where(eq(lineItems.id, id)).limit(1);
  return result[0];
}

export async function getLineItemsByQuote(quoteId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(lineItems).where(eq(lineItems.quoteId, quoteId));
}

export async function getLineItemsByInvoice(invoiceId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(lineItems).where(eq(lineItems.invoiceId, invoiceId));
}

export async function deleteLineItem(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(lineItems).where(eq(lineItems.id, id));
}

// ============================================================================
// TASKS
// ============================================================================

export async function createTask(task: Omit<InsertTask, "id">): Promise<Task> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = generateId("task");
  const newTask: InsertTask = {
    ...task,
    id,
    createdAt: new Date(),
  };

  await db.insert(tasks).values(newTask);
  return (await db.select().from(tasks).where(eq(tasks.id, id)).limit(1))[0];
}

export async function updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(tasks).set(updates).where(eq(tasks.id, id));
  return getTask(id);
}

export async function getTask(id: string): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0];
}

export async function getTasksByInvoice(invoiceId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(tasks).where(eq(tasks.invoiceId, invoiceId)).orderBy(desc(tasks.createdAt));
}

export async function getTasksByUser(userId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(tasks).where(eq(tasks.assignedTo, userId)).orderBy(desc(tasks.dueDate));
}

export async function getPendingTasks() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(tasks).where(eq(tasks.completed, false)).orderBy(desc(tasks.dueDate));
}

export async function deleteTask(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(tasks).where(eq(tasks.id, id));
}

// ============================================================================
// PAYMENTS
// ============================================================================

export async function createPayment(payment: Omit<InsertPayment, "id">): Promise<Payment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = generateId("pay");
  const newPayment: InsertPayment = {
    ...payment,
    id,
    createdAt: new Date(),
  };

  await db.insert(payments).values(newPayment);
  return (await db.select().from(payments).where(eq(payments.id, id)).limit(1))[0];
}

export async function getPaymentsByInvoice(invoiceId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(payments).where(eq(payments.invoiceId, invoiceId)).orderBy(desc(payments.createdAt));
}

export async function deletePayment(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(payments).where(eq(payments.id, id));
}

// ============================================================================
// EXPENSES
// ============================================================================

export async function createExpense(expense: Omit<InsertExpense, "id">): Promise<Expense> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = generateId("exp");
  const newExpense: InsertExpense = {
    ...expense,
    id,
    createdAt: new Date(),
  };

  await db.insert(expenses).values(newExpense);
  return (await db.select().from(expenses).where(eq(expenses.id, id)).limit(1))[0];
}

export async function getExpensesByInvoice(invoiceId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(expenses).where(eq(expenses.invoiceId, invoiceId)).orderBy(desc(expenses.createdAt));
}

export async function getAllExpenses() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(expenses).orderBy(desc(expenses.createdAt));
}

export async function deleteExpense(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(expenses).where(eq(expenses.id, id));
}

// ============================================================================
// PRODUCTS
// ============================================================================

export async function createProduct(product: Omit<InsertProduct, "id">): Promise<Product> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = generateId("prod");
  const newProduct: InsertProduct = {
    ...product,
    id,
    createdAt: new Date(),
  };

  await db.insert(products).values(newProduct);
  return (await db.select().from(products).where(eq(products.id, id)).limit(1))[0];
}

export async function updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(products).set(updates).where(eq(products.id, id));
  return getProduct(id);
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function getAllProducts() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(products).where(eq(products.active, true)).orderBy(desc(products.createdAt));
}

export async function searchProducts(query: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.active, true),
        or(like(products.name, `%${query}%`), like(products.itemNumber, `%${query}%`), like(products.brand, `%${query}%`))
      )
    )
    .orderBy(desc(products.createdAt));
}

// ============================================================================
// MESSAGES
// ============================================================================

export async function createMessage(message: Omit<InsertMessage, "id">): Promise<Message> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = generateId("msg");
  const newMessage: InsertMessage = {
    ...message,
    id,
    createdAt: new Date(),
  };

  await db.insert(messages).values(newMessage);
  return (await db.select().from(messages).where(eq(messages.id, id)).limit(1))[0];
}

export async function getMessagesByInvoice(invoiceId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(messages).where(eq(messages.invoiceId, invoiceId)).orderBy(desc(messages.createdAt));
}

export async function getMessagesByCustomer(customerId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(messages).where(eq(messages.customerId, customerId)).orderBy(desc(messages.createdAt));
}

// ============================================================================
// ACTIVITY LOG
// ============================================================================

export async function logActivity(log: Omit<InsertActivityLog, "id">): Promise<ActivityLog> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = generateId("log");
  const newLog: InsertActivityLog = {
    ...log,
    id,
    createdAt: new Date(),
  };

  await db.insert(activityLog).values(newLog);
  return (await db.select().from(activityLog).where(eq(activityLog.id, id)).limit(1))[0];
}

export async function getActivityByEntity(entityType: string, entityId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(activityLog)
    .where(and(eq(activityLog.entityType, entityType), eq(activityLog.entityId, entityId)))
    .orderBy(desc(activityLog.createdAt));
}


// ============================================================================
// LINE ITEM GROUPS
// ============================================================================

export async function createLineItemGroup(group: Omit<InsertLineItemGroup, "id">): Promise<LineItemGroup> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = generateId("lig");
  const newGroup: InsertLineItemGroup = {
    ...group,
    id,
    createdAt: new Date(),
  };

  await db.insert(lineItemGroups).values(newGroup);
  return (await db.select().from(lineItemGroups).where(eq(lineItemGroups.id, id)).limit(1))[0];
}

export async function getLineItemGroup(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [group] = await db.select().from(lineItemGroups).where(eq(lineItemGroups.id, id));
  return group;
}

export async function getLineItemGroupsByQuote(quoteId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lineItemGroups).where(eq(lineItemGroups.quoteId, quoteId)).orderBy(lineItemGroups.sortOrder);
}

export async function getLineItemGroupsByInvoice(invoiceId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lineItemGroups).where(eq(lineItemGroups.invoiceId, invoiceId)).orderBy(lineItemGroups.sortOrder);
}

export async function updateLineItemGroup(id: string, data: Partial<InsertLineItemGroup>) {
  const db = await getDb();
  if (!db) return;
  await db.update(lineItemGroups).set(data).where(eq(lineItemGroups.id, id));
}

export async function deleteLineItemGroup(id: string) {
  const db = await getDb();
  if (!db) return;
  // Delete all line items in this group first
  await db.delete(lineItems).where(eq(lineItems.groupId, id));
  await db.delete(lineItemGroups).where(eq(lineItemGroups.id, id));
}

// ============================================================================
// LINE ITEMS (updated for groups)
// ============================================================================

export async function getLineItemsByGroup(groupId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lineItems).where(eq(lineItems.groupId, groupId)).orderBy(lineItems.sortOrder);
}

export async function createLineItemInGroup(item: Omit<InsertLineItem, "id">): Promise<LineItem> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = generateId("li");
  const newItem: InsertLineItem = {
    ...item,
    id,
    createdAt: new Date(),
  };

  await db.insert(lineItems).values(newItem);
  return (await db.select().from(lineItems).where(eq(lineItems.id, id)).limit(1))[0];
}

export async function updateLineItemInGroup(id: string, data: Partial<InsertLineItem>) {
  const db = await getDb();
  if (!db) return;
  await db.update(lineItems).set(data).where(eq(lineItems.id, id));
}

export async function deleteLineItemFromGroup(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(lineItems).where(eq(lineItems.id, id));
}



// ============================================================================
// IMPRINTS
// ============================================================================

export async function createImprint(imprint: Omit<InsertImprint, 'id'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const id = `imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await db.insert(imprints).values({ ...imprint, id });
  return id;
}

export async function getImprintsByGroup(groupId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(imprints)
    .where(eq(imprints.groupId, groupId))
    .orderBy(imprints.sortOrder);
}

export async function updateImprint(id: string, data: Partial<InsertImprint>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(imprints).set(data).where(eq(imprints.id, id));
}

export async function deleteImprint(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(imprints).where(eq(imprints.id, id));
}




// ============================================================================
// TOTAL RECALCULATION FUNCTIONS
// ============================================================================

export async function recalculateQuoteTotal(quoteId: string) {
  const db = await getDb();
  if (!db) return;

  // Get all line item groups for this quote
  const groups = await db.select().from(lineItemGroups).where(eq(lineItemGroups.quoteId, quoteId));
  
  let total = 0;
  
  for (const group of groups) {
    // Get all products in this group
    const products = await db.select().from(lineItems).where(eq(lineItems.groupId, group.id));
    
    // Calculate product totals
    for (const product of products) {
      const qty = (product.size2T || 0) + (product.size3T || 0) + (product.size4T || 0) + (product.size5T || 0) +
                  (product.sizeYXS || 0) + (product.sizeYS || 0) + (product.sizeYM || 0) + (product.sizeYL || 0) + (product.sizeYXL || 0) +
                  (product.sizeXS || 0) + (product.sizeS || 0) + (product.sizeM || 0) + (product.sizeL || 0) +
                  (product.sizeXL || 0) + (product.size2XL || 0) + (product.size3XL || 0) + (product.size4XL || 0) +
                  (product.size5XL || 0) + (product.size6XL || 0);
      
      const unitPrice = parseFloat(product.unitPrice || '0');
      total += qty * unitPrice;
    }
    
    // Get all imprints for this group
    const imprintsList = await db.select().from(imprints).where(eq(imprints.groupId, group.id));
    
    // Calculate total quantity for this group (for imprint costs)
    const totalQty = products.reduce((sum, product) => {
      return sum + (product.size2T || 0) + (product.size3T || 0) + (product.size4T || 0) + (product.size5T || 0) +
                   (product.sizeYXS || 0) + (product.sizeYS || 0) + (product.sizeYM || 0) + (product.sizeYL || 0) + (product.sizeYXL || 0) +
                   (product.sizeXS || 0) + (product.sizeS || 0) + (product.sizeM || 0) + (product.sizeL || 0) +
                   (product.sizeXL || 0) + (product.size2XL || 0) + (product.size3XL || 0) + (product.size4XL || 0) +
                   (product.size5XL || 0) + (product.size6XL || 0);
    }, 0);
    
    // Add imprint costs
    for (const imprint of imprintsList) {
      const setupFee = parseFloat(imprint.setupFee || '0');
      const perItemCost = parseFloat(imprint.unitPrice || '0');
      total += setupFee + (perItemCost * totalQty);
    }
  }
  
  // Update the quote total
  await db.update(quotes).set({ totalAmount: total.toFixed(2) }).where(eq(quotes.id, quoteId));
  
  return total;
}

export async function recalculateInvoiceTotal(invoiceId: string) {
  const db = await getDb();
  if (!db) return;

  // Get all line item groups for this invoice
  const groups = await db.select().from(lineItemGroups).where(eq(lineItemGroups.invoiceId, invoiceId));
  
  let total = 0;
  
  for (const group of groups) {
    // Get all products in this group
    const products = await db.select().from(lineItems).where(eq(lineItems.groupId, group.id));
    
    // Calculate product totals
    for (const product of products) {
      const qty = (product.size2T || 0) + (product.size3T || 0) + (product.size4T || 0) + (product.size5T || 0) +
                  (product.sizeYXS || 0) + (product.sizeYS || 0) + (product.sizeYM || 0) + (product.sizeYL || 0) + (product.sizeYXL || 0) +
                  (product.sizeXS || 0) + (product.sizeS || 0) + (product.sizeM || 0) + (product.sizeL || 0) +
                  (product.sizeXL || 0) + (product.size2XL || 0) + (product.size3XL || 0) + (product.size4XL || 0) +
                  (product.size5XL || 0) + (product.size6XL || 0);
      
      const unitPrice = parseFloat(product.unitPrice || '0');
      total += qty * unitPrice;
    }
    
    // Get all imprints for this group
    const imprintsList = await db.select().from(imprints).where(eq(imprints.groupId, group.id));
    
    // Calculate total quantity for this group (for imprint costs)
    const totalQty = products.reduce((sum, product) => {
      return sum + (product.size2T || 0) + (product.size3T || 0) + (product.size4T || 0) + (product.size5T || 0) +
                   (product.sizeYXS || 0) + (product.sizeYS || 0) + (product.sizeYM || 0) + (product.sizeYL || 0) + (product.sizeYXL || 0) +
                   (product.sizeXS || 0) + (product.sizeS || 0) + (product.sizeM || 0) + (product.sizeL || 0) +
                   (product.sizeXL || 0) + (product.size2XL || 0) + (product.size3XL || 0) + (product.size4XL || 0) +
                   (product.size5XL || 0) + (product.size6XL || 0);
    }, 0);
    
    // Add imprint costs
    for (const imprint of imprintsList) {
      const setupFee = parseFloat(imprint.setupFee || '0');
      const perItemCost = parseFloat(imprint.unitPrice || '0');
      total += setupFee + (perItemCost * totalQty);
    }
  }
  
  // Update the invoice total
  await db.update(invoices).set({ totalAmount: total.toFixed(2) }).where(eq(invoices.id, invoiceId));
  
  return total;
}




// Helper functions for getting single records
export async function getImprint(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [imprint] = await db.select().from(imprints).where(eq(imprints.id, id));
  return imprint;
}


// ============================================================================
// QUOTE TO INVOICE CONVERSION
// ============================================================================

export async function convertQuoteToInvoice(quoteId: string, userId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the quote
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
  if (!quote) throw new Error("Quote not found");

  // Create the invoice
  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Get next invoice number
  const [result] = await db.execute<{ maxNum: number }>("SELECT MAX(invoiceNumber) as maxNum FROM invoices");
  const maxNum = (result as Array<{ maxNum: number | null }>)[0]?.maxNum || 0;
  const invoiceNumber = maxNum + 1;

  const newInvoice: InsertInvoice = {
    id: invoiceId,
    invoiceNumber,
    customerId: quote.customerId,
    status: "pending",
    totalAmount: quote.totalAmount,
    taxAmount: quote.taxAmount,
    notes: quote.notes,
  };

  await db.insert(invoices).values(newInvoice);

  // Copy all line item groups
  const groups = await db.select().from(lineItemGroups).where(eq(lineItemGroups.quoteId, quoteId));
  
  for (const group of groups) {
    const newGroupId = `lig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create the group for the invoice
    await db.insert(lineItemGroups).values({
      id: newGroupId,
      invoiceId: invoiceId,
      name: group.name,
      sortOrder: group.sortOrder,
    });

    // Copy all line items (products) in this group
    const items = await db.select().from(lineItems).where(eq(lineItems.groupId, group.id));
    
    for (const item of items) {
      const newItemId = `li_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      await db.insert(lineItems).values({
        id: newItemId,
        groupId: newGroupId,
        productId: item.productId,
        itemNumber: item.itemNumber,
        description: item.description,
        color: item.color,
        unitPrice: item.unitPrice,
        size2T: item.size2T,
        size3T: item.size3T,
        size4T: item.size4T,
        size5T: item.size5T,
        sizeYXS: item.sizeYXS,
        sizeYS: item.sizeYS,
        sizeYM: item.sizeYM,
        sizeYL: item.sizeYL,
        sizeYXL: item.sizeYXL,
        sizeXS: item.sizeXS,
        sizeS: item.sizeS,
        sizeM: item.sizeM,
        sizeL: item.sizeL,
        sizeXL: item.sizeXL,
        size2XL: item.size2XL,
        size3XL: item.size3XL,
        size4XL: item.size4XL,
        size5XL: item.size5XL,
        size6XL: item.size6XL,
        notes: item.notes,
        sortOrder: item.sortOrder,
      });
    }

    // Copy all imprints for this group
    const groupImprints = await db.select().from(imprints).where(eq(imprints.groupId, group.id));
    
    for (const imprint of groupImprints) {
      const newImprintId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      await db.insert(imprints).values({
        id: newImprintId,
        groupId: newGroupId,
        location: imprint.location,
        decorationMethod: imprint.decorationMethod,
        colors: imprint.colors,
        stitchCount: imprint.stitchCount,
        artworkUrl: imprint.artworkUrl,
        setupFee: imprint.setupFee,
        unitPrice: imprint.unitPrice,
        notes: imprint.notes,
        sortOrder: imprint.sortOrder,
      });
    }
  }

  // Update quote status to converted
  await db.update(quotes).set({ status: "converted" }).where(eq(quotes.id, quoteId));

  // Recalculate the invoice total to ensure accuracy
  await recalculateInvoiceTotal(invoiceId);

  return { invoiceId, success: true };
}



// ============================================================================
// CREATE QUOTE WITH LINE ITEMS (Printavo-style)
// ============================================================================

export async function createQuoteWithLineItems(input: {
  customerId: string;
  productionDueDate?: Date;
  notes?: string;
  createdBy: string;
  lineItemGroups: Array<{
    name: string;
    decorationMethod: string;
    sortOrder: number;
    products: Array<{
      itemNumber: string;
      color?: string;
      description: string;
      unitPrice: string;
      size2T?: number;
      size3T?: number;
      size4T?: number;
      sizeXS?: number;
      sizeS?: number;
      sizeM?: number;
      sizeL?: number;
      sizeXL?: number;
      size2XL?: number;
      size3XL?: number;
      size4XL?: number;
      size5XL?: number;
      size6XL?: number;
      sortOrder: number;
    }>;
    imprints: Array<{
      location: string;
      method: string;
      colors: number;
      setupFee: number;
      perItemPrice: number;
      sortOrder: number;
    }>;
  }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Create the quote first
  const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Get next quote number
  const [result] = await db.execute<{ maxNum: number }>("SELECT MAX(quoteNumber) as maxNum FROM quotes");
  const maxNum = (result as Array<{ maxNum: number | null }>)[0]?.maxNum || 0;
  const quoteNumber = maxNum + 1;

  const newQuote: InsertQuote = {
    id: quoteId,
    quoteNumber,
    customerId: input.customerId,
    status: "quote",
    totalAmount: "0.00", // Will be calculated
    productionDueDate: input.productionDueDate,
    notes: input.notes,
    createdBy: input.createdBy,
  };

  await db.insert(quotes).values(newQuote);

  // Create all line item groups with their products and imprints
  for (const groupData of input.lineItemGroups) {
    const groupId = `lig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    await db.insert(lineItemGroups).values({
      id: groupId,
      quoteId: quoteId,
      name: groupData.name,
      decorationMethod: groupData.decorationMethod,
      sortOrder: groupData.sortOrder,
    });

    // Create products in this group
    for (const productData of groupData.products) {
      const productId = `li_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      await db.insert(lineItems).values({
        id: productId,
        groupId: groupId,
        quoteId: quoteId,
        itemNumber: productData.itemNumber,
        color: productData.color,
        description: productData.description,
        unitPrice: productData.unitPrice,
        size2T: productData.size2T || 0,
        size3T: productData.size3T || 0,
        size4T: productData.size4T || 0,
        sizeXS: productData.sizeXS || 0,
        sizeS: productData.sizeS || 0,
        sizeM: productData.sizeM || 0,
        sizeL: productData.sizeL || 0,
        sizeXL: productData.sizeXL || 0,
        size2XL: productData.size2XL || 0,
        size3XL: productData.size3XL || 0,
        size4XL: productData.size4XL || 0,
        size5XL: productData.size5XL || 0,
        size6XL: productData.size6XL || 0,
        sortOrder: productData.sortOrder,
      });
    }

    // Create imprints for this group
    for (const imprintData of groupData.imprints) {
      const imprintId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      await db.insert(imprints).values({
        id: imprintId,
        groupId: groupId,
        location: imprintData.location,
        decorationMethod: imprintData.method,
        colors: imprintData.colors,
        setupFee: imprintData.setupFee.toFixed(2),
        unitPrice: imprintData.perItemPrice.toFixed(2),
        sortOrder: imprintData.sortOrder,
      });
    }
  }

  // Recalculate the quote total
  await recalculateQuoteTotal(quoteId);

  // Return the created quote
  const [createdQuote] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
  return createdQuote;
}



// ============================================================================
// TOTAL CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate the total amount for a quote or invoice based on its line items and imprints
 */
export async function calculateQuoteTotal(quoteId: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let total = 0;

  // Get all line item groups for this quote
  const groups = await db.select().from(lineItemGroups).where(eq(lineItemGroups.quoteId, quoteId));

  for (const group of groups) {
    // Calculate product totals
    const items = await db.select().from(lineItems).where(eq(lineItems.groupId, group.id));
    
    for (const item of items) {
      const quantity = (item.size2T || 0) + (item.size3T || 0) + (item.size4T || 0) +
        (item.sizeXS || 0) + (item.sizeS || 0) + (item.sizeM || 0) +
        (item.sizeL || 0) + (item.sizeXL || 0) + (item.size2XL || 0) +
        (item.size3XL || 0) + (item.size4XL || 0) + (item.size5XL || 0) + (item.size6XL || 0);
      
      const unitPrice = parseFloat(item.unitPrice || "0");
      total += quantity * unitPrice;
    }

    // Calculate imprint totals
    const groupImprints = await db.select().from(imprints).where(eq(imprints.groupId, group.id));
    
    for (const imprint of groupImprints) {
      // Setup fee (one-time per imprint)
      total += parseFloat(imprint.setupFee || "0");
      
      // Per-item cost (multiplied by total quantity of all products in the group)
      let groupQuantity = 0;
      for (const item of items) {
        groupQuantity += (item.size2T || 0) + (item.size3T || 0) + (item.size4T || 0) +
          (item.sizeXS || 0) + (item.sizeS || 0) + (item.sizeM || 0) +
          (item.sizeL || 0) + (item.sizeXL || 0) + (item.size2XL || 0) +
          (item.size3XL || 0) + (item.size4XL || 0) + (item.size5XL || 0) + (item.size6XL || 0);
      }
      
      const perItemPrice = parseFloat(imprint.unitPrice || "0");
      total += groupQuantity * perItemPrice;
    }
  }

  return total;
}

/**
 * Calculate the total amount for an invoice based on its line items and imprints
 */
export async function calculateInvoiceTotal(invoiceId: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let total = 0;

  // Get all line item groups for this invoice
  const groups = await db.select().from(lineItemGroups).where(eq(lineItemGroups.invoiceId, invoiceId));

  for (const group of groups) {
    // Calculate product totals
    const items = await db.select().from(lineItems).where(eq(lineItems.groupId, group.id));
    
    for (const item of items) {
      const quantity = (item.size2T || 0) + (item.size3T || 0) + (item.size4T || 0) +
        (item.sizeXS || 0) + (item.sizeS || 0) + (item.sizeM || 0) +
        (item.sizeL || 0) + (item.sizeXL || 0) + (item.size2XL || 0) +
        (item.size3XL || 0) + (item.size4XL || 0) + (item.size5XL || 0) + (item.size6XL || 0);
      
      const unitPrice = parseFloat(item.unitPrice || "0");
      total += quantity * unitPrice;
    }

    // Calculate imprint totals
    const groupImprints = await db.select().from(imprints).where(eq(imprints.groupId, group.id));
    
    for (const imprint of groupImprints) {
      // Setup fee (one-time per imprint)
      total += parseFloat(imprint.setupFee || "0");
      
      // Per-item cost (multiplied by total quantity of all products in the group)
      let groupQuantity = 0;
      for (const item of items) {
        groupQuantity += (item.size2T || 0) + (item.size3T || 0) + (item.size4T || 0) +
          (item.sizeXS || 0) + (item.sizeS || 0) + (item.sizeM || 0) +
          (item.sizeL || 0) + (item.sizeXL || 0) + (item.size2XL || 0) +
          (item.size3XL || 0) + (item.size4XL || 0) + (item.size5XL || 0) + (item.size6XL || 0);
      }
      
      const perItemPrice = parseFloat(imprint.unitPrice || "0");
      total += groupQuantity * perItemPrice;
    }
  }

  return total;
}




// Get all tasks
export async function getAllTasks() {
  const db = await getDb();
  return await db.select().from(tasks);
}

// Get activity log by entity
export async function getActivityLogByEntity(entityType: string, entityId: string) {
  const db = await getDb();
  return await db
    .select()
    .from(activityLog)
    .where(and(eq(activityLog.entityType, entityType), eq(activityLog.entityId, entityId)))
    .orderBy(desc(activityLog.createdAt));
}
