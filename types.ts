
export interface TranscriptionEntry {
  id: string;
  speaker: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export enum ConnectionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface VoiceState {
  isSpeaking: boolean;
  volume: number;
}
