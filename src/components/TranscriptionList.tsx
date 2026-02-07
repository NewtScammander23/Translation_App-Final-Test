import React from 'react';
import { TranscriptionEntry } from '../types';

interface TranscriptionListProps {
  entries: TranscriptionEntry[];
}

const TranscriptionList: React.FC<TranscriptionListProps> = ({ entries }) => {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-h-[40vh]">
      {entries.length === 0 ? (
        <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
          No conversations yet...
        </div>
      ) : (
        entries.map((entry) => (
          <div 
            key={entry.id}
            className={`flex flex-col ${entry.speaker === 'user' ? 'items-end' : 'items-start'} transition-all animate-in fade-in slide-in-from-bottom-2`}
          >
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
              entry.speaker === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
            }`}>
              <p className="text-sm font-medium">{entry.text}</p>
            </div>
            <span className="text-[10px] text-gray-400 mt-1 px-1">
              {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))
      )}
    </div>
  );
};

export default TranscriptionList;
