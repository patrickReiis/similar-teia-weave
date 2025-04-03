import { toast } from "@/components/ui/use-toast";
import { useNostrWebSocket } from "@/hooks/useNostrWebSocket";
import { useCallback } from "react";

export interface NostrEvent {
  id?: string;
  pubkey: string;
  created_at?: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
}

export interface Book {
  isbn: string;
  title: string;
  author: string;
  cover?: string;
  editionKey?: string | null;
  fallbackCoverUrls?: string[];
}

export interface SimilarityEvent {
  id: string;
  pubkey: string;
  createdAt: number;
  content: string;
  book1: Book;
  book2: Book;
  similarity: number;
}

export const RELAY_URL = "wss://relay.damus.io";
export const SIMILARITY_EVENT_KIND = 1729;

/**
 * Custom hook that provides Nostr service functionality
 * Centralized location for all Nostr-related operations
 */
export function useNostrService() {
  const { isConnected, subscribe, sendMessage } = useNostrWebSocket(RELAY_URL);
  
  /**
   * Get user's public key from Nostr extension
   */
  const getPublicKey = useCallback(async (): Promise<string> => {
    try {
      if (!window.nostr) {
        throw new Error("Nostr extension not found. Please install a Nostr extension.");
      }
      
      const pubkey = await window.nostr.getPublicKey();
      return pubkey;
    } catch (error) {
      console.error("Failed to get public key:", error);
      throw error;
    }
  }, []);

  /**
   * Sign a Nostr event using the extension
   */
  const signEvent = useCallback(async (event: NostrEvent): Promise<NostrEvent> => {
    try {
      if (!window.nostr) {
        throw new Error("Nostr extension not found");
      }
      
      const signedEvent = await window.nostr.signEvent(event);
      return signedEvent;
    } catch (error) {
      console.error("Failed to sign event:", error);
      throw error;
    }
  }, []);

  /**
   * Publish a signed event to Nostr relay
   */
  const publishEvent = useCallback(async (event: NostrEvent): Promise<string> => {
    if (!isConnected) {
      throw new Error("Not connected to relay");
    }
    
    return new Promise((resolve, reject) => {
      // Set timeout for response
      const timeoutId = setTimeout(() => {
        reject(new Error("Publish timeout"));
      }, 10000);
      
      // Setup listener for OK response
      const cleanup = useNostrEventListener((message) => {
        try {
          const data = JSON.parse(message.data);
          if (data[0] === "OK" && data[1] === event.id) {
            clearTimeout(timeoutId);
            cleanup(); // Remove listener
            resolve(data[1]);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });
      
      // Send event
      const success = sendMessage(["EVENT", event]);
      if (!success) {
        clearTimeout(timeoutId);
        cleanup();
        reject(new Error("Failed to send event"));
      }
    });
  }, [isConnected, sendMessage]);
  
  /**
   * Helper to listen for Nostr events
   */
  const useNostrEventListener = useCallback((handler: (event: MessageEvent) => void) => {
    const cleanup = addEventListener('message', handler);
    return cleanup;
  }, []);
  
  /**
   * Subscribe to Nostr events matching a filter
   */
  const subscribeToEvents = useCallback(
    (filter: { kinds: number[]; [key: string]: any }, onEvent: (event: NostrEvent) => void) => {
      if (!isConnected) {
        throw new Error("Not connected to relay");
      }
      
      const subId = Math.random().toString(36).substring(2);
      
      // Use the subscribe function from our WebSocket hook
      return subscribe(subId, filter, onEvent);
    },
    [isConnected, subscribe]
  );

  /**
   * Parse a Nostr event into a SimilarityEvent
   */
  const parseEventToSimilarity = useCallback((event: NostrEvent): SimilarityEvent | null => {
    try {
      const items = event.tags.filter(tag => tag[0] === 'i');
      const kinds = event.tags.filter(tag => tag[0] === 'kind');
      const similarityTag = event.tags.find(tag => tag[0] === 'similarity');
      
      if (items.length !== 2 || kinds.length !== 2 || !similarityTag) {
        return null;
      }
      
      if (!kinds.every(tag => tag[1] === 'isbn')) {
        return null;
      }
      
      const isbn1 = items[0][1].replace('isbn:', '');
      const isbn2 = items[1][1].replace('isbn:', '');
      
      const book1: Book = {
        isbn: isbn1,
        title: `Book ${isbn1}`,
        author: "Unknown Author"
      };
      
      const book2: Book = {
        isbn: isbn2,
        title: `Book ${isbn2}`,
        author: "Unknown Author"
      };
      
      const similarity = parseFloat(similarityTag[1]);
      
      return {
        id: event.id || '',
        pubkey: event.pubkey,
        createdAt: event.created_at || 0,
        content: event.content,
        book1,
        book2,
        similarity
      };
    } catch (error) {
      console.error("Failed to parse similarity event:", error);
      return null;
    }
  }, []);

  /**
   * Create and publish a similarity event
   */
  const createSimilarityEvent = useCallback(async (
    book1: Book,
    book2: Book,
    similarity: number,
    content: string
  ): Promise<string> => {
    try {
      const pubkey = await getPublicKey();
      
      const event: NostrEvent = {
        pubkey,
        kind: SIMILARITY_EVENT_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['i', `isbn:${book1.isbn}`],
          ['kind', 'isbn'],
          ['i', `isbn:${book2.isbn}`],
          ['kind', 'isbn'],
          ['similarity', similarity.toString()]
        ],
        content
      };
      
      const signedEvent = await signEvent(event);
      const eventId = await publishEvent(signedEvent);
      
      toast({
        title: "Success!",
        description: "Your similarity event has been published",
      });
      
      return eventId;
    } catch (error) {
      console.error("Failed to create similarity event:", error);
      toast({
        title: "Failed to publish event",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      throw error;
    }
  }, [getPublicKey, signEvent, publishEvent]);

  return {
    isConnected,
    getPublicKey,
    signEvent,
    publishEvent,
    subscribeToEvents,
    parseEventToSimilarity,
    createSimilarityEvent,
  };
}

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: NostrEvent): Promise<NostrEvent>;
    };
  }
}