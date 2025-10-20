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

interface VoiceSession {
  ws: WebSocket;
  audioChunks: Buffer[];
  conversationHistory: Array<{ role: string; content: string }>;
  isProcessing: boolean;
}

const sessions = new Map<WebSocket, VoiceSession>();

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
      isProcessing: false
    };
    sessions.set(ws, session);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Voice pipeline ready'
    }));

    ws.on('message', async (data: Buffer) => {
      try {
        // Try to parse as JSON (control messages)
        const message = JSON.parse(data.toString());
        await handleControlMessage(session, message);
      } catch {
        // Binary data (audio)
        handleAudioChunk(session, data);
      }
    });

    ws.on('close', () => {
      console.log('[Voice Pipeline] Client disconnected');
      sessions.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('[Voice Pipeline] WebSocket error:', error);
      sessions.delete(ws);
    });
  });

  console.log('[Voice Pipeline] WebSocket server initialized on /ws/voice-pipeline');
}

/**
 * Handle control messages from client
 */
async function handleControlMessage(session: VoiceSession, message: any) {
  const { type, data } = message;

  switch (type) {
    case 'start_recording':
      session.audioChunks = [];
      session.isProcessing = false;
      session.ws.send(JSON.stringify({
        type: 'recording_started',
        message: 'Ready to receive audio'
      }));
      break;

    case 'stop_recording':
      if (session.audioChunks.length > 0) {
        await processVoiceInput(session);
      }
      break;

    case 'reset':
      session.audioChunks = [];
      session.conversationHistory = [];
      session.isProcessing = false;
      break;

    default:
      console.warn('[Voice Pipeline] Unknown message type:', type);
  }
}

/**
 * Handle incoming audio chunks
 */
function handleAudioChunk(session: VoiceSession, chunk: Buffer) {
  if (!session.isProcessing) {
    session.audioChunks.push(chunk);
  }
}

/**
 * Process voice input through the pipeline
 */
async function processVoiceInput(session: VoiceSession) {
  if (session.isProcessing) {
    return;
  }

  session.isProcessing = true;
  session.ws.send(JSON.stringify({ type: 'processing_started' }));

  try {
    // Step 1: Transcribe audio with Whisper
    const transcript = await transcribeAudio(session.audioChunks);
    
    session.ws.send(JSON.stringify({
      type: 'transcript',
      text: transcript
    }));

    // Step 2: Process with Claude
    const response = await processWithClaude(session, transcript);
    
    session.ws.send(JSON.stringify({
      type: 'response_text',
      text: response
    }));

    // Step 3: Generate speech with ElevenLabs
    await generateAndStreamSpeech(session, response);

    session.ws.send(JSON.stringify({ type: 'processing_complete' }));

  } catch (error) {
    console.error('[Voice Pipeline] Processing error:', error);
    session.ws.send(JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Processing failed'
    }));
  } finally {
    session.isProcessing = false;
    session.audioChunks = [];
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
2. Ask clarifying questions if information is missing
3. Create the quote in the system
4. Confirm the quote was created and provide the quote number and total

Be professional, friendly, and efficient. Speak naturally and conversationally.

You have access to these tools:
- create_quote: Create a new quote for a customer
- search_products: Search for products in the catalog
- get_customer_history: Get recent quotes for a customer

When you need to use a tool, respond with a JSON object like:
{"tool": "create_quote", "params": {"customer_name": "ABC Company", "line_items": [...]}}

Otherwise, respond with natural conversational text.`;

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
      const toolCall = JSON.parse(assistantMessage);
      const toolResult = await executeTool(toolCall.tool, toolCall.params);
      
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
      // Create quote in database
      const [quote] = await db.insert(schema.quotes).values({
        customerName: params.customer_name,
        status: 'draft',
        subtotal: 0,
        tax: 0,
        total: 0
      }).returning();

      // Add line items
      for (const item of params.line_items || []) {
        await db.insert(schema.lineItems).values({
          quoteId: quote.id,
          description: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          total: item.quantity * item.unit_price
        });
      }

      return {
        success: true,
        quote_id: quote.id,
        quote_number: `Q-${String(quote.id).padStart(5, '0')}`,
        message: 'Quote created successfully'
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

