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

  // System prompt for Jarvis
  const systemPrompt = `You are Jarvis, an AI assistant for a print shop management system.

Your role is to help users create quotes for custom printing orders through natural conversation.

When a user describes an order, you should:
1. Listen carefully to all details (product, quantity, sizes, decoration method)
2. Ask clarifying questions if information is missing (customer name, product details, quantity, pricing)
3. Create the quote in the system once you have enough information
4. Confirm the quote was created and provide the quote number and total

Be professional, friendly, and efficient. Speak naturally and conversationally.

You have access to these tools:
- create_quote: Create a new quote for a customer
  Required params: customer_name, line_items (array)
  Optional params: customer_email, notes, due_date, group_name, decoration_method
  Line item format: { product_name, quantity, unit_price, item_number?, color?, description? }
  Example: {"tool": "create_quote", "params": {"customer_name": "ABC Company", "line_items": [{"product_name": "T-Shirt", "quantity": 100, "unit_price": 5.00}]}}

- search_products: Search for products in the catalog
  Params: { query: "search term" }

- get_customer_history: Get recent quotes for a customer
  Params: { customer_name: "Company Name" }

When you need to use a tool, respond with ONLY a JSON object (no other text):
{"tool": "create_quote", "params": {"customer_name": "ABC Company", "line_items": [{"product_name": "T-Shirt", "quantity": 100, "unit_price": 5.00}]}}

Otherwise, respond with natural conversational text.

Important: Always collect customer name, product details, quantity, and pricing before creating a quote.`;

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
      const { getCustomerByName, createCustomer, getNextQuoteNumber, recalculateQuoteTotal } = await import('./db');

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

      // Create quote in database with correct schema
      await db.insert(schema.quotes).values({
        id: quoteId,
        quoteNumber: quoteNumber,
        customerId: customer.id,
        status: 'quote',
        totalAmount: '0.00', // Will be recalculated
        taxAmount: '0.00',
        taxRate: '0.00',
        customerDueDate: params.due_date ? new Date(params.due_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        notes: params.notes || null,
      });

      // Create a line item group for the products
      const groupId = `lig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await db.insert(schema.lineItemGroups).values({
        id: groupId,
        quoteId: quoteId,
        invoiceId: null,
        name: params.group_name || 'Order Items',
        decorationMethod: params.decoration_method || null,
        notes: null,
        sortOrder: 0,
      });

      // Add line items to the group with price validation
      let itemIndex = 0;
      const priceWarnings: string[] = [];

      for (const item of params.line_items || []) {
        const lineItemId = `li_${Date.now()}_${itemIndex}_${Math.random().toString(36).substring(2, 9)}`;

        // Try to validate price against product catalog if item_number is provided
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

              // Warn if price differs significantly from catalog
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

        await db.insert(schema.lineItems).values({
          id: lineItemId,
          groupId: groupId,
          quoteId: quoteId,
          invoiceId: null,
          productId: productId,
          itemNumber: item.item_number || null,
          description: item.product_name || item.description,
          color: item.color || null,
          quantity: item.quantity || 0,
          unitPrice: String(validatedPrice),
          totalPrice: String((item.quantity || 0) * validatedPrice),
          sortOrder: itemIndex,
        });

        itemIndex++;
      }

      // Add price warnings to notes if any
      if (priceWarnings.length > 0) {
        const warningNote = `\n\nPrice Warnings:\n${priceWarnings.join('\n')}`;
        await db.update(schema.quotes)
          .set({ notes: (params.notes || '') + warningNote })
          .where(eq(schema.quotes.id, quoteId));
      }

      // Recalculate quote total
      const calculatedTotal = await recalculateQuoteTotal(quoteId);

      return {
        success: true,
        quote_id: quoteId,
        quote_number: `Q-${String(quoteNumber).padStart(5, '0')}`,
        customer_name: customer.name,
        total: calculatedTotal || 0,
        item_count: params.line_items?.length || 0,
        message: `Quote created successfully for ${customer.name} with ${params.line_items?.length || 0} items totaling $${(calculatedTotal || 0).toFixed(2)}`
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
      const quotes = await db.select()
        .from(schema.quotes)
        .where(eq(schema.quotes.customerName, params.customer_name))
        .limit(5);

      return {
        success: true,
        quotes: quotes.map(q => ({
          id: q.id,
          status: q.status,
          total: q.total,
          created_at: q.createdAt
        }))
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

