import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema.js";

const db = drizzle(process.env.DATABASE_URL!);

async function seed() {
  console.log("Seeding database...");

  const customer1Id = `cust_${Date.now()}_1`;
  const customer2Id = `cust_${Date.now()}_2`;

  await db.insert(schema.customers).values([
    {
      id: customer1Id,
      name: "John Smith",
      email: "john@example.com",
      phone: "555-0101",
      company: "ABC Corporation",
      billingAddress: JSON.stringify({ street: "123 Main St", city: "Sacramento", state: "CA", zip: "95814" }),
      shippingAddress: JSON.stringify({ street: "123 Main St", city: "Sacramento", state: "CA", zip: "95814" }),
      notes: "Preferred customer",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: customer2Id,
      name: "Jane Doe",
      email: "jane@techstartup.com",
      phone: "555-0102",
      company: "Tech Startup Inc",
      billingAddress: JSON.stringify({ street: "456 Innovation Dr", city: "San Francisco", state: "CA", zip: "94102" }),
      shippingAddress: JSON.stringify({ street: "456 Innovation Dr", city: "San Francisco", state: "CA", zip: "94102" }),
      notes: "Large volume orders",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log("✓ Created customers");

  const quoteId = `quote_${Date.now()}_1`;
  await db.insert(schema.quotes).values({
    id: quoteId,
    quoteNumber: 1001,
    customerId: customer1Id,
    status: "quote",
    totalAmount: "1250.00",
    taxAmount: "128.12",
    taxRate: "10.25",
    deliveryMethod: "UPS Ground",
    poNumber: "PO-2024-001",
    terms: "Net 30",
    notes: "Rush order",
    createdAt: new Date(),
    createdBy: "system",
    productionDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    customerDueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  });

  console.log("✓ Created quote");

  const invoiceId = `inv_${Date.now()}_1`;
  await db.insert(schema.invoices).values({
    id: invoiceId,
    invoiceNumber: 5001,
    customerId: customer2Id,
    status: "in_production",
    totalAmount: "2450.00",
    paidAmount: "1000.00",
    taxAmount: "251.12",
    taxRate: "10.25",
    deliveryMethod: "FedEx 2-Day",
    poNumber: "TS-2024-042",
    terms: "50% deposit",
    paymentDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    notes: "High priority",
    createdAt: new Date(),
    createdBy: "system",
    productionDueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    customerDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  });

  console.log("✓ Created invoice");
  console.log("\n✅ Database seeded successfully!");
}

seed().catch(console.error).finally(() => process.exit(0));
