/**
 * VoiceAssistantElevenLabs Component
 * 
 * Real-time voice conversation using ElevenLabs Conversational AI
 * - Sub-100ms latency
 * - WebSocket streaming
 * - Voice Activity Detection (VAD)
 * - Natural interruptions
 * - Claude Sonnet 4.5 integration
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

type VoiceState = 'idle' | 'connecting' | 'connected' | 'speaking' | 'listening';

interface ElevenLabsEvent {
  type: string;
  [key: string]: any;
}

export function VoiceAssistantElevenLabs() {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [agentResponse, setAgentResponse] = useState<string>('');
  const [agentId, setAgentId] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  /**
   * Initialize audio playback system
   */
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  /**
   * Play audio buffer
   */
  const playAudioBuffer = useCallback(async (audioData: string) => {
    try {
      const audioContext = initAudioContext();
      
      // Decode base64 to array buffer
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
      
      // Add to queue
      audioQueueRef.current.push(audioBuffer);
      
      // Start playing if not already playing
      if (!isPlayingRef.current) {
        playNextInQueue();
      }
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  }, [initAudioContext]);

  /**
   * Play next audio in queue
   */
  const playNextInQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setState('listening');
      return;
    }
    
    isPlayingRef.current = true;
    setState('speaking');
    
    const audioContext = audioContextRef.current!;
    const buffer = audioQueueRef.current.shift()!;
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    
    source.onended = () => {
      playNextInQueue();
    };
    
    source.start(0);
  }, []);

  /**
   * Start microphone streaming
   */
  const startMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });
      
      mediaStreamRef.current = stream;
      
      // Create audio processor
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          return;
        }
        
        // Get audio data
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        
        // Convert to base64
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        
        // Send to WebSocket
        wsRef.current.send(JSON.stringify({
          user_audio_chunk: base64
        }));
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
    } catch (err: any) {
      console.error('Microphone error:', err);
      setError('Microphone access denied. Please allow microphone access.');
      setState('idle');
    }
  }, []);

  /**
   * Stop microphone streaming
   */
  const stopMicrophone = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  /**
   * Connect to ElevenLabs WebSocket
   */
  const connect = useCallback(async () => {
    try {
      setError(null);
      setState('connecting');
      
      // Fetch agent ID from server
      if (!agentId) {
        const response = await fetch('/api/agent/id');
        const data = await response.json();
        if (!data.success || !data.agentId) {
          throw new Error('Agent ID not configured. Please create an agent in ElevenLabs dashboard.');
        }
        setAgentId(data.agentId);
      }
      
      const AGENT_ID = agentId!;
      
      // For now, we'll use a signed URL approach
      // In production, get this from your server
      const ws = new WebSocket(
        `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${AGENT_ID}`
      );
      
      ws.onopen = async () => {
        console.log('[ElevenLabs] WebSocket connected');
        setState('connected');
        
        // Send initialization message
        ws.send(JSON.stringify({
          type: 'conversation_initiation_client_data',
        }));
        
        // Start microphone
        await startMicrophone();
        setState('listening');
      };
      
      ws.onmessage = async (event) => {
        const data: ElevenLabsEvent = JSON.parse(event.data);
        
        // Handle different event types
        switch (data.type) {
          case 'ping':
            // Respond to ping to keep connection alive
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'pong',
                  event_id: data.ping_event.event_id,
                }));
              }
            }, data.ping_event.ping_ms || 0);
            break;
            
          case 'user_transcript':
            // User's speech was transcribed
            setTranscript(data.user_transcription_event.user_transcript);
            break;
            
          case 'agent_response':
            // Agent's text response
            setAgentResponse(data.agent_response_event.agent_response);
            break;
            
          case 'agent_response_correction':
            // Agent corrected its response
            setAgentResponse(data.agent_response_correction_event.corrected_agent_response);
            break;
            
          case 'audio':
            // Agent's audio response
            await playAudioBuffer(data.audio_event.audio_base_64);
            break;
            
          case 'interruption':
            // User interrupted the agent
            console.log('[ElevenLabs] Interruption:', data.interruption_event.reason);
            // Clear audio queue
            audioQueueRef.current = [];
            isPlayingRef.current = false;
            setState('listening');
            break;
            
          default:
            console.log('[ElevenLabs] Unknown event:', data.type);
        }
      };
      
      ws.onerror = (error) => {
        console.error('[ElevenLabs] WebSocket error:', error);
        setError('Connection error. Please try again.');
        setState('idle');
      };
      
      ws.onclose = () => {
        console.log('[ElevenLabs] WebSocket closed');
        stopMicrophone();
        setState('idle');
      };
      
      wsRef.current = ws;
      
    } catch (err: any) {
      console.error('[ElevenLabs] Connection error:', err);
      setError(err.message || 'Failed to connect');
      setState('idle');
    }
  }, [startMicrophone, stopMicrophone, playAudioBuffer]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopMicrophone();
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setState('idle');
    setTranscript('');
    setAgentResponse('');
  }, [stopMicrophone]);

  /**
   * Toggle connection
   */
  const toggleConnection = useCallback(() => {
    if (state === 'idle') {
      connect();
    } else {
      disconnect();
    }
  }, [state, connect, disconnect]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      disconnect();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [disconnect]);

  /**
   * Get button variant based on state
   */
  const getButtonVariant = () => {
    switch (state) {
      case 'connecting':
        return 'secondary';
      case 'connected':
      case 'listening':
        return 'destructive'; // Red when active
      case 'speaking':
        return 'default'; // Blue when speaking
      default:
        return 'outline';
    }
  };

  /**
   * Get button icon
   */
  const getIcon = () => {
    switch (state) {
      case 'connecting':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'connected':
      case 'listening':
      case 'speaking':
        return <MicOff className="w-5 h-5" />;
      default:
        return <Mic className="w-5 h-5" />;
    }
  };

  /**
   * Get status text
   */
  const getStatusText = () => {
    switch (state) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'listening':
        return 'Listening...';
      case 'speaking':
        return 'Speaking...';
      default:
        return 'Start voice assistant';
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant={getButtonVariant()}
        size="icon"
        onClick={toggleConnection}
        disabled={state === 'connecting'}
        title={getStatusText()}
      >
        {getIcon()}
      </Button>
      
      {error && (
        <div className="text-xs text-destructive max-w-xs text-center">
          {error}
        </div>
      )}
      
      {transcript && (
        <div className="text-xs text-muted-foreground max-w-xs text-center">
          You: {transcript}
        </div>
      )}
      
      {agentResponse && (
        <div className="text-xs text-foreground max-w-xs text-center">
          Jarvis: {agentResponse}
        </div>
      )}
      
      {state !== 'idle' && !error && (
        <div className="text-xs text-muted-foreground">
          {getStatusText()}
        </div>
      )}
    </div>
  );
}

