/**
 * VoiceAssistantSimple Component
 * 
 * Simple WebSocket voice pipeline - No agent needed!
 * - OpenAI Whisper STT
 * - Claude Sonnet 4.5
 * - ElevenLabs TTS streaming
 */

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking';

export function VoiceAssistantSimple() {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  /**
   * Initialize audio context
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
      console.error('[Voice] Audio playback error:', err);
    }
  }, [initAudioContext]);

  /**
   * Play next audio in queue
   */
  const playNextInQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setState('idle');
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
   * Connect to WebSocket server
   */
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/voice-pipeline`);

    ws.onopen = () => {
      console.log('[Voice] WebSocket connected');
      setError(null);
    };

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'connected':
          console.log('[Voice] Pipeline ready');
          break;

        case 'recording_started':
          setState('recording');
          break;

        case 'processing_started':
          setState('processing');
          setTranscript('');
          setResponse('');
          break;

        case 'transcript':
          setTranscript(message.text);
          break;

        case 'response_text':
          setResponse(message.text);
          break;

        case 'audio_chunk':
          await playAudioBuffer(message.data);
          break;

        case 'audio_complete':
          console.log('[Voice] Audio streaming complete');
          break;

        case 'processing_complete':
          console.log('[Voice] Processing complete');
          break;

        case 'error':
          setError(message.message);
          setState('idle');
          break;

        default:
          console.warn('[Voice] Unknown message type:', message.type);
      }
    };

    ws.onerror = (error) => {
      console.error('[Voice] WebSocket error:', error);
      setError('Connection error');
      setState('idle');
    };

    ws.onclose = () => {
      console.log('[Voice] WebSocket closed');
      wsRef.current = null;
    };

    wsRef.current = ws;
  }, [playAudioBuffer]);

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Connect WebSocket if not connected
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWebSocket();
        // Wait for connection
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;

      // Send audio chunks to server
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          event.data.arrayBuffer().then(buffer => {
            wsRef.current?.send(buffer);
          });
        }
      };

      // Start recording
      mediaRecorder.start(100); // Send chunks every 100ms

      // Notify server
      wsRef.current?.send(JSON.stringify({ type: 'start_recording' }));

      setState('recording');

    } catch (err) {
      console.error('[Voice] Recording error:', err);
      setError('Microphone access denied');
      setState('idle');
    }
  }, [connectWebSocket]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }

    // Notify server
    wsRef.current?.send(JSON.stringify({ type: 'stop_recording' }));
  }, []);

  /**
   * Toggle recording
   */
  const toggleRecording = useCallback(() => {
    if (state === 'idle') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  }, [state, startRecording, stopRecording]);

  /**
   * Get button color based on state
   */
  const getButtonColor = () => {
    switch (state) {
      case 'recording':
        return 'bg-red-500 hover:bg-red-600';
      case 'processing':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'speaking':
        return 'bg-blue-500 hover:bg-blue-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  /**
   * Get button icon based on state
   */
  const getButtonIcon = () => {
    if (state === 'processing') {
      return <Loader2 className="h-5 w-5 animate-spin" />;
    }
    return state === 'recording' ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />;
  };

  return (
    <div className="relative">
      <Button
        onClick={toggleRecording}
        disabled={state === 'processing' || state === 'speaking'}
        className={`rounded-full p-3 ${getButtonColor()}`}
        title={
          state === 'idle' ? 'Start voice assistant' :
          state === 'recording' ? 'Stop recording' :
          state === 'processing' ? 'Processing...' :
          'Speaking...'
        }
      >
        {getButtonIcon()}
      </Button>

      {/* Status display */}
      {(transcript || response || error) && (
        <div className="absolute top-full mt-2 right-0 w-64 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border z-50">
          {error && (
            <div className="text-red-500 text-sm mb-2">
              ❌ {error}
            </div>
          )}
          {transcript && (
            <div className="text-sm mb-2">
              <div className="font-semibold text-gray-600 dark:text-gray-400">You said:</div>
              <div className="text-gray-800 dark:text-gray-200">{transcript}</div>
            </div>
          )}
          {response && (
            <div className="text-sm">
              <div className="font-semibold text-gray-600 dark:text-gray-400">Jarvis:</div>
              <div className="text-gray-800 dark:text-gray-200">{response}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

