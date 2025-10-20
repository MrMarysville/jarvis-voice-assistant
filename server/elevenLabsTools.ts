/**
 * ElevenLabs Agent Tools
 * 
 * Server-side tool endpoints that ElevenLabs Agent can call
 * These tools enable the agent to:
 * - Create quotes
 * - Search products
 * - Get customer history
 */

import { Router } from 'express';
import { getDb } from './db';
import * as schema from '../drizzle/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

const router = Router();

/**
 * Tool: Create Quote
 * 
 * Creates a new quote with line items
 */
router.post('/create-quote', async (req, res) => {
  try {
    const { customer_name, line_items } = req.body;
    
    if (!customer_name || !line_items || !Array.isArray(line_items)) {
      return res.status(400).json({
        error: 'Missing required fields: customer_name, line_items'
      });
    }
    
    const db = getDb();
    
    // 1. Find or create customer
    let customer = await db.query.customers.findFirst({
      where: eq(schema.customers.name, customer_name),
    });
    
    if (!customer) {
      const [newCustomer] = await db.insert(schema.customers).values({
        name: customer_name,
        email: `${customer_name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        phone: '',
      }).returning();
      customer = newCustomer;
    }
    
    // 2. Calculate totals
    let subtotal = 0;
    const processedItems = [];
    
    for (const item of line_items) {
      const { product_name, quantity, unit_price, decoration } = item;
      const itemTotal = quantity * unit_price;
      subtotal += itemTotal;
      
      processedItems.push({
        product_name,
        quantity,
        unit_price,
        decoration: decoration || '',
        total: itemTotal,
      });
    }
    
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + tax;
    
    // 3. Create quote
    const [quote] = await db.insert(schema.quotes).values({
      customerId: customer.id,
      status: 'draft',
      subtotal,
      tax,
      total,
      notes: `Created via voice assistant for ${customer_name}`,
    }).returning();
    
    // 4. Create line item groups and items
    const [group] = await db.insert(schema.lineItemGroups).values({
      quoteId: quote.id,
      name: 'Main Items',
    }).returning();
    
    for (const item of processedItems) {
      await db.insert(schema.lineItems).values({
        groupId: group.id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price.toString(),
        decoration: item.decoration,
      });
    }
    
    res.json({
      success: true,
      quote_id: quote.id,
      quote_number: `Q-${quote.id.toString().padStart(5, '0')}`,
      customer: customer_name,
      subtotal,
      tax,
      total,
      message: `Quote created successfully for ${customer_name} with ${line_items.length} items. Total: $${total.toFixed(2)}`
    });
    
  } catch (error: any) {
    console.error('[ElevenLabs Tool] Create quote error:', error);
    res.status(500).json({
      error: 'Failed to create quote',
      details: error.message
    });
  }
});

/**
 * Tool: Search Products
 * 
 * Search for products in the catalog
 */
router.post('/search-products', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        error: 'Missing required field: query'
      });
    }
    
    const db = getDb();
    
    // Search products by name or SKU
    const products = await db.query.products.findMany({
      where: sql`LOWER(${schema.products.name}) LIKE LOWER(${'%' + query + '%'})`,
      limit: 10,
    });
    
    res.json({
      success: true,
      count: products.length,
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.basePrice,
        category: p.category,
      })),
      message: `Found ${products.length} products matching "${query}"`
    });
    
  } catch (error: any) {
    console.error('[ElevenLabs Tool] Search products error:', error);
    res.status(500).json({
      error: 'Failed to search products',
      details: error.message
    });
  }
});

/**
 * Tool: Get Customer History
 * 
 * Get recent quotes and orders for a customer
 */
router.post('/customer-history', async (req, res) => {
  try {
    const { customer_name } = req.body;
    
    if (!customer_name) {
      return res.status(400).json({
        error: 'Missing required field: customer_name'
      });
    }
    
    const db = getDb();
    
    // Find customer
    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.name, customer_name),
    });
    
    if (!customer) {
      return res.json({
        success: true,
        found: false,
        message: `No customer found with name "${customer_name}"`
      });
    }
    
    // Get recent quotes
    const quotes = await db.query.quotes.findMany({
      where: eq(schema.quotes.customerId, customer.id),
      orderBy: [desc(schema.quotes.createdAt)],
      limit: 5,
    });
    
    res.json({
      success: true,
      found: true,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
      quote_count: quotes.length,
      recent_quotes: quotes.map(q => ({
        id: q.id,
        number: `Q-${q.id.toString().padStart(5, '0')}`,
        status: q.status,
        total: q.total,
        created: q.createdAt,
      })),
      message: `Found ${quotes.length} recent quotes for ${customer_name}`
    });
    
  } catch (error: any) {
    console.error('[ElevenLabs Tool] Customer history error:', error);
    res.status(500).json({
      error: 'Failed to get customer history',
      details: error.message
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    tools: [
      'create-quote',
      'search-products',
      'customer-history'
    ]
  });
});

export default router;

