
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { ConnectionStatus, TranscriptionEntry } from './types';
import { decode, encode, decodeAudioData, createBlob } from './services/audio-helpers';
import VoiceVisualizer from './components/VoiceVisualizer';
import TranscriptionList from './components/TranscriptionList';

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [history, setHistory] = useState<TranscriptionEntry[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAwake, setIsAwake] = useState(false);
  const [volume, setVolume] = useState(0);

  // Refs for audio and session management
  const sessionRef = useRef<any>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const transcriptionRef = useRef<{ input: string, output: string }>({ input: '', output: '' });

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current = null;
    }
    if (inputAudioCtxRef.current) inputAudioCtxRef.current.close();
    if (outputAudioCtxRef.current) outputAudioCtxRef.current.close();
    setStatus(ConnectionStatus.IDLE);
    setIsSpeaking(false);
    setIsAwake(false);
  }, []);

  const startSession = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      setIsAwake(false);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are 'Salin', a friendly bilingual translator.
          
          CURRENT STATE: You start in SILENT STANDBY (Sleeping).
          
          WAKE PROTOCOL:
          - Listen ONLY for "Hey Salin" or "Hey Sali".
          - IGNORE all other speech while in STANDBY.
          - When woken, say: "Gising na ako! Ready to translate." or "Salin is awake! How can I help?"
          
          ACTIVE PROTOCOL:
          - Translate English to Filipino and Filipino to English instantly.
          - Speak naturally and lively.
          
          SLEEP PROTOCOL:
          - If the user says "I'm satisfied with my translation", "Thank you Salin", or "Thank you Sali", you MUST stop translating.
          - Acknowledge with: "Sige, rest muna ako. Say 'Hey Salin' if you need me again!"
          - Immediately enter SILENT STANDBY and stop all further translation until the wake phrase is heard again.`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const source = inputAudioCtxRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioCtxRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              setVolume(Math.sqrt(sum / inputData.length));
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtxRef.current!.destination);
          },
          onmessage: async (message) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioCtxRef.current) {
              setIsSpeaking(true);
              const audioCtx = outputAudioCtxRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioCtx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
              const source = audioCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioCtx.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text.toLowerCase();
              transcriptionRef.current.input += text;
              
              // Trigger Logic
              if (!isAwake && (text.includes("hey salin") || text.includes("hey sali") || text.includes("hello salin"))) {
                setIsAwake(true);
                // Clear buffer so old "Hey Salin" doesn't re-trigger immediately later
                transcriptionRef.current.input = ''; 
              }
              
              const sleepPhrases = ["satisfied with my translation", "thank you salin", "thank you sali", "go to sleep"];
              if (isAwake && sleepPhrases.some(p => text.includes(p))) {
                setIsAwake(false);
                // Clear buffer on sleep
                transcriptionRef.current.input = '';
              }
            }
            
            if (message.serverContent?.outputTranscription) {
              transcriptionRef.current.output += message.serverContent.outputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const userText = transcriptionRef.current.input.trim();
              const modelText = transcriptionRef.current.output.trim();
              
              if (userText && isAwake) {
                setHistory(prev => [...prev, {
                  id: Math.random().toString(36).substr(2, 9),
                  speaker: 'user',
                  text: userText,
                  timestamp: new Date()
                }]);
              }
              if (modelText) {
                setHistory(prev => [...prev, {
                  id: Math.random().toString(36).substr(2, 9),
                  speaker: 'model',
                  text: modelText,
                  timestamp: new Date()
                }]);
              }
              transcriptionRef.current = { input: '', output: '' };
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onerror: (e) => {
            console.error('Salin Session Error:', e);
            setStatus(ConnectionStatus.ERROR);
            stopSession();
          },
          onclose: () => {
            setStatus(ConnectionStatus.IDLE);
            stopSession();
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Failed to start Salin:', err);
      setStatus(ConnectionStatus.ERROR);
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:20px_20px]"></div>
      </div>

      <header className="bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <span className="text-white font-outfit font-bold text-xl">S</span>
          </div>
          <div>
            <h1 className="font-outfit font-bold text-lg leading-tight text-gray-800 tracking-tight">Salin</h1>
            <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Pinoy Assistant</p>
          </div>
        </div>
        <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-500 shadow-sm ${
          status === ConnectionStatus.CONNECTED 
            ? (isAwake ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500') 
            : 'bg-red-50 text-red-400'
        }`}>
          {status === ConnectionStatus.CONNECTED ? (isAwake ? 'Awake' : 'Standby') : 'Offline'}
        </div>
      </header>

      <main className="flex-1 flex flex-col z-10">
        <div className="bg-white/50 backdrop-blur-sm rounded-b-[48px] shadow-xl shadow-gray-100/50 mb-4 border-b border-white">
          <VoiceVisualizer 
            status={status} 
            isActive={isSpeaking} 
            isAwake={isAwake}
            volume={volume} 
          />
        </div>

        <TranscriptionList entries={history} />
      </main>

      <footer className="p-6 bg-white/80 backdrop-blur-md border-t border-gray-100 sticky bottom-0 z-20">
        <div className="flex flex-col space-y-4">
          <button
            onClick={status === ConnectionStatus.CONNECTED ? stopSession : startSession}
            disabled={status === ConnectionStatus.CONNECTING}
            className={`w-full py-4 rounded-3xl font-outfit font-bold text-lg transition-all active:scale-95 shadow-xl flex items-center justify-center space-x-3 ${
              status === ConnectionStatus.CONNECTED 
                ? 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50' 
                : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white hover:shadow-indigo-200'
            } disabled:opacity-50`}
          >
            {status === ConnectionStatus.CONNECTING ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Calling Salin...</span>
              </>
            ) : status === ConnectionStatus.CONNECTED ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" x2="12" y1="2" y2="12"/>
                </svg>
                <span>End Session</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                   <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
                </svg>
                <span>Start Salin</span>
              </>
            )}
          </button>
          
          <div className="text-[10px] text-center text-slate-400 space-y-1">
            <p>Salin responds to your voice automatically.</p>
            <p className="font-semibold text-slate-500 uppercase tracking-tighter">Try: "Hey Salin!" or "Thank you Salin"</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
