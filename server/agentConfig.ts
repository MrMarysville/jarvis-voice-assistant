/**
 * ElevenLabs Agent Configuration
 * 
 * This file manages the ElevenLabs agent configuration
 */

import { Router } from 'express';
import { ENV } from './_core/env';

const router = Router();

// Store agent ID (will be set after creating agent in ElevenLabs dashboard)
let AGENT_ID = ENV.elevenlabsAgentId || '';

/**
 * GET /api/agent/id
 * Returns the ElevenLabs agent ID
 */
router.get('/id', (req, res) => {
  if (!AGENT_ID) {
    return res.status(404).json({
      success: false,
      error: 'Agent ID not configured. Please create an agent in ElevenLabs dashboard and set ELEVENLABS_AGENT_ID environment variable.'
    });
  }

  res.json({
    success: true,
    agentId: AGENT_ID
  });
});

/**
 * GET /api/agent/config
 * Returns the full agent configuration for reference
 */
router.get('/config', (req, res) => {
  const serverUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
  
  res.json({
    success: true,
    config: {
      name: "Jarvis Print Shop Assistant",
      systemPrompt: `You are Jarvis, an AI assistant for a print shop management system.

Your role is to help users create quotes for custom printing orders through natural conversation.

When a user describes an order, you should:
1. Listen carefully to all details (product, quantity, sizes, decoration method)
2. Ask clarifying questions if information is missing
3. Use the create_quote tool to create the quote in the system
4. Confirm the quote was created and provide the quote number and total

Be professional, friendly, and efficient. Speak naturally and conversationally.

Example interaction:
User: "I need a quote for ABC Company with 100 Gildan 5000 t-shirts, 50 large, 30 medium, 20 small, screen print front 2 colors and back 1 color"

You: "I'll create that quote for you right away. Processing an order for ABC Company - 100 Gildan 5000 t-shirts in mixed sizes: 50 large, 30 medium, and 20 small, with screen printing featuring 2 colors on the front and 1 color on the back."

[Execute create_quote tool]

You: "Perfect! I've created quote Q-00123 for ABC Company. The total comes to $1,250.00 including tax. Is there anything else you'd like to add to this quote?"`,
      voice: "Adam (pNInz6obpgDQGcFmaJgB)",
      llm: "Claude Sonnet 4.5",
      tools: [
        {
          name: "create_quote",
          description: "Create a new quote for a customer with line items",
          url: `${serverUrl}/api/elevenlabs/tools/create-quote`,
          method: "POST",
          schema: {
            type: "object",
            properties: {
              customer_name: {
                type: "string",
                description: "Name of the customer"
              },
              line_items: {
                type: "array",
                description: "Array of line items for the quote",
                items: {
                  type: "object",
                  properties: {
                    product_name: {
                      type: "string",
                      description: "Name of the product"
                    },
                    quantity: {
                      type: "number",
                      description: "Quantity of this item"
                    },
                    unit_price: {
                      type: "number",
                      description: "Price per unit in dollars"
                    },
                    decoration: {
                      type: "string",
                      description: "Decoration details"
                    }
                  },
                  required: ["product_name", "quantity", "unit_price"]
                }
              }
            },
            required: ["customer_name", "line_items"]
          }
        },
        {
          name: "search_products",
          description: "Search for products in the catalog",
          url: `${serverUrl}/api/elevenlabs/tools/search-products`,
          method: "POST",
          schema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query (product name or SKU)"
              }
            },
            required: ["query"]
          }
        },
        {
          name: "customer_history",
          description: "Get recent quotes and orders for a customer",
          url: `${serverUrl}/api/elevenlabs/tools/customer-history`,
          method: "POST",
          schema: {
            type: "object",
            properties: {
              customer_name: {
                type: "string",
                description: "Name of the customer"
              }
            },
            required: ["customer_name"]
          }
        }
      ]
    }
  });
});

export default router;

