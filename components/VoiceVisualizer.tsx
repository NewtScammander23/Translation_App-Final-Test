
import React, { useEffect, useState } from 'react';

interface VoiceVisualizerProps {
  status: string;
  isActive: boolean; // Model is speaking
  isAwake: boolean;
  volume: number; // User input volume
}

const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ status, isActive, isAwake, volume }) => {
  const [blink, setBlink] = useState(false);
  const normalizedVolume = Math.min(100, volume * 500);

  // Random blinking effect when awake
  useEffect(() => {
    if (!isAwake && !isActive) return;
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, Math.random() * 4000 + 2000);
    return () => clearInterval(blinkInterval);
  }, [isAwake, isActive]);

  const actuallyAwake = isAwake || isActive;

  const getCoreColor = () => {
    if (status !== 'CONNECTED') return 'bg-gray-300';
    if (!actuallyAwake) return 'bg-gradient-to-br from-slate-700 to-slate-900';
    return isActive 
      ? 'bg-gradient-to-br from-indigo-500 via-blue-600 to-purple-600' 
      : 'bg-gradient-to-br from-blue-500 to-indigo-600';
  };

  const getRingColor = () => {
    if (status !== 'CONNECTED') return 'bg-gray-200';
    return actuallyAwake ? (isActive ? 'bg-purple-400' : 'bg-blue-400') : 'bg-slate-400';
  };

  // Expression logic
  const getEyebrowTransform = () => {
    if (!actuallyAwake) return 'rotate(5deg) translateY(4px)';
    if (isActive) return 'rotate(-12deg) translateY(-3px)'; // Excited/Happy
    if (volume > 0.02) return 'rotate(-3deg) translateY(-1px)'; // Attentive
    return 'rotate(0deg) translateY(0px)';
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-8 select-none">
      <div className="relative flex items-center justify-center">
        {/* Glowing Background Rings - Gated by isAwake */}
        <div 
          className={`absolute w-60 h-60 rounded-full opacity-10 transition-all duration-1000 ${getRingColor()} ${actuallyAwake && (isActive || volume > 0.05) ? 'scale-125' : 'scale-100'}`}
          style={{ transform: (actuallyAwake && (isActive || volume > 0.05)) ? `scale(${1 + normalizedVolume / 80})` : 'scale(1)' }}
        />
        <div 
          className={`absolute w-44 h-44 rounded-full opacity-20 transition-all duration-700 ${getRingColor()} ${isActive ? 'scale-110 animate-pulse' : 'scale-100'}`}
        />
        
        {/* The Face Container */}
        <div className={`z-10 w-36 h-36 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-700 overflow-hidden relative border-4 ${actuallyAwake ? 'border-white/20' : 'border-black/10'} ${getCoreColor()}`}>
          
          {/* Eyebrows */}
          <div className="flex space-x-10 absolute top-10 transition-all duration-500">
            <div className="w-6 h-1 bg-white/40 rounded-full" style={{ transform: getEyebrowTransform() }} />
            <div className="w-6 h-1 bg-white/40 rounded-full" style={{ transform: getEyebrowTransform().replace('-', '') }} />
          </div>

          {/* Eyes */}
          <div className="flex space-x-8 mb-3 mt-4 transition-transform duration-300" 
               style={{ transform: isActive ? 'translateY(-3px)' : (actuallyAwake && volume > 0.05 ? 'scale(1.05)' : 'none') }}>
            <div className={`bg-white rounded-full transition-all duration-300 ${
              !actuallyAwake || blink ? 'h-1.5 w-7 mt-2 opacity-50' : 'h-5 w-5 shadow-[0_0_15px_rgba(255,255,255,0.9)]'
            }`} />
            <div className={`bg-white rounded-full transition-all duration-300 ${
              !actuallyAwake || blink ? 'h-1.5 w-7 mt-2 opacity-50' : 'h-5 w-5 shadow-[0_0_15px_rgba(255,255,255,0.9)]'
            }`} />
          </div>

          {/* Mouth Area */}
          <div className="flex items-center justify-center h-8 w-20 relative">
            {!actuallyAwake ? (
              <div className="w-5 h-1 bg-white/20 rounded-full transition-all duration-700" />
            ) : isActive ? (
              // Speaking animation - Lively Grin
              <div className="flex items-end space-x-1.5">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-2 bg-white rounded-full transition-all duration-75 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                    style={{ height: `${Math.max(20, Math.random() * 100)}%`, minHeight: '6px' }}
                  />
                ))}
              </div>
            ) : isAwake && volume > 0.01 ? (
              // Listening animation - Focused "O" mouth (ONLY show if actually awake)
              <div 
                className="bg-white/90 rounded-full transition-all duration-150 border-2 border-indigo-200/30"
                style={{ 
                    width: `${Math.min(32, 12 + volume * 400)}px`, 
                    height: `${Math.min(32, 12 + volume * 400)}px`,
                    opacity: 0.8 + volume
                }}
              />
            ) : (
              // Idle smile
              <div className="w-8 h-1.5 bg-white/60 rounded-full transition-all duration-500" style={{ borderRadius: '0 0 100px 100px' }} />
            )}
          </div>

          {/* Cheeks (Blush) */}
          <div className={`absolute bottom-8 flex justify-between w-24 transition-opacity duration-1000 ${actuallyAwake ? (isActive ? 'opacity-40' : 'opacity-20') : 'opacity-0'}`}>
            <div className="w-4 h-3 bg-pink-400 rounded-full blur-[3px]" />
            <div className="w-4 h-3 bg-pink-400 rounded-full blur-[3px]" />
          </div>
        </div>
      </div>
      
      <div className="text-center transition-all duration-500">
        <h2 className="text-2xl font-outfit font-bold text-gray-800 tracking-tight transition-all duration-500" 
            style={{ transform: isActive ? 'scale(1.05)' : 'scale(1)' }}>
          {status !== 'CONNECTED' ? "Meet Salin" : actuallyAwake ? (isActive ? "Salin is Talking!" : "Salin is Listening") : "Salin is Napping"}
        </h2>
        <div className="mt-3 flex flex-col items-center">
           {status !== 'CONNECTED' ? (
             <p className="text-xs text-gray-400 uppercase tracking-widest font-bold bg-gray-100 px-3 py-1 rounded-full">Press start to wake her</p>
           ) : actuallyAwake ? (
             <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-indigo-600 font-black flex items-center gap-2 tracking-widest bg-indigo-50 px-4 py-1.5 rounded-full">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
                  </span>
                  {isActive ? "SALIN IS SPEAKING" : "READY TO TRANSLATE"}
                </p>
                <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">Try English or Tagalog</p>
             </div>
           ) : (
             <div className="flex flex-col items-center gap-2 animate-bounce-subtle">
                <p className="text-sm text-gray-500 font-semibold italic">"Zzz..."</p>
                <p className="text-sm text-gray-400 font-medium">
                  Say <span className="text-indigo-600 font-bold px-2.5 py-1 bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm">"Hey Salin!"</span>
                </p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default VoiceVisualizer;
