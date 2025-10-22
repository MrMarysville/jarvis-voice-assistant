import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";

// ============================================================================
// CUSTOMERS ROUTER
// ============================================================================

const customersRouter = router({
  list: protectedProcedure.query(async () => {
    return await db.getAllCustomers();
  }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    return await db.getCustomer(input.id);
  }),

  search: protectedProcedure.input(z.object({ query: z.string() })).query(async ({ input }) => {
    return await db.searchCustomers(input.query);
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        billingAddress: z.string().optional(),
        shippingAddress: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await db.createCustomer(input);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        billingAddress: z.string().optional(),
        shippingAddress: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      return await db.updateCustomer(id, updates);
    }),
});

// ============================================================================
// QUOTES ROUTER
// ============================================================================

const quotesRouter = router({
  list: protectedProcedure.query(async () => {
    return await db.getAllQuotes();
  }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    return await db.getQuote(input.id);
  }),

  getByCustomer: protectedProcedure.input(z.object({ customerId: z.string() })).query(async ({ input }) => {
    return await db.getQuotesByCustomer(input.customerId);
  }),

  getByStatus: protectedProcedure.input(z.object({ status: z.string() })).query(async ({ input }) => {
    return await db.getQuotesByStatus(input.status);
  }),

  create: protectedProcedure
    .input(
      z.object({
        customerId: z.string(),
        status: z.enum(["quote", "approved", "rejected", "converted"]).optional(),
        totalAmount: z.string().optional(),
        taxAmount: z.string().optional(),
        taxRate: z.string().optional(),
        deliveryMethod: z.string().optional(),
        poNumber: z.string().optional(),
        terms: z.string().optional(),
        notes: z.string().optional(),
        productionDueDate: z.date().optional(),
        customerDueDate: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const quote = await db.createQuote({
        ...input,
        createdBy: ctx.user.id,
      });

      // Log activity
      await db.logActivity({
        entityType: "quote",
        entityId: quote.id,
        action: "created",
        description: `Quote #${quote.quoteNumber} was created`,
        userId: ctx.user.id,
      });

      return quote;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["quote", "approved", "rejected", "converted"]).optional(),
        totalAmount: z.string().optional(),
        taxAmount: z.string().optional(),
        taxRate: z.string().optional(),
        deliveryMethod: z.string().optional(),
        poNumber: z.string().optional(),
        terms: z.string().optional(),
        notes: z.string().optional(),
        productionDueDate: z.date().optional(),
        customerDueDate: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;
      const quote = await db.updateQuote(id, updates);

      // Log activity
      if (quote) {
        await db.logActivity({
          entityType: "quote",
          entityId: quote.id,
          action: "updated",
          description: `Quote #${quote.quoteNumber} was updated`,
          userId: ctx.user.id,
          metadata: JSON.stringify(updates),
        });
      }

      return quote;
    }),

  convertToInvoice: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { convertQuoteToInvoice } = await import('./db');
      const result = await convertQuoteToInvoice(input.id, ctx.user.id);
      return result;
    }),

  createWithLineItems: protectedProcedure
    .input(
      z.object({
        customerId: z.string(),
        productionDueDate: z.date().optional(),
        notes: z.string().optional(),
        lineItemGroups: z.array(
          z.object({
            name: z.string(),
            decorationMethod: z.string(),
            sortOrder: z.number(),
            products: z.array(
              z.object({
                itemNumber: z.string(),
                color: z.string().optional(),
                description: z.string(),
                unitPrice: z.string(),
                size2T: z.number().optional(),
                size3T: z.number().optional(),
                size4T: z.number().optional(),
                sizeXS: z.number().optional(),
                sizeS: z.number().optional(),
                sizeM: z.number().optional(),
                sizeL: z.number().optional(),
                sizeXL: z.number().optional(),
                size2XL: z.number().optional(),
                size3XL: z.number().optional(),
                size4XL: z.number().optional(),
                size5XL: z.number().optional(),
                size6XL: z.number().optional(),
                sortOrder: z.number(),
              })
            ),
            imprints: z.array(
              z.object({
                location: z.string(),
                method: z.string(),
                colors: z.number(),
                setupFee: z.number(),
                perItemPrice: z.number(),
                sortOrder: z.number(),
              })
            ),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const quote = await db.createQuoteWithLineItems({
        ...input,
        createdBy: ctx.user.id,
      });

      // Log activity
      await db.logActivity({
        entityType: "quote",
        entityId: quote.id,
        action: "created",
        description: `Quote #${quote.quoteNumber} was created with ${input.lineItemGroups.length} line item groups`,
        userId: ctx.user.id,
      });

      return quote;
    }),
});

// ============================================================================
// INVOICES ROUTER
// ============================================================================

const invoicesRouter = router({
  createFromQuote: protectedProcedure
    .input(z.object({ quoteId: z.string() }))
    .mutation(async ({ input }) => {
      const quote = await db.getQuote(input.quoteId);
      if (!quote) throw new Error("Quote not found");
      
      const invoice = await db.createInvoice({
        quoteId: input.quoteId,
        customerId: quote.customerId,
        status: "pending",
        totalAmount: quote.totalAmount,
        paidAmount: "0.00",
        taxAmount: quote.taxAmount,
        taxRate: quote.taxRate,
        deliveryMethod: quote.deliveryMethod,
        poNumber: quote.poNumber,
        terms: quote.terms,
        notes: quote.notes,
        productionDueDate: quote.productionDueDate,
        customerDueDate: quote.customerDueDate,
      });
      
      // Update quote status
      await db.updateQuote(input.quoteId, { status: "converted" });
      
      // Copy line items
      const lineItems = await db.getLineItemsByQuote(input.quoteId);
      for (const item of lineItems) {
        await db.createLineItem({
          invoiceId: invoice.id,
          groupId: item.groupId,
          productId: item.productId,
          itemNumber: item.itemNumber,
          description: item.description,
          color: item.color,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          notes: item.notes,
          sortOrder: item.sortOrder,
        });
      }
      
      return invoice;
    }),

  list: protectedProcedure.query(async () => {
    return await db.getAllInvoices();
  }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    return await db.getInvoice(input.id);
  }),

  getByCustomer: protectedProcedure.input(z.object({ customerId: z.string() })).query(async ({ input }) => {
    return await db.getInvoicesByCustomer(input.customerId);
  }),

  getByStatus: protectedProcedure.input(z.object({ status: z.string() })).query(async ({ input }) => {
    return await db.getInvoicesByStatus(input.status);
  }),

  getByDateRange: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ input }) => {
      return await db.getInvoicesByDateRange(input.startDate, input.endDate);
    }),

  create: protectedProcedure
    .input(
      z.object({
        customerId: z.string(),
        quoteId: z.string().optional(),
        status: z
          .enum([
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
            "overdue",
          ])
          .optional(),
        totalAmount: z.string().optional(),
        paidAmount: z.string().optional(),
        taxAmount: z.string().optional(),
        taxRate: z.string().optional(),
        deliveryMethod: z.string().optional(),
        poNumber: z.string().optional(),
        terms: z.string().optional(),
        paymentDueDate: z.date().optional(),
        notes: z.string().optional(),
        productionDueDate: z.date().optional(),
        customerDueDate: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const invoice = await db.createInvoice({
        ...input,
        createdBy: ctx.user.id,
      });

      // Log activity
      await db.logActivity({
        entityType: "invoice",
        entityId: invoice.id,
        action: "created",
        description: `Invoice #${invoice.invoiceNumber} was created`,
        userId: ctx.user.id,
      });

      return invoice;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z
          .enum([
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
            "overdue",
          ])
          .optional(),
        totalAmount: z.string().optional(),
        paidAmount: z.string().optional(),
        taxAmount: z.string().optional(),
        taxRate: z.string().optional(),
        deliveryMethod: z.string().optional(),
        poNumber: z.string().optional(),
        terms: z.string().optional(),
        paymentDueDate: z.date().optional(),
        notes: z.string().optional(),
        productionDueDate: z.date().optional(),
        customerDueDate: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;
      const invoice = await db.updateInvoice(id, updates);

      // Log activity
      if (invoice) {
        await db.logActivity({
          entityType: "invoice",
          entityId: invoice.id,
          action: "updated",
          description: `Invoice #${invoice.invoiceNumber} was updated`,
          userId: ctx.user.id,
          metadata: JSON.stringify(updates),
        });
      }

      return invoice;
    }),
});

// ============================================================================
// LINE ITEMS ROUTER
// ============================================================================

const lineItemsRouter = router({
  getByQuote: protectedProcedure.input(z.object({ quoteId: z.string() })).query(async ({ input }) => {
    return await db.getLineItemsByQuote(input.quoteId);
  }),

  getByInvoice: protectedProcedure.input(z.object({ invoiceId: z.string() })).query(async ({ input }) => {
    return await db.getLineItemsByInvoice(input.invoiceId);
  }),

  getByGroup: protectedProcedure.input(z.object({ groupId: z.string() })).query(async ({ input }) => {
    return await db.getLineItemsByGroup(input.groupId);
  }),

  create: protectedProcedure
    .input(
      z.object({
        quoteId: z.string().optional(),
        invoiceId: z.string().optional(),
        category: z.string().optional(),
        itemNumber: z.string().optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        quantity: z.number().optional(),
        unitPrice: z.string().optional(),
        totalPrice: z.string().optional(),
        imprintLocation: z.string().optional(),
        artworkUrl: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await db.createLineItem(input);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        category: z.string().optional(),
        itemNumber: z.string().optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        quantity: z.number().optional(),
        unitPrice: z.string().optional(),
        totalPrice: z.string().optional(),
        imprintLocation: z.string().optional(),
        artworkUrl: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      return await db.updateLineItem(id, updates);
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await db.deleteLineItem(input.id);
    return { success: true };
  }),
});

// ============================================================================
// TASKS ROUTER
// ============================================================================

const tasksRouter = router({
  list: protectedProcedure.query(async () => {
    return await db.getPendingTasks();
  }),

  getByInvoice: protectedProcedure.input(z.object({ invoiceId: z.string() })).query(async ({ input }) => {
    return await db.getTasksByInvoice(input.invoiceId);
  }),

  getByUser: protectedProcedure.input(z.object({ userId: z.string() })).query(async ({ input }) => {
    return await db.getTasksByUser(input.userId);
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        invoiceId: z.string().optional(),
        quoteId: z.string().optional(),
        assignedTo: z.string().optional(),
        dueDate: z.date().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await db.createTask({
        ...input,
        createdBy: ctx.user.id,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        assignedTo: z.string().optional(),
        dueDate: z.date().optional(),
        completed: z.boolean().optional(),
        completedAt: z.date().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      return await db.updateTask(id, updates);
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await db.deleteTask(input.id);
    return { success: true };
  }),
});

// ============================================================================
// PAYMENTS ROUTER
// ============================================================================

const paymentsRouter = router({
  getByInvoice: protectedProcedure.input(z.object({ invoiceId: z.string() })).query(async ({ input }) => {
    return await db.getPaymentsByInvoice(input.invoiceId);
  }),

  create: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        amount: z.string(),
        paymentMethod: z.string().optional(),
        paymentDate: z.date().optional(),
        transactionId: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const payment = await db.createPayment({
        ...input,
        createdBy: ctx.user.id,
      });

      // Update invoice paid amount
      const invoice = await db.getInvoice(input.invoiceId);
      if (invoice) {
        const currentPaid = parseFloat(invoice.paidAmount || "0");
        const newPaid = currentPaid + parseFloat(input.amount);
        const total = parseFloat(invoice.totalAmount || "0");

        let status = invoice.status;
        if (newPaid >= total) {
          status = "paid";
        } else if (newPaid > 0) {
          status = "partial_paid";
        }

        await db.updateInvoice(input.invoiceId, {
          paidAmount: newPaid.toFixed(2),
          status,
        });

        // Log activity
        await db.logActivity({
          entityType: "invoice",
          entityId: input.invoiceId,
          action: "payment_received",
          description: `Payment of $${input.amount} received for Invoice #${invoice.invoiceNumber}`,
          userId: ctx.user.id,
        });
      }

      return payment;
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await db.deletePayment(input.id);
    return { success: true };
  }),
});

// ============================================================================
// EXPENSES ROUTER
// ============================================================================

const expensesRouter = router({
  list: protectedProcedure.query(async () => {
    return await db.getAllExpenses();
  }),

  getByInvoice: protectedProcedure.input(z.object({ invoiceId: z.string() })).query(async ({ input }) => {
    return await db.getExpensesByInvoice(input.invoiceId);
  }),

  create: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        amount: z.string(),
        expenseDate: z.date().optional(),
        vendor: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await db.createExpense({
        ...input,
        createdBy: ctx.user.id,
      });
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await db.deleteExpense(input.id);
    return { success: true };
  }),
});

// ============================================================================
// PRODUCTS ROUTER
// ============================================================================

const productsRouter = router({
  list: protectedProcedure.query(async () => {
    return await db.getAllProducts();
  }),

  search: protectedProcedure.input(z.object({ query: z.string() })).query(async ({ input }) => {
    return await db.searchProducts(input.query);
  }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    return await db.getProduct(input.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        itemNumber: z.string().optional(),
        name: z.string(),
        brand: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        basePrice: z.string().optional(),
        colors: z.string().optional(),
        imageUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await db.createProduct(input);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        itemNumber: z.string().optional(),
        name: z.string().optional(),
        brand: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        basePrice: z.string().optional(),
        colors: z.string().optional(),
        imageUrl: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      return await db.updateProduct(id, updates);
    }),
});

// ============================================================================
// MESSAGES ROUTER
// ============================================================================

const messagesRouter = router({
  getByInvoice: protectedProcedure.input(z.object({ invoiceId: z.string() })).query(async ({ input }) => {
    return await db.getMessagesByInvoice(input.invoiceId);
  }),

  getByCustomer: protectedProcedure.input(z.object({ customerId: z.string() })).query(async ({ input }) => {
    return await db.getMessagesByCustomer(input.customerId);
  }),

  create: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string().optional(),
        quoteId: z.string().optional(),
        customerId: z.string().optional(),
        toEmail: z.string().optional(),
        subject: z.string().optional(),
        body: z.string().optional(),
        messageType: z.enum(["internal", "email", "sms"]).optional(),
        sentAt: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await db.createMessage({
        ...input,
        fromUserId: ctx.user.id,
      });
    }),
});

// ============================================================================
// ACTIVITY LOG ROUTER
// ============================================================================

const activityRouter = router({
  getByEntity: protectedProcedure
    .input(
      z.object({
        entityType: z.string(),
        entityId: z.string(),
      })
    )
    .query(async ({ input }) => {
      return await db.getActivityByEntity(input.entityType, input.entityId);
    }),
});

// ============================================================================
// VOICE ASSISTANT ROUTER
// ============================================================================

const voiceRouter = router({
  processCommand: protectedProcedure
    .input(z.object({ command: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { command } = input;
      const userId = ctx.user.id;
      
      // Define available tools for the AI
      const tools = [
        {
          type: "function" as const,
          function: {
            name: "navigate",
            description: "Navigate to a specific page in the application",
            parameters: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  enum: ["/", "/quotes", "/invoices", "/customers", "/products", "/tasks", "/payments", "/expenses", "/calendar", "/messages"],
                  description: "The path to navigate to"
                }
              },
              required: ["path"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "create_quote",
            description: "Create a new quote for a customer",
            parameters: {
              type: "object",
              properties: {
                customerName: { type: "string", description: "Customer name" },
                email: { type: "string", description: "Customer email" },
                dueDate: { type: "string", description: "Due date in ISO format" }
              },
              required: ["customerName"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "create_customer",
            description: "Create a new customer",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "Customer name" },
                email: { type: "string", description: "Customer email" },
                phone: { type: "string", description: "Customer phone" },
                company: { type: "string", description: "Company name" }
              },
              required: ["name"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "search_customers",
            description: "Search for customers by name or company",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query" }
              },
              required: ["query"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "get_quote_stats",
            description: "Get statistics about quotes (pending, approved, etc.)",
            parameters: {
              type: "object",
              properties: {}
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "get_invoice_stats",
            description: "Get statistics about invoices (pending, in production, completed, paid)",
            parameters: {
              type: "object",
              properties: {}
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "create_task",
            description: "Create a new task",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Task title" },
                description: { type: "string", description: "Task description" },
                dueDate: { type: "string", description: "Due date in ISO format" }
              },
              required: ["title"]
            }
          }
        }
      ];
      
      const systemPrompt = `You are Jarvis, an AI assistant for a print shop management system.

You help users manage quotes, invoices, customers, products, tasks, and payments through voice commands.

When the user asks you to perform an action, use the appropriate function call.
Always respond in a friendly, concise manner (1-2 sentences).

Current date: ${new Date().toISOString().split('T')[0]}`;

      // First LLM call to determine which tool to use
      const llmResponse = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: command },
        ],
        tools,
        tool_choice: "auto" as const,
      });

      const message = llmResponse.choices[0].message;
      let responseText = "I'm here to help!";
      let actionResult: any = null;

      // If AI wants to call a tool
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        // Execute the appropriate function
        switch (functionName) {
          case "navigate":
            actionResult = { type: "navigate", path: functionArgs.path };
            responseText = `Navigating to ${functionArgs.path.replace('/', '') || 'dashboard'}.`;
            break;

          case "create_quote":
            // First, find or create customer
            let customer = await db.getCustomerByName(functionArgs.customerName);
            if (!customer) {
              customer = await db.createCustomer({
                name: functionArgs.customerName,
                email: functionArgs.email || null,
                phone: null,
                company: functionArgs.customerName,
                billingAddress: null,
                shippingAddress: null,
                notes: null,
              });
            }

            if (customer) {
              const newQuote = await db.createQuote({
                customerId: customer.id,
                status: "quote",
                totalAmount: "0.00",
                taxAmount: "0.00",
                taxRate: "0.00",
                customerDueDate: functionArgs.dueDate ? new Date(functionArgs.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                notes: "Created via voice assistant - add line items to complete",
              });
              actionResult = { type: "navigate", path: "/quotes" };
              responseText = `Created quote #${newQuote.quoteNumber} for ${functionArgs.customerName}. Opening quotes page where you can add line items.`;
            } else {
              responseText = `Failed to create customer ${functionArgs.customerName}. Please try again.`;
            }
            break;

          case "create_customer":
            await db.createCustomer({
              name: functionArgs.name,
              email: functionArgs.email || null,
              phone: functionArgs.phone || null,
              company: functionArgs.company || functionArgs.name,
              billingAddress: null,
              shippingAddress: null,
              notes: null,
            });
            actionResult = { type: "navigate", path: "/customers" };
            responseText = `Created customer ${functionArgs.name}. Opening customers page.`;
            break;

          case "search_customers":
            const customers = await db.searchCustomers(functionArgs.query);
            actionResult = { type: "navigate", path: "/customers" };
            responseText = `Found ${customers.length} customer${customers.length !== 1 ? 's' : ''} matching "${functionArgs.query}".`;
            break;

          case "get_quote_stats":
            const quotes = await db.getAllQuotes();
            const pending = quotes.filter(q => q.status === "quote").length;
            const approved = quotes.filter(q => q.status === "approved").length;
            responseText = `You have ${pending} pending quote${pending !== 1 ? 's' : ''} and ${approved} approved quote${approved !== 1 ? 's' : ''}.`;
            actionResult = { type: "navigate", path: "/quotes" };
            break;

          case "get_invoice_stats":
            const invoices = await db.getAllInvoices();
            const inProduction = invoices.filter(i => i.status === "in_production").length;
            const completed = invoices.filter(i => i.status === "completed").length;
            const totalOutstanding = invoices
              .filter(i => i.status !== "paid")
              .reduce((sum, inv) => sum + parseFloat(inv.totalAmount || "0"), 0);
            responseText = `You have ${inProduction} order${inProduction !== 1 ? 's' : ''} in production, ${completed} completed. Outstanding balance: $${totalOutstanding.toFixed(2)}.`;
            actionResult = { type: "navigate", path: "/invoices" };
            break;

          case "create_task":
            await db.createTask({
              name: functionArgs.title,
              notes: functionArgs.description || null,
              priority: "medium",
              assignedTo: userId,
              dueDate: functionArgs.dueDate ? new Date(functionArgs.dueDate) : null,
              completed: false,
              createdBy: userId,
            });
            actionResult = { type: "navigate", path: "/tasks" };
            responseText = `Created task: ${functionArgs.title}.`;
            break;

          default:
            responseText = "I'm not sure how to do that yet.";
        }
      } else {
        // No tool call, just respond with the message
        const messageContent = message.content;
        responseText = typeof messageContent === 'string' ? messageContent : "I'm here to help!";
      }
      
      return {
        response: responseText,
        action: actionResult,
      };
    }),
});

// ============================================================================
// DASHBOARD ROUTER
// ============================================================================

const dashboardRouter = router({
  stats: protectedProcedure.query(async () => {
    const allInvoices = await db.getAllInvoices();
    const allQuotes = await db.getAllQuotes();
    const pendingTasks = await db.getPendingTasks();

    const totalRevenue = allInvoices
      .filter((inv) => inv.status === "paid" || inv.status === "completed")
      .reduce((sum, inv) => sum + parseFloat(inv.totalAmount || "0"), 0);

    const totalOutstanding = allInvoices
      .filter((inv) => inv.status !== "paid" && inv.status !== "completed")
      .reduce((sum, inv) => sum + (parseFloat(inv.totalAmount || "0") - parseFloat(inv.paidAmount || "0")), 0);

    const quotesByStatus = {
      quote: allQuotes.filter((q) => q.status === "quote").length,
      approved: allQuotes.filter((q) => q.status === "approved").length,
      rejected: allQuotes.filter((q) => q.status === "rejected").length,
      converted: allQuotes.filter((q) => q.status === "converted").length,
    };

    const invoicesByStatus = {
      pending: allInvoices.filter((i) => i.status === "pending").length,
      in_production: allInvoices.filter((i) => i.status === "in_production").length,
      completed: allInvoices.filter((i) => i.status === "completed").length,
      paid: allInvoices.filter((i) => i.status === "paid").length,
    };

    return {
      totalRevenue,
      totalOutstanding,
      totalQuotes: allQuotes.length,
      totalInvoices: allInvoices.length,
      pendingTasks: pendingTasks.length,
      quotesByStatus,
      invoicesByStatus,
    };
  }),
});

// ============================================================================
// LINE ITEM GROUPS ROUTER
// ============================================================================

const lineItemGroupsRouter = router({
  listByQuote: protectedProcedure
    .input(z.object({ quoteId: z.string() }))
    .query(async ({ input }) => db.getLineItemGroupsByQuote(input.quoteId)),
  listByInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ input }) => db.getLineItemGroupsByInvoice(input.invoiceId)),
  create: protectedProcedure
    .input(z.object({
      quoteId: z.string().optional(),
      invoiceId: z.string().optional(),
      name: z.string(),
      category: z.string().optional(),
      imprintLocation: z.string().optional(),
      artworkUrl: z.string().optional(),
      notes: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => db.createLineItemGroup(input)),
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      category: z.string().optional(),
      imprintLocation: z.string().optional(),
      artworkUrl: z.string().optional(),
      notes: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateLineItemGroup(id, data);
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => db.deleteLineItemGroup(input.id)),
});

const lineItemsInGroupRouter = router({
  listByGroup: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ input }) => db.getLineItemsByGroup(input.groupId)),
  create: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      quoteId: z.string().optional(),
      invoiceId: z.string().optional(),
      productId: z.string().optional(),
      itemNumber: z.string().optional(),
      description: z.string().optional(),
      color: z.string().optional(),
      quantity: z.number().optional(),
      unitPrice: z.string().optional(),
      totalPrice: z.string().optional(),
      notes: z.string().optional(),
      sortOrder: z.number().optional(),
      // Size breakdown fields (13 sizes: 2T through 6XL)
      size2T: z.number().optional(),
      size3T: z.number().optional(),
      size4T: z.number().optional(),
      sizeXS: z.number().optional(),
      sizeS: z.number().optional(),
      sizeM: z.number().optional(),
      sizeL: z.number().optional(),
      sizeXL: z.number().optional(),
      size2XL: z.number().optional(),
      size3XL: z.number().optional(),
      size4XL: z.number().optional(),
      size5XL: z.number().optional(),
      size6XL: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await db.createLineItemInGroup(input);
      // Recalculate totals after creating a product
      if (input.quoteId) {
        await db.recalculateQuoteTotal(input.quoteId);
      }
      if (input.invoiceId) {
        await db.recalculateInvoiceTotal(input.invoiceId);
      }
      return result;
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      description: z.string().optional(),
      color: z.string().optional(),
      quantity: z.number().optional(),
      unitPrice: z.string().optional(),
      totalPrice: z.string().optional(),
      notes: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      // Get the line item to find its group
      const lineItem = await db.getLineItem(id);
      const result = await db.updateLineItemInGroup(id, data);
      // Recalculate totals after updating
      if (lineItem && lineItem.groupId) {
        const group = await db.getLineItemGroup(lineItem.groupId);
        if (group) {
          if (group.quoteId) {
            await db.recalculateQuoteTotal(group.quoteId);
          }
          if (group.invoiceId) {
            await db.recalculateInvoiceTotal(group.invoiceId);
          }
        }
      }
      return result;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Get the line item to find its group before deleting
      const lineItem = await db.getLineItem(input.id);
      const result = await db.deleteLineItemFromGroup(input.id);
      // Recalculate totals after deleting
      if (lineItem && lineItem.groupId) {
        const group = await db.getLineItemGroup(lineItem.groupId);
        if (group) {
          if (group.quoteId) {
            await db.recalculateQuoteTotal(group.quoteId);
          }
          if (group.invoiceId) {
            await db.recalculateInvoiceTotal(group.invoiceId);
          }
        }
      }
      return result;
    }),
});

// ============================================================================
// IMPRINTS ROUTER
// ============================================================================

const imprintsRouter = router({
  listByGroup: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ input }) => db.getImprintsByGroup(input.groupId)),
  create: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      location: z.string().optional(),
      decorationMethod: z.string().optional(),
      colors: z.number().optional(),
      stitchCount: z.number().optional(),
      artworkUrl: z.string().optional(),
      setupFee: z.string().optional(),
      unitPrice: z.string().optional(),
      notes: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await db.createImprint(input);
      // Get the group to find quoteId/invoiceId
      const group = await db.getLineItemGroup(input.groupId);
      if (group) {
        if (group.quoteId) {
          await db.recalculateQuoteTotal(group.quoteId);
        }
        if (group.invoiceId) {
          await db.recalculateInvoiceTotal(group.invoiceId);
        }
      }
      return result;
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      location: z.string().optional(),
      decorationMethod: z.string().optional(),
      colors: z.number().optional(),
      stitchCount: z.number().optional(),
      artworkUrl: z.string().optional(),
      setupFee: z.string().optional(),
      unitPrice: z.string().optional(),
      notes: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      // Get the imprint to find its group
      const imprint = await db.getImprint(id);
      const result = await db.updateImprint(id, data);
      // Recalculate totals after updating
      if (imprint && imprint.groupId) {
        const group = await db.getLineItemGroup(imprint.groupId);
        if (group) {
          if (group.quoteId) {
            await db.recalculateQuoteTotal(group.quoteId);
          }
          if (group.invoiceId) {
            await db.recalculateInvoiceTotal(group.invoiceId);
          }
        }
      }
      return result;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Get the imprint to find its group before deleting
      const imprint = await db.getImprint(input.id);
      const result = await db.deleteImprint(input.id);
      // Recalculate totals after deleting
      if (imprint && imprint.groupId) {
        const group = await db.getLineItemGroup(imprint.groupId);
        if (group) {
          if (group.quoteId) {
            await db.recalculateQuoteTotal(group.quoteId);
          }
          if (group.invoiceId) {
            await db.recalculateInvoiceTotal(group.invoiceId);
          }
        }
      }
      return result;
    }),
});

// ============================================================================
// APP ROUTER
// ============================================================================

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  customers: customersRouter,
  quotes: quotesRouter,
  invoices: invoicesRouter,
  lineItemGroups: lineItemGroupsRouter,
  lineItems: lineItemsInGroupRouter,
  imprints: imprintsRouter,
  tasks: tasksRouter,
  payments: paymentsRouter,
  expenses: expensesRouter,
  voice: voiceRouter,
  products: productsRouter,
  messages: messagesRouter,
  activity: activityRouter,
  dashboard: dashboardRouter,
  business: router({
    // Quote workflow
    approveQuote: protectedProcedure
      .input(z.object({ quoteId: z.string(), createTasks: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const { approveQuote } = await import("./businessLogic");
        return approveQuote(input.quoteId, input.createTasks);
      }),
    rejectQuote: protectedProcedure
      .input(z.object({ quoteId: z.string(), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        const { rejectQuote } = await import("./businessLogic");
        return rejectQuote(input.quoteId, input.reason);
      }),
    // Invoice workflow
    recordPayment: protectedProcedure
      .input(z.object({
        invoiceId: z.string(),
        amount: z.number(),
        paymentMethod: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { recordPayment } = await import("./businessLogic");
        return recordPayment(input.invoiceId, input.amount, input.paymentMethod, input.notes);
      }),
    // Customer credit
    getCustomerBalance: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(async ({ input }) => {
        const { getCustomerOutstandingBalance } = await import("./businessLogic");
        return { balance: await getCustomerOutstandingBalance(input.customerId) };
      }),
    checkCreditLimit: protectedProcedure
      .input(z.object({ customerId: z.string(), additionalAmount: z.number() }))
      .query(async ({ input }) => {
        const { checkCreditLimit } = await import("./businessLogic");
        return checkCreditLimit(input.customerId, input.additionalAmount);
      }),
    // Notifications
    getNotifications: protectedProcedure
      .query(async () => {
        const { getPendingNotifications } = await import("./businessLogic");
        return getPendingNotifications();
      }),
    // Maintenance
    runDailyMaintenance: protectedProcedure
      .mutation(async () => {
        const { runDailyMaintenance } = await import("./businessLogic");
        return runDailyMaintenance();
      }),
  }),
  email: router({
    sendQuote: protectedProcedure
      .input(z.object({
        quoteId: z.string(),
        to: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        const quote = await db.getQuote(input.quoteId);
        if (!quote) throw new Error("Quote not found");
        
        const customer = await db.getCustomer(quote.customerId);
        if (!customer) throw new Error("Customer not found");
        
        const { sendQuoteEmail } = await import("./email");
        return await sendQuoteEmail(
          input.to,
          quote.quoteNumber,
          customer.name,
          quote.totalAmount || "0.00",
        );
      }),
    sendInvoice: protectedProcedure
      .input(z.object({
        invoiceId: z.string(),
        to: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        const invoice = await db.getInvoice(input.invoiceId);
        if (!invoice) throw new Error("Invoice not found");
        
        const customer = await db.getCustomer(invoice.customerId);
        if (!customer) throw new Error("Customer not found");
        
        const { sendInvoiceEmail } = await import("./email");
        return await sendInvoiceEmail(
          input.to,
          invoice.invoiceNumber,
          customer.name,
          invoice.totalAmount || "0.00",
          invoice.dueDate ? invoice.dueDate.toISOString() : null,
        );
      }),
    sendPaymentReminder: protectedProcedure
      .input(z.object({
        invoiceId: z.string(),
        to: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        const invoice = await db.getInvoice(input.invoiceId);
        if (!invoice) throw new Error("Invoice not found");
        
        const customer = await db.getCustomer(invoice.customerId);
        if (!customer) throw new Error("Customer not found");
        
        const amountDue = parseFloat(invoice.totalAmount || "0") - parseFloat(invoice.paidAmount || "0");
        
        const { sendPaymentReminderEmail } = await import("./email");
        return await sendPaymentReminderEmail(
          input.to,
          invoice.invoiceNumber,
          customer.name,
          amountDue.toFixed(2),
          invoice.dueDate ? invoice.dueDate.toISOString() : null,
        );
      }),
  }),
});

export type AppRouter = typeof appRouter;
