/**
 * Voice Pipeline WebSocket Server
 *
 * Complete voice pipeline: Whisper STT → Claude → ElevenLabs TTS
 * No agent creation needed!
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ENV } from './_core/env';
import { getDb } from './db';
import * as schema from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const openai = new OpenAI({ apiKey: ENV.openaiApiKey });
const anthropic = new Anthropic({ apiKey: ENV.anthropicApiKey });

// Constants for session management
const MAX_AUDIO_CHUNKS = 1000; // Prevent memory exhaustion
const MAX_CONVERSATION_HISTORY = 20; // Limit conversation history
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const PROCESSING_TIMEOUT_MS = 60 * 1000; // 60 seconds for processing

interface VoiceSession {
  ws: WebSocket;
  audioChunks: Buffer[];
  conversationHistory: Array<{ role: string; content: string }>;
  isProcessing: boolean;
  lastActivity: number;
  timeoutTimer?: NodeJS.Timeout;
}

interface ControlMessage {
  type: 'start_recording' | 'stop_recording' | 'reset';
  data?: unknown;
}

const sessions = new Map<WebSocket, VoiceSession>();

/**
 * Validate control message structure
 */
function isValidControlMessage(message: unknown): message is ControlMessage {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const msg = message as Record<string, unknown>;
  const validTypes = ['start_recording', 'stop_recording', 'reset'];

  return typeof msg.type === 'string' && validTypes.includes(msg.type);
}

/**
 * Clean up session resources
 */
function cleanupSession(ws: WebSocket): void {
  const session = sessions.get(ws);
  if (session) {
    if (session.timeoutTimer) {
      clearTimeout(session.timeoutTimer);
    }
    // Clear large data structures
    session.audioChunks = [];
    session.conversationHistory = [];
    sessions.delete(ws);
    console.log('[Voice Pipeline] Session cleaned up');
  }
}

/**
 * Reset session timeout
 */
function resetSessionTimeout(session: VoiceSession): void {
  session.lastActivity = Date.now();

  if (session.timeoutTimer) {
    clearTimeout(session.timeoutTimer);
  }

  session.timeoutTimer = setTimeout(() => {
    console.log('[Voice Pipeline] Session timed out due to inactivity');
    try {
      session.ws.send(JSON.stringify({
        type: 'error',
        message: 'Session timed out due to inactivity'
      }));
      session.ws.close(1000, 'Session timeout');
    } catch (error) {
      console.error('[Voice Pipeline] Error sending timeout message:', error);
    }
    cleanupSession(session.ws);
  }, SESSION_TIMEOUT_MS);
}

/**
 * Initialize WebSocket server for voice pipeline
 */
export function setupVoicePipelineServer(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/voice-pipeline'
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[Voice Pipeline] Client connected');

    // Initialize session
    const session: VoiceSession = {
      ws,
      audioChunks: [],
      conversationHistory: [],
      isProcessing: false,
      lastActivity: Date.now()
    };
    sessions.set(ws, session);

    // Set up session timeout
    resetSessionTimeout(session);

    // Send welcome message
    try {
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Voice pipeline ready'
      }));
    } catch (error) {
      console.error('[Voice Pipeline] Error sending welcome message:', error);
      cleanupSession(ws);
      return;
    }

    ws.on('message', async (data: Buffer) => {
      try {
        resetSessionTimeout(session);

        // Try to parse as JSON (control messages)
        const messageStr = data.toString();
        let parsedMessage: unknown;

        try {
          parsedMessage = JSON.parse(messageStr);
        } catch {
          // Binary data (audio)
          handleAudioChunk(session, data);
          return;
        }

        // Validate control message
        if (!isValidControlMessage(parsedMessage)) {
          console.warn('[Voice Pipeline] Invalid control message format:', parsedMessage);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
          return;
        }

        await handleControlMessage(session, parsedMessage);
      } catch (error) {
        console.error('[Voice Pipeline] Message handling error:', error);
        try {
          ws.send(JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Internal server error'
          }));
        } catch (sendError) {
          console.error('[Voice Pipeline] Error sending error message:', sendError);
        }
      }
    });

    ws.on('close', () => {
      console.log('[Voice Pipeline] Client disconnected');
      cleanupSession(ws);
    });

    ws.on('error', (error) => {
      console.error('[Voice Pipeline] WebSocket error:', error);
      cleanupSession(ws);

      // Try to close gracefully
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1011, 'Internal error');
        }
      } catch (closeError) {
        console.error('[Voice Pipeline] Error closing WebSocket:', closeError);
      }
    });
  });

  console.log('[Voice Pipeline] WebSocket server initialized on /ws/voice-pipeline');
}

/**
 * Handle control messages from client
 */
async function handleControlMessage(session: VoiceSession, message: ControlMessage) {
  const { type } = message;

  switch (type) {
    case 'start_recording':
      if (session.isProcessing) {
        session.ws.send(JSON.stringify({
          type: 'error',
          message: 'Cannot start recording while processing'
        }));
        return;
      }

      session.audioChunks = [];
      session.ws.send(JSON.stringify({
        type: 'recording_started',
        message: 'Ready to receive audio'
      }));
      break;

    case 'stop_recording':
      if (session.audioChunks.length === 0) {
        session.ws.send(JSON.stringify({
          type: 'error',
          message: 'No audio recorded'
        }));
        return;
      }

      if (session.audioChunks.length > 0) {
        await processVoiceInput(session);
      }
      break;

    case 'reset':
      session.audioChunks = [];
      session.conversationHistory = [];
      session.isProcessing = false;
      session.ws.send(JSON.stringify({
        type: 'reset_complete',
        message: 'Session reset'
      }));
      break;
  }
}

/**
 * Handle incoming audio chunks
 */
function handleAudioChunk(session: VoiceSession, chunk: Buffer) {
  if (session.isProcessing) {
    console.warn('[Voice Pipeline] Received audio chunk while processing, ignoring');
    return;
  }

  // Prevent memory exhaustion
  if (session.audioChunks.length >= MAX_AUDIO_CHUNKS) {
    console.warn('[Voice Pipeline] Maximum audio chunks reached, discarding oldest');
    session.audioChunks.shift();
  }

  session.audioChunks.push(chunk);
}

/**
 * Process voice input through the pipeline with timeout
 */
async function processVoiceInput(session: VoiceSession) {
  if (session.isProcessing) {
    console.warn('[Voice Pipeline] Already processing, ignoring duplicate request');
    return;
  }

  session.isProcessing = true;

  try {
    session.ws.send(JSON.stringify({ type: 'processing_started' }));
  } catch (error) {
    console.error('[Voice Pipeline] Error sending processing_started:', error);
    session.isProcessing = false;
    return;
  }

  // Set up processing timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Processing timeout')), PROCESSING_TIMEOUT_MS);
  });

  try {
    // Race between actual processing and timeout
    await Promise.race([
      (async () => {
        // Step 1: Transcribe audio with Whisper
        const transcript = await transcribeAudio(session.audioChunks);

        if (!transcript || transcript.trim().length === 0) {
          throw new Error('No speech detected in audio');
        }

        session.ws.send(JSON.stringify({
          type: 'transcript',
          text: transcript
        }));

        // Step 2: Process with Claude
        const response = await processWithClaude(session, transcript);

        if (!response || response.trim().length === 0) {
          throw new Error('No response generated');
        }

        session.ws.send(JSON.stringify({
          type: 'response_text',
          text: response
        }));

        // Step 3: Generate speech with ElevenLabs
        await generateAndStreamSpeech(session, response);

        session.ws.send(JSON.stringify({ type: 'processing_complete' }));
      })(),
      timeoutPromise
    ]);

  } catch (error) {
    console.error('[Voice Pipeline] Processing error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Processing failed';

    try {
      session.ws.send(JSON.stringify({
        type: 'error',
        message: errorMessage
      }));
    } catch (sendError) {
      console.error('[Voice Pipeline] Error sending error message:', sendError);
    }
  } finally {
    session.isProcessing = false;
    session.audioChunks = [];
    resetSessionTimeout(session);
  }
}

/**
 * Transcribe audio using OpenAI Whisper
 */
async function transcribeAudio(audioChunks: Buffer[]): Promise<string> {
  // Combine all audio chunks
  const audioBuffer = Buffer.concat(audioChunks);
  
  // Create a file-like object for Whisper API
  const audioFile = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });
  
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: 'en'
  });

  return transcription.text;
}

/**
 * Process text with Claude Sonnet 4.5
 */
async function processWithClaude(session: VoiceSession, userMessage: string): Promise<string> {
  // Limit conversation history to prevent memory issues
  if (session.conversationHistory.length >= MAX_CONVERSATION_HISTORY) {
    // Keep system context but remove oldest user/assistant pairs
    session.conversationHistory = session.conversationHistory.slice(-MAX_CONVERSATION_HISTORY + 2);
  }

  // Add user message to history
  session.conversationHistory.push({
    role: 'user',
    content: userMessage
  });

  // System prompt for Jarvis - COMPLETE PRINTAVO-LEVEL SYSTEM
  const systemPrompt = `You are Jarvis, an advanced AI assistant for a complete print shop management system with full voice control.

You can manage the ENTIRE print shop workflow: customers, quotes, invoices, products, tasks, payments, and production.

Be professional, conversational, and efficient. When tool usage is needed, respond with ONLY a JSON object.

═══════════════════════════════════════════════════════════════════════════════
📋 CUSTOMER MANAGEMENT (8 tools)
═══════════════════════════════════════════════════════════════════════════════

1. create_customer - Create new customer
   Required: name
   Optional: email, phone, company, credit_limit, billing_address, shipping_address, notes
   {"tool": "create_customer", "params": {"name": "ABC Corp", "email": "info@abc.com", "credit_limit": 10000}}

2. update_customer - Update customer info
   Required: name
   Optional: email, phone, company, credit_limit, billing_address, shipping_address, notes
   {"tool": "update_customer", "params": {"name": "ABC Corp", "phone": "555-9999", "credit_limit": 15000}}

3. get_customer_details - Get full customer information
   Required: name
   {"tool": "get_customer_details", "params": {"name": "ABC Corp"}}

4. search_customers - Search customers by name/company
   Required: query
   Optional: limit (default 20)
   {"tool": "search_customers", "params": {"query": "ABC"}}

5. list_customers - List all customers
   Optional: limit (default 20)
   {"tool": "list_customers", "params": {"limit": 50}}

6. delete_customer - Delete customer (prevents if has orders)
   Required: name
   {"tool": "delete_customer", "params": {"name": "Old Customer"}}

7. get_customer_history - Get customer's recent quotes
   Required: customer_name
   {"tool": "get_customer_history", "params": {"customer_name": "ABC Corp"}}

═══════════════════════════════════════════════════════════════════════════════
💰 QUOTE MANAGEMENT (8 tools)
═══════════════════════════════════════════════════════════════════════════════

8. create_quote - Create new quote with FULL print shop features
   Required: customer_name, line_items (or groups)
   Optional: tax_rate, delivery_method, po_number, terms, production_due_date, customer_due_date, notes

   Line item with SIZES: {
     product_name, unit_price,
     sizes: { size_S: 10, size_M: 20, size_L: 15, size_XL: 5 },
     color, item_number, notes, artwork_urls
   }

   Groups with IMPRINTS: [{
     name: "Front Print",
     decoration_method: "Screen Print",
     line_items: [...],
     imprints: [{
       location: "Front",
       decoration_method: "Screen Print",
       colors: 2,
       setup_fee: 50,
       unit_price: 1.50
     }]
   }]

   Example: {"tool": "create_quote", "params": {
     "customer_name": "ABC Corp",
     "tax_rate": 8.5,
     "po_number": "PO-12345",
     "groups": [{
       "name": "T-Shirts - Front/Back Print",
       "decoration_method": "Screen Print",
       "line_items": [{
         "product_name": "Gildan 5000 T-Shirt",
         "unit_price": 3.50,
         "color": "Black",
         "sizes": {"size_S": 10, "size_M": 30, "size_L": 40, "size_XL": 20}
       }],
       "imprints": [{
         "location": "Front",
         "colors": 2,
         "setup_fee": 50,
         "unit_price": 1.25
       }, {
         "location": "Back",
         "colors": 1,
         "setup_fee": 40,
         "unit_price": 0.75
       }]
     }]
   }}

9. update_quote - Update existing quote
   Required: quote_number OR quote_id
   Optional: status, tax_rate, delivery_method, po_number, terms, notes, production_due_date, customer_due_date
   {"tool": "update_quote", "params": {"quote_number": 123, "tax_rate": 9.0, "po_number": "PO-99999"}}

10. get_quote_details - Get complete quote information
    Required: quote_number OR quote_id
    {"tool": "get_quote_details", "params": {"quote_number": 123}}

11. list_quotes - List all quotes
    Optional: status (quote/approved/rejected/converted), limit (default 20)
    {"tool": "list_quotes", "params": {"status": "quote", "limit": 10}}

12. approve_quote - Approve quote (creates production tasks)
    Required: quote_number OR quote_id
    Optional: create_tasks (default true)
    {"tool": "approve_quote", "params": {"quote_number": 123}}

13. reject_quote - Reject quote with reason
    Required: quote_number OR quote_id
    Optional: reason
    {"tool": "reject_quote", "params": {"quote_number": 123, "reason": "Customer cancelled"}}

14. delete_quote - Delete quote
    Required: quote_number OR quote_id
    {"tool": "delete_quote", "params": {"quote_number": 123}}

15. convert_quote_to_invoice - Convert approved quote to invoice
    Required: quote_number OR quote_id
    {"tool": "convert_quote_to_invoice", "params": {"quote_number": 123}}

═══════════════════════════════════════════════════════════════════════════════
📄 INVOICE MANAGEMENT (4 tools)
═══════════════════════════════════════════════════════════════════════════════

16. get_invoice_details - Get complete invoice info
    Required: invoice_number OR invoice_id
    {"tool": "get_invoice_details", "params": {"invoice_number": 456}}

17. list_invoices - List all invoices
    Optional: status (pending/in_production/shipped/paid), limit (default 20)
    {"tool": "list_invoices", "params": {"status": "pending"}}

18. update_invoice_status - Update production/payment status
    Required: invoice_number OR invoice_id, status
    Status: pending/in_production/ready_to_print/ready_to_sew/production_finished/shipped/completed/paid
    {"tool": "update_invoice_status", "params": {"invoice_number": 456, "status": "in_production"}}

19. record_payment - Record payment on invoice
    Required: invoice_number OR invoice_id, amount
    Optional: payment_method (default "cash"), notes
    {"tool": "record_payment", "params": {"invoice_number": 456, "amount": 500, "payment_method": "credit_card"}}

═══════════════════════════════════════════════════════════════════════════════
🎽 PRODUCT MANAGEMENT (5 tools)
═══════════════════════════════════════════════════════════════════════════════

20. create_product - Add product to catalog
    Required: name
    Optional: item_number, brand, category, description, base_price, colors, sizes, image_url
    {"tool": "create_product", "params": {"name": "Gildan 5000", "item_number": "G500", "brand": "Gildan", "base_price": 3.50}}

21. update_product - Update product info
    Required: item_number OR product_id
    Optional: name, brand, category, description, base_price, active
    {"tool": "update_product", "params": {"item_number": "G500", "base_price": 3.75}}

22. get_product_details - Get product information
    Required: item_number OR product_id
    {"tool": "get_product_details", "params": {"item_number": "G500"}}

23. search_products - Search products by name
    Required: query
    {"tool": "search_products", "params": {"query": "gildan"}}

24. list_products - List all products
    Optional: active_only (default true), limit (default 50)
    {"tool": "list_products", "params": {"active_only": false, "limit": 100}}

═══════════════════════════════════════════════════════════════════════════════
✅ TASK MANAGEMENT (4 tools)
═══════════════════════════════════════════════════════════════════════════════

25. create_task - Create production/general task
    Required: name
    Optional: invoice_id, quote_id, assigned_to, due_date, priority (low/medium/high/urgent), notes
    {"tool": "create_task", "params": {"name": "Screen print 100 shirts", "priority": "high", "due_date": "2025-11-01"}}

26. update_task - Update task details
    Required: task_id
    Optional: name, assigned_to, due_date, priority, notes, completed
    {"tool": "update_task", "params": {"task_id": "task_123", "assigned_to": "John", "priority": "urgent"}}

27. complete_task - Mark task as complete
    Required: task_id
    {"tool": "complete_task", "params": {"task_id": "task_123"}}

28. list_tasks - List pending/all tasks
    Optional: show_completed (default false), limit (default 20)
    {"tool": "list_tasks", "params": {"show_completed": false}}

═══════════════════════════════════════════════════════════════════════════════
🎯 USAGE GUIDELINES
═══════════════════════════════════════════════════════════════════════════════

PRINT SHOP WORKFLOW:
1. Customer inquiry → create_customer (if new) → search_products
2. Create quote with sizes, decorations, setup fees → approve_quote
3. Convert to invoice → update_invoice_status (track production)
4. Record payments → complete_task

SIZE BREAKDOWN - ALWAYS ask for sizes on apparel orders:
  Toddler: 2T, 3T, 4T, 5T
  Youth: YXS, YS, YM, YL, YXL
  Adult: XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL, 6XL

DECORATION METHODS: Screen Print, Embroidery, DTG, Vinyl, Heat Transfer

IMPORTANT:
- Always respond with ONLY JSON when calling tools (no additional text)
- For quotes: collect customer, products, quantities, SIZES, decorations, setup fees
- Check credit limits automatically
- Confirm destructive actions (delete, reject)
- Use quote/invoice numbers for user-friendly references`;

  // Call Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: session.conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))
  });

  const assistantMessage = response.content[0].type === 'text' 
    ? response.content[0].text 
    : '';

  // Check if Claude wants to use a tool
  if (assistantMessage.includes('"tool":')) {
    try {
      // Attempt to extract JSON from the message
      // Claude might wrap it in markdown code blocks or include extra text
      let jsonStr = assistantMessage.trim();

      // Remove markdown code blocks if present
      if (jsonStr.includes('```json')) {
        const match = jsonStr.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (match) {
          jsonStr = match[1];
        }
      } else if (jsonStr.includes('```')) {
        const match = jsonStr.match(/```\s*(\{[\s\S]*?\})\s*```/);
        if (match) {
          jsonStr = match[1];
        }
      }

      // Try to find JSON object in the text
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const toolCall = JSON.parse(jsonStr);

      // Validate tool call structure
      if (!toolCall.tool || typeof toolCall.tool !== 'string') {
        throw new Error('Invalid tool call: missing or invalid "tool" field');
      }

      if (!toolCall.params || typeof toolCall.params !== 'object') {
        console.warn('[Voice Pipeline] Tool call missing params, using empty object');
        toolCall.params = {};
      }

      console.log('[Voice Pipeline] Executing tool:', toolCall.tool, 'with params:', JSON.stringify(toolCall.params));

      const toolResult = await executeTool(toolCall.tool, toolCall.params);

      console.log('[Voice Pipeline] Tool result:', JSON.stringify(toolResult));

      // Add tool result to conversation
      session.conversationHistory.push({
        role: 'assistant',
        content: `Tool executed: ${JSON.stringify(toolResult)}`
      });

      // Get Claude's response after tool execution
      const followUpResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: session.conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }))
      });

      const finalMessage = followUpResponse.content[0].type === 'text'
        ? followUpResponse.content[0].text
        : '';

      session.conversationHistory.push({
        role: 'assistant',
        content: finalMessage
      });

      return finalMessage;
    } catch (error) {
      console.error('[Voice Pipeline] Tool execution error:', error);

      // Return a helpful error message to the user
      const errorMessage = error instanceof Error
        ? `I encountered an error while processing your request: ${error.message}. Could you please try rephrasing your request?`
        : 'I encountered an unexpected error. Could you please try again?';

      session.conversationHistory.push({
        role: 'assistant',
        content: errorMessage
      });

      return errorMessage;
    }
  }

  // Add assistant message to history
  session.conversationHistory.push({
    role: 'assistant',
    content: assistantMessage
  });

  return assistantMessage;
}

/**
 * Execute tool functions
 */
async function executeTool(toolName: string, params: any): Promise<any> {
  const db = getDb();

  switch (toolName) {
    case 'create_quote':
      // Import required functions
      const { getCustomerByName, createCustomer, getNextQuoteNumber, recalculateQuoteTotal, getCustomerOutstandingBalance } = await import('./db');
      const { checkCreditLimit } = await import('./businessLogic');

      // Find or create customer
      let customer = await getCustomerByName(params.customer_name);
      if (!customer) {
        customer = await createCustomer({
          name: params.customer_name,
          email: params.customer_email || null,
          phone: null,
          company: params.customer_name,
          billingAddress: null,
          shippingAddress: null,
          notes: null,
          creditLimit: '0',
        });
      }

      if (!customer) {
        return {
          success: false,
          error: 'Failed to find or create customer'
        };
      }

      // Get next quote number
      const quoteNumber = await getNextQuoteNumber();

      // Generate quote ID
      const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Calculate tax amount if tax rate provided
      const taxRate = params.tax_rate || 0;

      // Create quote in database with correct schema
      await db.insert(schema.quotes).values({
        id: quoteId,
        quoteNumber: quoteNumber,
        customerId: customer.id,
        status: 'quote',
        totalAmount: '0.00', // Will be recalculated
        taxAmount: '0.00',
        taxRate: String(taxRate),
        deliveryMethod: params.delivery_method || null,
        poNumber: params.po_number || null,
        terms: params.terms || null,
        productionDueDate: params.production_due_date ? new Date(params.production_due_date) : null,
        customerDueDate: params.customer_due_date ? new Date(params.customer_due_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        notes: params.notes || null,
        createdBy: params.created_by || 'voice_assistant',
      });

      // Create line item groups (can have multiple for different decoration methods)
      const groups = params.groups || [{
        name: params.group_name || 'Order Items',
        decoration_method: params.decoration_method || null,
        line_items: params.line_items || [],
        imprints: params.imprints || []
      }];

      let totalItemCount = 0;
      const priceWarnings: string[] = [];

      for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
        const groupData = groups[groupIndex];
        const groupId = `lig_${Date.now()}_${groupIndex}_${Math.random().toString(36).substring(2, 9)}`;

        await db.insert(schema.lineItemGroups).values({
          id: groupId,
          quoteId: quoteId,
          invoiceId: null,
          name: groupData.name || `Group ${groupIndex + 1}`,
          decorationMethod: groupData.decoration_method || null,
          notes: groupData.notes || null,
          sortOrder: groupIndex,
        });

        // Add line items to the group with SIZE BREAKDOWN support
        let itemIndex = 0;

        for (const item of groupData.line_items || []) {
          const lineItemId = `li_${Date.now()}_${groupIndex}_${itemIndex}_${Math.random().toString(36).substring(2, 9)}`;

          // Try to validate price against product catalog
          let validatedPrice = item.unit_price || 0;
          let productId = null;

          if (item.item_number) {
            try {
              const products = await db.select()
                .from(schema.products)
                .where(eq(schema.products.itemNumber, item.item_number))
                .limit(1);

              if (products.length > 0) {
                const catalogProduct = products[0];
                productId = catalogProduct.id;
                const catalogPrice = parseFloat(catalogProduct.basePrice || '0');

                if (Math.abs(validatedPrice - catalogPrice) > 0.01) {
                  priceWarnings.push(
                    `${item.product_name || item.item_number}: Voice price $${validatedPrice.toFixed(2)} differs from catalog $${catalogPrice.toFixed(2)}`
                  );
                }
              }
            } catch (err) {
              console.warn('[Voice Pipeline] Could not validate price for item:', item.item_number, err);
            }
          }

          // Calculate total quantity from sizes or use provided quantity
          const sizes = item.sizes || {};
          const totalQty = sizes.size_2T || 0 + sizes.size_3T || 0 + sizes.size_4T || 0 + sizes.size_5T || 0 +
                          sizes.size_YXS || 0 + sizes.size_YS || 0 + sizes.size_YM || 0 + sizes.size_YL || 0 + sizes.size_YXL || 0 +
                          sizes.size_XS || 0 + sizes.size_S || 0 + sizes.size_M || 0 + sizes.size_L || 0 +
                          sizes.size_XL || 0 + sizes.size_2XL || 0 + sizes.size_3XL || 0 + sizes.size_4XL || 0 +
                          sizes.size_5XL || 0 + sizes.size_6XL || 0 + sizes.size_Other || 0;

          const finalQuantity = totalQty > 0 ? totalQty : (item.quantity || 0);

          await db.insert(schema.lineItems).values({
            id: lineItemId,
            groupId: groupId,
            quoteId: quoteId,
            invoiceId: null,
            productId: productId,
            itemNumber: item.item_number || null,
            description: item.product_name || item.description,
            color: item.color || null,
            // Size breakdown fields
            size2T: sizes.size_2T || 0,
            size3T: sizes.size_3T || 0,
            size4T: sizes.size_4T || 0,
            size5T: sizes.size_5T || 0,
            sizeYXS: sizes.size_YXS || 0,
            sizeYS: sizes.size_YS || 0,
            sizeYM: sizes.size_YM || 0,
            sizeYL: sizes.size_YL || 0,
            sizeYXL: sizes.size_YXL || 0,
            sizeXS: sizes.size_XS || 0,
            sizeS: sizes.size_S || 0,
            sizeM: sizes.size_M || 0,
            sizeL: sizes.size_L || 0,
            sizeXL: sizes.size_XL || 0,
            size2XL: sizes.size_2XL || 0,
            size3XL: sizes.size_3XL || 0,
            size4XL: sizes.size_4XL || 0,
            size5XL: sizes.size_5XL || 0,
            size6XL: sizes.size_6XL || 0,
            sizeOther: sizes.size_Other || 0,
            quantity: finalQuantity,
            unitPrice: String(validatedPrice),
            totalPrice: String(finalQuantity * validatedPrice),
            artworkUrls: item.artwork_urls ? JSON.stringify(item.artwork_urls) : null,
            notes: item.notes || null,
            sortOrder: itemIndex,
          });

          itemIndex++;
          totalItemCount++;
        }

        // Add imprints/decorations to the group
        let imprintIndex = 0;
        for (const imprint of groupData.imprints || []) {
          const imprintId = `imp_${Date.now()}_${groupIndex}_${imprintIndex}_${Math.random().toString(36).substring(2, 9)}`;

          await db.insert(schema.imprints).values({
            id: imprintId,
            groupId: groupId,
            location: imprint.location || null,
            decorationMethod: imprint.decoration_method || groupData.decoration_method || null,
            colors: imprint.colors || 1,
            stitchCount: imprint.stitch_count || null,
            artworkUrl: imprint.artwork_url || null,
            setupFee: String(imprint.setup_fee || 0),
            unitPrice: String(imprint.unit_price || 0),
            notes: imprint.notes || null,
            sortOrder: imprintIndex,
          });

          imprintIndex++;
        }
      }

      // Add price warnings to notes if any
      if (priceWarnings.length > 0) {
        const warningNote = `\n\nPrice Warnings:\n${priceWarnings.join('\n')}`;
        await db.update(schema.quotes)
          .set({ notes: (params.notes || '') + warningNote })
          .where(eq(schema.quotes.id, quoteId));
      }

      // Recalculate quote total (includes imprints and setup fees)
      const calculatedTotal = await recalculateQuoteTotal(quoteId);

      // Check credit limit if customer has one
      const creditLimit = parseFloat(customer.creditLimit || '0');
      let creditWarning = '';
      if (creditLimit > 0 && calculatedTotal) {
        const creditCheck = await checkCreditLimit(customer.id, calculatedTotal);
        if (!creditCheck.allowed) {
          creditWarning = ` WARNING: This quote ($${calculatedTotal.toFixed(2)}) would exceed customer's credit limit of $${creditLimit.toFixed(2)}. Current outstanding: $${creditCheck.outstanding.toFixed(2)}.`;
        }
      }

      return {
        success: true,
        quote_id: quoteId,
        quote_number: `Q-${String(quoteNumber).padStart(5, '0')}`,
        customer_name: customer.name,
        total: calculatedTotal || 0,
        item_count: totalItemCount,
        group_count: groups.length,
        message: `Quote Q-${String(quoteNumber).padStart(5, '0')} created successfully for ${customer.name} with ${totalItemCount} items in ${groups.length} group(s) totaling $${(calculatedTotal || 0).toFixed(2)}${creditWarning}`
      };

    case 'search_products':
      const products = await db.select()
        .from(schema.products)
        .where(eq(schema.products.name, params.query))
        .limit(10);

      return {
        success: true,
        products: products.map(p => ({
          name: p.name,
          sku: p.sku,
          price: p.price
        }))
      };

    case 'get_customer_history':
      const { getCustomer } = await import('./db');

      // First find customer by name
      const { getCustomerByName: getCustomerByNameHist } = await import('./db');
      const histCustomer = await getCustomerByNameHist(params.customer_name);

      if (!histCustomer) {
        return {
          success: false,
          error: `Customer "${params.customer_name}" not found`
        };
      }

      const customerQuotes = await db.select()
        .from(schema.quotes)
        .where(eq(schema.quotes.customerId, histCustomer.id))
        .limit(5);

      return {
        success: true,
        customer_name: histCustomer.name,
        quotes: customerQuotes.map(q => ({
          quote_number: q.quoteNumber,
          status: q.status,
          total: q.totalAmount,
          created_at: q.createdAt
        }))
      };

    case 'create_customer':
      const { createCustomer: createCust } = await import('./db');

      const newCustomer = await createCust({
        name: params.name,
        email: params.email || null,
        phone: params.phone || null,
        company: params.company || params.name,
        billingAddress: params.billing_address || null,
        shippingAddress: params.shipping_address || null,
        notes: params.notes || null,
        creditLimit: String(params.credit_limit || 0),
      });

      return {
        success: true,
        customer_id: newCustomer.id,
        customer_name: newCustomer.name,
        credit_limit: newCustomer.creditLimit,
        message: `Customer "${newCustomer.name}" created successfully${params.credit_limit ? ` with credit limit of $${params.credit_limit}` : ''}`
      };

    case 'update_customer':
      const { updateCustomer, getCustomerByName: getCustomerUpdate } = await import('./db');

      // Find customer by name
      const customerToUpdate = await getCustomerUpdate(params.name);

      if (!customerToUpdate) {
        return {
          success: false,
          error: `Customer "${params.name}" not found`
        };
      }

      // Build update object with only provided fields
      const updates: any = {};
      if (params.email !== undefined) updates.email = params.email;
      if (params.phone !== undefined) updates.phone = params.phone;
      if (params.company !== undefined) updates.company = params.company;
      if (params.billing_address !== undefined) updates.billingAddress = params.billing_address;
      if (params.shipping_address !== undefined) updates.shippingAddress = params.shipping_address;
      if (params.notes !== undefined) updates.notes = params.notes;
      if (params.credit_limit !== undefined) updates.creditLimit = String(params.credit_limit);

      await updateCustomer(customerToUpdate.id, updates);

      return {
        success: true,
        customer_name: customerToUpdate.name,
        message: `Customer "${customerToUpdate.name}" updated successfully`
      };

    case 'search_customers':
      const { searchCustomers } = await import('./db');

      const foundCustomers = await searchCustomers(params.query);

      return {
        success: true,
        count: foundCustomers.length,
        customers: foundCustomers.slice(0, 10).map(c => ({
          name: c.name,
          company: c.company,
          email: c.email,
          phone: c.phone
        })),
        message: `Found ${foundCustomers.length} customer${foundCustomers.length !== 1 ? 's' : ''} matching "${params.query}"`
      };

    case 'delete_customer':
      const { deleteCustomer, getCustomerByName: getCustomerDelete } = await import('./db');

      // Find customer by name
      const customerToDelete = await getCustomerDelete(params.name);

      if (!customerToDelete) {
        return {
          success: false,
          error: `Customer "${params.name}" not found`
        };
      }

      // Check if customer has quotes or invoices
      const customerQuotesCheck = await db.select()
        .from(schema.quotes)
        .where(eq(schema.quotes.customerId, customerToDelete.id))
        .limit(1);

      const customerInvoices = await db.select()
        .from(schema.invoices)
        .where(eq(schema.invoices.customerId, customerToDelete.id))
        .limit(1);

      if (customerQuotesCheck.length > 0 || customerInvoices.length > 0) {
        return {
          success: false,
          error: `Cannot delete customer "${params.name}" - they have existing quotes or invoices. Please archive instead.`
        };
      }

      await deleteCustomer(customerToDelete.id);

      return {
        success: true,
        message: `Customer "${params.name}" deleted successfully`
      };

    case 'get_customer_details':
      const { getCustomer: getCustDetails, getCustomerByName: getCustByName } = await import('./db');

      // Find customer by name
      const custDetails = await getCustByName(params.name);

      if (!custDetails) {
        return {
          success: false,
          error: `Customer "${params.name}" not found`
        };
      }

      return {
        success: true,
        customer: {
          name: custDetails.name,
          email: custDetails.email,
          phone: custDetails.phone,
          company: custDetails.company,
          credit_limit: custDetails.creditLimit,
          billing_address: custDetails.billingAddress,
          shipping_address: custDetails.shippingAddress,
          notes: custDetails.notes,
          created_at: custDetails.createdAt
        },
        message: `Retrieved details for ${custDetails.name}`
      };

    case 'list_customers':
      const { getAllCustomers } = await import('./db');

      const allCustomers = await getAllCustomers();
      const customerLimit = params.limit || 20;

      return {
        success: true,
        count: allCustomers.length,
        customers: allCustomers.slice(0, customerLimit).map(c => ({
          name: c.name,
          company: c.company,
          email: c.email,
          phone: c.phone,
          credit_limit: c.creditLimit
        })),
        message: `Found ${allCustomers.length} customers (showing ${Math.min(customerLimit, allCustomers.length)})`
      };

    case 'update_quote':
      const { getQuote, updateQuote, recalculateQuoteTotal: recalcQuote } = await import('./db');

      // Find quote by number or ID
      let quoteToUpdate;
      if (params.quote_number) {
        const quotes = await db.select().from(schema.quotes).where(eq(schema.quotes.quoteNumber, params.quote_number)).limit(1);
        quoteToUpdate = quotes[0];
      } else if (params.quote_id) {
        quoteToUpdate = await getQuote(params.quote_id);
      }

      if (!quoteToUpdate) {
        return {
          success: false,
          error: `Quote not found`
        };
      }

      // Build update object
      const quoteUpdates: any = {};
      if (params.status !== undefined) quoteUpdates.status = params.status;
      if (params.tax_rate !== undefined) quoteUpdates.taxRate = String(params.tax_rate);
      if (params.delivery_method !== undefined) quoteUpdates.deliveryMethod = params.delivery_method;
      if (params.po_number !== undefined) quoteUpdates.poNumber = params.po_number;
      if (params.terms !== undefined) quoteUpdates.terms = params.terms;
      if (params.notes !== undefined) quoteUpdates.notes = params.notes;
      if (params.production_due_date !== undefined) quoteUpdates.productionDueDate = new Date(params.production_due_date);
      if (params.customer_due_date !== undefined) quoteUpdates.customerDueDate = new Date(params.customer_due_date);

      await updateQuote(quoteToUpdate.id, quoteUpdates);

      // Recalculate if tax rate changed
      if (params.tax_rate !== undefined) {
        await recalcQuote(quoteToUpdate.id);
      }

      return {
        success: true,
        quote_number: `Q-${String(quoteToUpdate.quoteNumber).padStart(5, '0')}`,
        message: `Quote Q-${String(quoteToUpdate.quoteNumber).padStart(5, '0')} updated successfully`
      };

    case 'delete_quote':
      const { deleteQuote } = await import('./db');

      let quoteToDelete;
      if (params.quote_number) {
        const quotes = await db.select().from(schema.quotes).where(eq(schema.quotes.quoteNumber, params.quote_number)).limit(1);
        quoteToDelete = quotes[0];
      } else if (params.quote_id) {
        const { getQuote: getQ } = await import('./db');
        quoteToDelete = await getQ(params.quote_id);
      }

      if (!quoteToDelete) {
        return {
          success: false,
          error: `Quote not found`
        };
      }

      // Check if already converted to invoice
      if (quoteToDelete.status === 'converted') {
        return {
          success: false,
          error: `Cannot delete quote Q-${String(quoteToDelete.quoteNumber).padStart(5, '0')} - already converted to invoice`
        };
      }

      await deleteQuote(quoteToDelete.id);

      return {
        success: true,
        message: `Quote Q-${String(quoteToDelete.quoteNumber).padStart(5, '0')} deleted successfully`
      };

    case 'approve_quote':
      const { approveQuote } = await import('./businessLogic');

      let quoteToApprove;
      if (params.quote_number) {
        const quotes = await db.select().from(schema.quotes).where(eq(schema.quotes.quoteNumber, params.quote_number)).limit(1);
        quoteToApprove = quotes[0];
      } else if (params.quote_id) {
        const { getQuote: getQA } = await import('./db');
        quoteToApprove = await getQA(params.quote_id);
      }

      if (!quoteToApprove) {
        return {
          success: false,
          error: `Quote not found`
        };
      }

      await approveQuote(quoteToApprove.id, params.create_tasks !== false);

      return {
        success: true,
        quote_number: `Q-${String(quoteToApprove.quoteNumber).padStart(5, '0')}`,
        message: `Quote Q-${String(quoteToApprove.quoteNumber).padStart(5, '0')} approved successfully${params.create_tasks !== false ? ' and production tasks created' : ''}`
      };

    case 'reject_quote':
      const { rejectQuote } = await import('./businessLogic');

      let quoteToReject;
      if (params.quote_number) {
        const quotes = await db.select().from(schema.quotes).where(eq(schema.quotes.quoteNumber, params.quote_number)).limit(1);
        quoteToReject = quotes[0];
      } else if (params.quote_id) {
        const { getQuote: getQR } = await import('./db');
        quoteToReject = await getQR(params.quote_id);
      }

      if (!quoteToReject) {
        return {
          success: false,
          error: `Quote not found`
        };
      }

      await rejectQuote(quoteToReject.id, params.reason);

      return {
        success: true,
        quote_number: `Q-${String(quoteToReject.quoteNumber).padStart(5, '0')}`,
        message: `Quote Q-${String(quoteToReject.quoteNumber).padStart(5, '0')} rejected${params.reason ? `: ${params.reason}` : ''}`
      };

    case 'get_quote_details':
      const { getQuote: getQuoteDet, getLineItemGroupsByQuote, getCustomer: getCust } = await import('./db');

      let quoteDetails;
      if (params.quote_number) {
        const quotes = await db.select().from(schema.quotes).where(eq(schema.quotes.quoteNumber, params.quote_number)).limit(1);
        quoteDetails = quotes[0];
      } else if (params.quote_id) {
        quoteDetails = await getQuoteDet(params.quote_id);
      }

      if (!quoteDetails) {
        return {
          success: false,
          error: `Quote not found`
        };
      }

      const quoteCustomer = await getCust(quoteDetails.customerId);
      const groups = await getLineItemGroupsByQuote(quoteDetails.id);

      const groupDetails = [];
      for (const group of groups) {
        const items = await db.select().from(schema.lineItems).where(eq(schema.lineItems.groupId, group.id));
        const imprints = await db.select().from(schema.imprints).where(eq(schema.imprints.groupId, group.id));

        groupDetails.push({
          name: group.name,
          decoration_method: group.decorationMethod,
          items: items.map(i => ({
            description: i.description,
            color: i.color,
            quantity: i.quantity,
            unit_price: i.unitPrice,
            total: i.totalPrice
          })),
          imprints: imprints.map(imp => ({
            location: imp.location,
            method: imp.decorationMethod,
            colors: imp.colors,
            setup_fee: imp.setupFee,
            unit_price: imp.unitPrice
          }))
        });
      }

      return {
        success: true,
        quote: {
          quote_number: `Q-${String(quoteDetails.quoteNumber).padStart(5, '0')}`,
          customer_name: quoteCustomer?.name,
          status: quoteDetails.status,
          total: quoteDetails.totalAmount,
          tax_amount: quoteDetails.taxAmount,
          tax_rate: quoteDetails.taxRate,
          delivery_method: quoteDetails.deliveryMethod,
          po_number: quoteDetails.poNumber,
          terms: quoteDetails.terms,
          production_due_date: quoteDetails.productionDueDate,
          customer_due_date: quoteDetails.customerDueDate,
          notes: quoteDetails.notes,
          groups: groupDetails,
          created_at: quoteDetails.createdAt
        },
        message: `Retrieved details for quote Q-${String(quoteDetails.quoteNumber).padStart(5, '0')}`
      };

    case 'list_quotes':
      const { getAllQuotes } = await import('./db');

      const allQuotes = await getAllQuotes();
      const filterStatus = params.status;
      const quoteLimit = params.limit || 20;

      let filteredQuotes = allQuotes;
      if (filterStatus) {
        filteredQuotes = allQuotes.filter(q => q.status === filterStatus);
      }

      return {
        success: true,
        count: filteredQuotes.length,
        quotes: filteredQuotes.slice(0, quoteLimit).map(q => ({
          quote_number: `Q-${String(q.quoteNumber).padStart(5, '0')}`,
          status: q.status,
          total: q.totalAmount,
          customer_due_date: q.customerDueDate,
          created_at: q.createdAt
        })),
        message: `Found ${filteredQuotes.length} quotes${filterStatus ? ` with status "${filterStatus}"` : ''} (showing ${Math.min(quoteLimit, filteredQuotes.length)})`
      };

    case 'convert_quote_to_invoice':
      const { getQuote: getQConv, createInvoice, getLineItemGroupsByQuote: getGroups } = await import('./db');

      let quoteToConvert;
      if (params.quote_number) {
        const quotes = await db.select().from(schema.quotes).where(eq(schema.quotes.quoteNumber, params.quote_number)).limit(1);
        quoteToConvert = quotes[0];
      } else if (params.quote_id) {
        quoteToConvert = await getQConv(params.quote_id);
      }

      if (!quoteToConvert) {
        return {
          success: false,
          error: `Quote not found`
        };
      }

      if (quoteToConvert.status !== 'approved') {
        return {
          success: false,
          error: `Quote Q-${String(quoteToConvert.quoteNumber).padStart(5, '0')} must be approved before converting to invoice`
        };
      }

      // Create invoice from quote
      const newInvoice = await createInvoice({
        quoteId: quoteToConvert.id,
        customerId: quoteToConvert.customerId,
        status: 'pending',
        totalAmount: quoteToConvert.totalAmount,
        paidAmount: '0.00',
        taxAmount: quoteToConvert.taxAmount,
        taxRate: quoteToConvert.taxRate,
        deliveryMethod: quoteToConvert.deliveryMethod,
        poNumber: quoteToConvert.poNumber,
        terms: quoteToConvert.terms,
        productionDueDate: quoteToConvert.productionDueDate,
        customerDueDate: quoteToConvert.customerDueDate,
        notes: quoteToConvert.notes,
      });

      // Copy line item groups and items to invoice
      const quoteGroups = await getGroups(quoteToConvert.id);
      for (const group of quoteGroups) {
        const newGroupId = `lig_inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        await db.insert(schema.lineItemGroups).values({
          id: newGroupId,
          quoteId: null,
          invoiceId: newInvoice.id,
          name: group.name,
          decorationMethod: group.decorationMethod,
          notes: group.notes,
          sortOrder: group.sortOrder,
        });

        // Copy line items
        const items = await db.select().from(schema.lineItems).where(eq(schema.lineItems.groupId, group.id));
        for (const item of items) {
          const newItemId = `li_inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await db.insert(schema.lineItems).values({
            ...item,
            id: newItemId,
            groupId: newGroupId,
            quoteId: null,
            invoiceId: newInvoice.id,
          });
        }

        // Copy imprints
        const imprints = await db.select().from(schema.imprints).where(eq(schema.imprints.groupId, group.id));
        for (const imprint of imprints) {
          const newImprintId = `imp_inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await db.insert(schema.imprints).values({
            ...imprint,
            id: newImprintId,
            groupId: newGroupId,
          });
        }
      }

      // Mark quote as converted
      const { updateQuote: updateQ } = await import('./db');
      await updateQ(quoteToConvert.id, { status: 'converted' });

      return {
        success: true,
        quote_number: `Q-${String(quoteToConvert.quoteNumber).padStart(5, '0')}`,
        invoice_number: `INV-${String(newInvoice.invoiceNumber).padStart(5, '0')}`,
        message: `Quote Q-${String(quoteToConvert.quoteNumber).padStart(5, '0')} converted to invoice INV-${String(newInvoice.invoiceNumber).padStart(5, '0')}`
      };

    // ============ INVOICE MANAGEMENT ============

    case 'get_invoice_details':
      const { getInvoice, getLineItemGroupsByInvoice } = await import('./db');

      let invoice;
      if (params.invoice_number) {
        const invoices = await db.select().from(schema.invoices).where(eq(schema.invoices.invoiceNumber, params.invoice_number)).limit(1);
        invoice = invoices[0];
      } else if (params.invoice_id) {
        invoice = await getInvoice(params.invoice_id);
      }

      if (!invoice) {
        return {
          success: false,
          error: `Invoice not found`
        };
      }

      const invCustomer = await (await import('./db')).getCustomer(invoice.customerId);
      const invGroups = await getLineItemGroupsByInvoice(invoice.id);

      const invGroupDetails = [];
      for (const group of invGroups) {
        const items = await db.select().from(schema.lineItems).where(eq(schema.lineItems.groupId, group.id));
        const imprints = await db.select().from(schema.imprints).where(eq(schema.imprints.groupId, group.id));

        invGroupDetails.push({
          name: group.name,
          decoration_method: group.decorationMethod,
          items: items.map(i => ({
            description: i.description,
            color: i.color,
            quantity: i.quantity,
            unit_price: i.unitPrice
          })),
          imprints: imprints.map(imp => ({
            location: imp.location,
            method: imp.decorationMethod,
            setup_fee: imp.setupFee
          }))
        });
      }

      return {
        success: true,
        invoice: {
          invoice_number: `INV-${String(invoice.invoiceNumber).padStart(5, '0')}`,
          customer_name: invCustomer?.name,
          status: invoice.status,
          total: invoice.totalAmount,
          paid: invoice.paidAmount,
          balance: (parseFloat(invoice.totalAmount || '0') - parseFloat(invoice.paidAmount || '0')).toFixed(2),
          groups: invGroupDetails
        },
        message: `Retrieved invoice INV-${String(invoice.invoiceNumber).padStart(5, '0')}`
      };

    case 'list_invoices':
      const { getAllInvoices } = await import('./db');

      const allInvoices = await getAllInvoices();
      const invStatus = params.status;
      const invLimit = params.limit || 20;

      let filteredInvoices = allInvoices;
      if (invStatus) {
        filteredInvoices = allInvoices.filter(inv => inv.status === invStatus);
      }

      return {
        success: true,
        count: filteredInvoices.length,
        invoices: filteredInvoices.slice(0, invLimit).map(inv => ({
          invoice_number: `INV-${String(inv.invoiceNumber).padStart(5, '0')}`,
          status: inv.status,
          total: inv.totalAmount,
          paid: inv.paidAmount,
          balance: (parseFloat(inv.totalAmount || '0') - parseFloat(inv.paidAmount || '0')).toFixed(2)
        })),
        message: `Found ${filteredInvoices.length} invoices${invStatus ? ` with status "${invStatus}"` : ''}`
      };

    case 'update_invoice_status':
      const { getInvoice: getInv, updateInvoice } = await import('./db');

      let invoiceToUpdate;
      if (params.invoice_number) {
        const invs = await db.select().from(schema.invoices).where(eq(schema.invoices.invoiceNumber, params.invoice_number)).limit(1);
        invoiceToUpdate = invs[0];
      } else if (params.invoice_id) {
        invoiceToUpdate = await getInv(params.invoice_id);
      }

      if (!invoiceToUpdate) {
        return {
          success: false,
          error: `Invoice not found`
        };
      }

      await updateInvoice(invoiceToUpdate.id, { status: params.status });

      return {
        success: true,
        invoice_number: `INV-${String(invoiceToUpdate.invoiceNumber).padStart(5, '0')}`,
        message: `Invoice INV-${String(invoiceToUpdate.invoiceNumber).padStart(5, '0')} status updated to ${params.status}`
      };

    case 'record_payment':
      const { recordPayment } = await import('./businessLogic');

      let invoiceForPayment;
      if (params.invoice_number) {
        const invs = await db.select().from(schema.invoices).where(eq(schema.invoices.invoiceNumber, params.invoice_number)).limit(1);
        invoiceForPayment = invs[0];
      } else if (params.invoice_id) {
        invoiceForPayment = await (await import('./db')).getInvoice(params.invoice_id);
      }

      if (!invoiceForPayment) {
        return {
          success: false,
          error: `Invoice not found`
        };
      }

      const paymentResult = await recordPayment(
        invoiceForPayment.id,
        params.amount,
        params.payment_method || 'cash',
        params.notes
      );

      return {
        success: true,
        invoice_number: `INV-${String(invoiceForPayment.invoiceNumber).padStart(5, '0')}`,
        amount_paid: params.amount,
        new_status: paymentResult.newStatus,
        remaining_balance: paymentResult.balance,
        message: `Payment of $${params.amount.toFixed(2)} recorded for invoice INV-${String(invoiceForPayment.invoiceNumber).padStart(5, '0')}. Remaining balance: $${paymentResult.balance.toFixed(2)}`
      };

    // ============ PRODUCT MANAGEMENT ============

    case 'create_product':
      const { createProduct } = await import('./db');

      const newProduct = await createProduct({
        itemNumber: params.item_number || null,
        name: params.name,
        brand: params.brand || null,
        category: params.category || null,
        description: params.description || null,
        basePrice: String(params.base_price || 0),
        colors: params.colors ? JSON.stringify(params.colors) : null,
        sizes: params.sizes ? JSON.stringify(params.sizes) : null,
        imageUrl: params.image_url || null,
        active: true,
      });

      return {
        success: true,
        product_id: newProduct.id,
        product_name: newProduct.name,
        message: `Product "${newProduct.name}" created successfully`
      };

    case 'update_product':
      const { updateProduct, getProductByItemNumber } = await import('./db');

      let productToUpdate;
      if (params.item_number) {
        const prods = await db.select().from(schema.products).where(eq(schema.products.itemNumber, params.item_number)).limit(1);
        productToUpdate = prods[0];
      } else if (params.product_id) {
        const prods = await db.select().from(schema.products).where(eq(schema.products.id, params.product_id)).limit(1);
        productToUpdate = prods[0];
      }

      if (!productToUpdate) {
        return {
          success: false,
          error: `Product not found`
        };
      }

      const prodUpdates: any = {};
      if (params.name !== undefined) prodUpdates.name = params.name;
      if (params.brand !== undefined) prodUpdates.brand = params.brand;
      if (params.category !== undefined) prodUpdates.category = params.category;
      if (params.description !== undefined) prodUpdates.description = params.description;
      if (params.base_price !== undefined) prodUpdates.basePrice = String(params.base_price);
      if (params.active !== undefined) prodUpdates.active = params.active;

      await updateProduct(productToUpdate.id, prodUpdates);

      return {
        success: true,
        product_name: productToUpdate.name,
        message: `Product "${productToUpdate.name}" updated successfully`
      };

    case 'get_product_details':
      let productDetails;
      if (params.item_number) {
        const prods = await db.select().from(schema.products).where(eq(schema.products.itemNumber, params.item_number)).limit(1);
        productDetails = prods[0];
      } else if (params.product_id) {
        const prods = await db.select().from(schema.products).where(eq(schema.products.id, params.product_id)).limit(1);
        productDetails = prods[0];
      }

      if (!productDetails) {
        return {
          success: false,
          error: `Product not found`
        };
      }

      return {
        success: true,
        product: {
          name: productDetails.name,
          item_number: productDetails.itemNumber,
          brand: productDetails.brand,
          category: productDetails.category,
          description: productDetails.description,
          base_price: productDetails.basePrice,
          active: productDetails.active
        },
        message: `Retrieved details for ${productDetails.name}`
      };

    case 'list_products':
      const { getAllProducts } = await import('./db');

      const allProducts = await getAllProducts();
      const prodLimit = params.limit || 50;
      const activeOnly = params.active_only !== false;

      let filteredProducts = activeOnly ? allProducts.filter(p => p.active) : allProducts;

      return {
        success: true,
        count: filteredProducts.length,
        products: filteredProducts.slice(0, prodLimit).map(p => ({
          name: p.name,
          item_number: p.itemNumber,
          brand: p.brand,
          base_price: p.basePrice,
          category: p.category
        })),
        message: `Found ${filteredProducts.length} products (showing ${Math.min(prodLimit, filteredProducts.length)})`
      };

    // ============ TASK MANAGEMENT ============

    case 'create_task':
      const { createTask } = await import('./db');

      const newTask = await createTask({
        name: params.name,
        invoiceId: params.invoice_id || null,
        quoteId: params.quote_id || null,
        assignedTo: params.assigned_to || null,
        dueDate: params.due_date ? new Date(params.due_date) : null,
        priority: params.priority || 'medium',
        notes: params.notes || null,
        completed: false,
      });

      return {
        success: true,
        task_id: newTask.id,
        task_name: newTask.name,
        message: `Task "${newTask.name}" created successfully`
      };

    case 'update_task':
      const { updateTask, getTask } = await import('./db');

      const taskToUpdate = await getTask(params.task_id);

      if (!taskToUpdate) {
        return {
          success: false,
          error: `Task not found`
        };
      }

      const taskUpdates: any = {};
      if (params.name !== undefined) taskUpdates.name = params.name;
      if (params.assigned_to !== undefined) taskUpdates.assignedTo = params.assigned_to;
      if (params.due_date !== undefined) taskUpdates.dueDate = new Date(params.due_date);
      if (params.priority !== undefined) taskUpdates.priority = params.priority;
      if (params.notes !== undefined) taskUpdates.notes = params.notes;
      if (params.completed !== undefined) {
        taskUpdates.completed = params.completed;
        if (params.completed) taskUpdates.completedAt = new Date();
      }

      await updateTask(taskToUpdate.id, taskUpdates);

      return {
        success: true,
        task_name: taskToUpdate.name,
        message: `Task "${taskToUpdate.name}" updated successfully`
      };

    case 'complete_task':
      const { updateTask: updateT, getTask: getT } = await import('./db');

      const taskToComplete = await getT(params.task_id);

      if (!taskToComplete) {
        return {
          success: false,
          error: `Task not found`
        };
      }

      await updateT(taskToComplete.id, {
        completed: true,
        completedAt: new Date()
      });

      return {
        success: true,
        task_name: taskToComplete.name,
        message: `Task "${taskToComplete.name}" marked as complete`
      };

    case 'list_tasks':
      const { getAllTasks } = await import('./db');

      const allTasks = await getAllTasks();
      const taskLimit = params.limit || 20;
      const showCompleted = params.show_completed === true;

      let filteredTasks = showCompleted ? allTasks : allTasks.filter(t => !t.completed);

      return {
        success: true,
        count: filteredTasks.length,
        tasks: filteredTasks.slice(0, taskLimit).map(t => ({
          name: t.name,
          priority: t.priority,
          due_date: t.dueDate,
          completed: t.completed,
          assigned_to: t.assignedTo
        })),
        message: `Found ${filteredTasks.length} ${showCompleted ? '' : 'pending '}tasks (showing ${Math.min(taskLimit, filteredTasks.length)})`
      };

    default:
      return { success: false, error: 'Unknown tool' };
  }
}

/**
 * Generate and stream speech with ElevenLabs
 */
async function generateAndStreamSpeech(session: VoiceSession, text: string) {
  const voiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam voice

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ENV.elevenlabsApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed: ${response.statusText}`);
  }

  // Stream audio chunks to client
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Send audio chunk to client
    session.ws.send(JSON.stringify({
      type: 'audio_chunk',
      data: Buffer.from(value).toString('base64')
    }));
  }

  session.ws.send(JSON.stringify({ type: 'audio_complete' }));
}

