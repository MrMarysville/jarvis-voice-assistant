#!/bin/bash

# Jarvis Production Server Startup Script
# 
# IMPORTANT: Set these environment variables before running:
#   export OPENAI_API_KEY="your-key-here"
#   export ANTHROPIC_API_KEY="your-key-here"
#   export ELEVENLABS_API_KEY="your-key-here"

echo "🚀 Starting Jarvis Production Server..."
echo "========================================"

# Check if API keys are set
if [ -z "$OPENAI_API_KEY" ]; then
  echo "❌ OPENAI_API_KEY not set!"
  exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ ANTHROPIC_API_KEY not set!"
  exit 1
fi

if [ -z "$ELEVENLABS_API_KEY" ]; then
  echo "❌ ELEVENLABS_API_KEY not set!"
  exit 1
fi

echo "✅ Environment configured"
echo "✅ OpenAI API ready (Whisper STT)"
echo "✅ Claude Sonnet 4.5 ready"
echo "✅ ElevenLabs ready (Premium TTS)"
echo "🎙️  Voice Assistant Features:"
echo "   - Natural voice conversation"
echo "   - 1-2 second response time"
echo "📊 Server starting..."

cd /home/ubuntu/jarvis
node dist/index.js
