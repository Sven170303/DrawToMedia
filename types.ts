export type Language = 'en' | 'de' | 'fr';

export enum ViewState {
  HOME = 'HOME',
  LOGIN = 'LOGIN',
  GENERATE = 'GENERATE',
  HISTORY = 'HISTORY',
  CREDITS = 'CREDITS'
}

export interface User {
  email: string;
  credits: number;
  isVerified: boolean;
}

export interface GeneratedImage {
  id: string;
  originalImage: string; // Base64
  generatedImage: string; // Base64
  prompt: string;
  timestamp: number;
  durationSeconds: number;
  feedback?: string;
}

export interface TranslationDictionary {
  [key: string]: {
    en: string;
    de: string;
    fr: string;
  };
}