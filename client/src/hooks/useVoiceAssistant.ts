import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

interface VoiceCommand {
  transcript: string;
  confidence: number;
}

export function useVoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [, setLocation] = useLocation();

  const processCommandMutation = trpc.voice.processCommand.useMutation();

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = async (event) => {
        const last = event.results.length - 1;
        const command = event.results[last][0].transcript;
        const confidence = event.results[last][0].confidence;

        console.log("Voice command:", command, "Confidence:", confidence);
        setTranscript(command);

        // Check for activation keyword "Jarvis"
        if (command.toLowerCase().includes("jarvis")) {
          setIsProcessing(true);
          try {
            const result = await processCommandMutation.mutateAsync({ command });
            setResponse(result.response);
            
            // Execute action if provided
            if (result.action) {
              executeAction(result.action);
            }

            // Speak response
            if (result.response) {
              speak(result.response);
            }
          } catch (error) {
            console.error("Error processing command:", error);
            speak("Sorry, I encountered an error processing that command.");
          } finally {
            setIsProcessing(false);
          }
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "no-speech") {
          // Silently ignore no-speech errors
          return;
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        if (isListening) {
          // Restart if we're still supposed to be listening
          recognition.start();
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        console.log("Voice assistant started listening...");
      } catch (error) {
        console.error("Error starting speech recognition:", error);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      console.log("Voice assistant stopped listening.");
    }
  }, [isListening]);

  const speak = useCallback((text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Try to use a more natural voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (voice) => voice.name.includes("Samantha") || voice.name.includes("Google US English")
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const executeAction = useCallback((action: any) => {
    console.log("Executing action:", action);
    
    switch (action.type) {
      case "navigate":
        setLocation(action.path);
        break;
      case "create_quote":
        setLocation("/quotes/new");
        break;
      case "create_invoice":
        setLocation("/invoices/new");
        break;
      case "create_customer":
        setLocation("/customers/new");
        break;
      case "view_dashboard":
        setLocation("/");
        break;
      default:
        console.log("Unknown action type:", action.type);
    }
  }, [setLocation]);

  return {
    isListening,
    isProcessing,
    transcript,
    response,
    startListening,
    stopListening,
    speak,
  };
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onend: () => void;
    start: () => void;
    stop: () => void;
  }

  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
  }

  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };

  var webkitSpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };
}

