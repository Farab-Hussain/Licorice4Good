/**
 * Trackdesk Global Type Definitions
 * Provides TypeScript support for the Trackdesk tracking script
 */

interface TrackdeskConfig {
  apiUrl: string;
  version: string;
  debug: boolean;
  batchSize: number;
  flushInterval: number;
  maxRetries: number;
  retryDelay: number;
}

interface TrackdeskInitConfig {
  apiUrl: string;
  websiteId: string;
  debug?: boolean;
  batchSize?: number;
  flushInterval?: number;
}

interface ConversionData {
  orderId?: string;
  value?: number;
  currency?: string;
  items?: Array<{
    id: string;
    name?: string;
    price?: number;
    quantity?: number;
  }>;
  [key: string]: any;
}

interface TrackdeskAPI {
  init: (config: TrackdeskInitConfig) => void;
  track: (eventName: string, eventData?: Record<string, any>) => void;
  identify: (userId: string, userData?: Record<string, any>) => void;
  convert: (conversionData: ConversionData) => void;
  flush: (force?: boolean) => Promise<void>;
  config: TrackdeskConfig;
}

declare global {
  interface Window {
    Trackdesk: TrackdeskAPI;
  }
}

export {};
