import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

// PHASE 3: Hands-Free Sim Coach Mode
export const SimCoachClient: React.FC<{ gameId: string }> = ({ gameId }) => {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<{ text: string, confidence: number } | null>(null);
  const recognitionRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    // Setup SpeechRecognition
    const SpeechRecognition = (window as Record<string, unknown>).SpeechRecognition || (window as Record<string, unknown>).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new (SpeechRecognition as Record<string, unknown> as new () => Record<string, unknown>)();
      (recognitionRef.current as Record<string, unknown>).continuous = true;
      (recognitionRef.current as Record<string, unknown>).interimResults = false;

      (recognitionRef.current as Record<string, unknown>).onresult = (event: Record<string, unknown>) => {
        const results = event.results as Record<string, unknown>[];
        const result = results[results.length - 1] as Record<string, unknown>[];
        const transcript = result[0].transcript as string;
        const text = transcript.trim().toLowerCase();
        const confidence = result[0].confidence as number;


        handleVoiceCommand(text, confidence);
      };

      (recognitionRef.current as Record<string, unknown>).onerror = (event: Record<string, unknown>) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) ((recognitionRef.current as Record<string, unknown>).stop as () => void)();
    };
  }, [gameId, handleVoiceCommand]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      ((recognitionRef.current as Record<string, unknown>).stop as () => void)();
      setIsListening(false);
    } else {
      ((recognitionRef.current as Record<string, unknown>).start as () => void)();
      setIsListening(true);
    }
  };

  const handleVoiceCommand = useCallback(async (text: string, confidence: number) => {
    setLastCommand({ text, confidence });

    // Constrained voice placeholder - map common phrases to behavior tree actions
    let action = 'unknown';
    if (text.includes('pick and roll')) action = 'pick_and_roll';
    else if (text.includes('isolation') || text.includes('iso')) action = 'iso';
    else if (text.includes('full court press')) action = 'press';
    else if (text.includes('timeout')) action = 'timeout';

    if (action !== 'unknown') {
      await supabase.from('game_events').insert({
        game_id: gameId,
        event_ts: new Date().toISOString(),
        event_type: 'command',
        source: 'sim_command',
        confidence,
        payload: { action, raw_text: text }
      });
    }
  }, [gameId]);

  return (
    <div className="w-full h-full bg-[#0A0A0A] flex flex-col border border-[#333] rounded-lg overflow-hidden">
      {/* WebGL Canvas Placeholder */}
      <div className="flex-1 bg-gradient-to-b from-[#111111] to-[#0A0A0A] flex flex-col items-center justify-center relative">
        <div className="absolute inset-0 bg-[url('/court-grid.svg')] opacity-10 bg-repeat bg-center"></div>
        <h2 className="font-bebas text-4xl text-[#C9A84C]/50 z-10">SIMULATION CANVAS</h2>
        <p className="text-gray-500 mt-2 z-10">Awaiting Unity Export WebGL Build...</p>

        {/* Command Toast Overlay */}
        {lastCommand && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-[#1A1A1A]/90 border border-[#C9A84C] rounded px-6 py-3 shadow-lg z-20 transition-all">
            <p className="font-bebas text-xl text-white">"{lastCommand.text.toUpperCase()}"</p>
            <div className="w-full h-1 bg-[#333] mt-2 rounded overflow-hidden">
              <div
                className={`h-full ${lastCommand.confidence > 0.8 ? 'bg-green-500' : 'bg-yellow-500'}`}
                style={{ width: `${Math.round(lastCommand.confidence * 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">CONFIDENCE: {Math.round(lastCommand.confidence * 100)}%</p>
          </div>
        )}
      </div>

      {/* HUD Controls */}
      <div className="bg-[#111111] p-4 border-t border-[#333] flex justify-between items-center z-10">
        <div>
          <h3 className="font-bebas text-xl text-[#F5F5F0]">COACH MODE</h3>
          <p className="text-xs text-gray-400">MediaPipe / WebSpeech Active</p>
        </div>

        <div className="flex gap-4">
          <Button
            onClick={toggleListening}
            className={isListening ? 'bg-red-900 hover:bg-red-800 text-white' : 'bg-[#C9A84C] hover:bg-[#A88B3A] text-black'}
          >
            {isListening ? 'STOP LISTENING' : 'START VOICE REC'}
          </Button>
        </div>
      </div>
    </div>
  );
};
