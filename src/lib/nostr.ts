import { Event, finalizeEvent, getEventHash } from 'nostr-tools';
import { toast } from "@/components/ui/use-toast";
import { canSignEvents, getCurrentUser } from './auth';

// Re-export auth types
export type { User } from './auth';

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
  fallbackCoverUrls?: string[]; // Alternative cover URLs to try if the primary one fails
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
export const MAX_RETRY_COUNT = 2;
export const RETRY_DELAY = 1000;

// Generate a short subscription ID (compatible with strict relays)
export function generateShortId(prefix: string = ''): string {
  // Generate 8 random hex characters (4 bytes)
  const randomStr = Math.random().toString(16).substring(2, 10);
  return prefix ? `${prefix}${randomStr.slice(0, 6)}` : randomStr.slice(0, 8);
}

let socket: WebSocket | null = null;
let connectionPromise: Promise<WebSocket> | null = null;

export const connectToRelay = (): Promise<WebSocket> => {
  // If we already have a valid connection promise and socket, return it
  if (connectionPromise && socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
    console.log(`Reusing existing connection promise to ${RELAY_URL}`);
    return connectionPromise;
  }
  
  // Create a new connection promise
  connectionPromise = new Promise((resolve, reject) => {
    // If we have an existing socket that's not in OPEN state, close it
    if (socket && socket.readyState !== WebSocket.OPEN) {
      console.log("Closing existing socket that's not open");
      socket.close();
      socket = null;
    }
    
    // If we already have an open connection, use it
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log(`Using existing open WebSocket connection to ${RELAY_URL}`);
      resolve(socket);
      return;
    }
    
    // Create a new WebSocket connection
    console.log(`Connecting to relay: ${RELAY_URL}`);
    
    socket = new WebSocket(RELAY_URL);
    
    socket.onopen = () => {
      console.log(`Connected to relay: ${RELAY_URL}`);
      resolve(socket as WebSocket);
    };
    
    socket.onerror = (error) => {
      console.error(`WebSocket error connecting to ${RELAY_URL}:`, error);
      reject(error);
    };
    
    socket.onclose = () => {
      console.log(`Disconnected from relay: ${RELAY_URL}`);
      socket = null;
      connectionPromise = null;
    };
  });
  
  return connectionPromise;
};

export const getPublicKey = async (): Promise<string> => {
  const user = getCurrentUser();
  if (!user) {
    throw new Error("User not logged in");
  }
  
  return user.pubkey;
};

export const signEvent = async (event: NostrEvent): Promise<NostrEvent> => {
  try {
    const user = getCurrentUser();
    
    if (!user) {
      throw new Error("User not logged in");
    }
    
    if (!canSignEvents()) {
      throw new Error("Current login method cannot sign events");
    }
    
    // If using extension
    if (user.loginMethod === 'extension') {
      if (!window.nostr) {
        throw new Error("Nostr extension not found");
      }
      
      return await window.nostr.signEvent(event);
    } 
    
    // If using private key
    if (user.loginMethod === 'nsec' && user.privateKey) {
      // Use nostr-tools to sign the event
      const eventToSign = {
        kind: event.kind,
        tags: event.tags,
        content: event.content,
        created_at: event.created_at || Math.floor(Date.now() / 1000),
        pubkey: user.pubkey,
      } as Event;
      
      // Finalize the event (calculates id and adds signature)
      const signedEvent = finalizeEvent(eventToSign, user.privateKey);
      
      // Return the signed event
      return {
        ...event,
        id: signedEvent.id,
        sig: signedEvent.sig
      };
    }
    
    throw new Error("No valid signing method available");
  } catch (error) {
    console.error("Failed to sign event:", error);
    throw error;
  }
};

export const publishEvent = async (event: NostrEvent): Promise<string> => {
  try {
    const ws = await connectToRelay();
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Publish timeout"));
      }, 10000);
      
      const messageHandler = (message: MessageEvent) => {
        try {
          const data = JSON.parse(message.data);
          if (data[0] === "OK" && data[1] === event.id) {
            clearTimeout(timeoutId);
            ws.removeEventListener("message", messageHandler);
            resolve(data[1]);
          }
        } catch (e) {
          console.error("Error parsing message:", e);
        }
      };
      
      ws.addEventListener("message", messageHandler);
      ws.send(JSON.stringify(["EVENT", event]));
    });
  } catch (error) {
    console.error("Failed to publish event:", error);
    throw error;
  }
};

export const subscribeToEvents = async (
  filter: { kinds: number[]; [key: string]: any },
  onEvent: (event: NostrEvent) => void
): Promise<() => void> => {
  // Generate a short subscription ID to avoid errors with strict relays
  const subId = generateShortId("s");
  
  try {
    console.log(`Setting up subscription with ID: ${subId} to relay ${RELAY_URL}`);
    // Get WebSocket connection
    const ws = await connectToRelay();
    
    // Ensure the connection is open
    if (ws.readyState !== WebSocket.OPEN) {
      console.log("Waiting for WebSocket connection to be ready...");
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for connection"));
        }, 5000);
        
        const checkState = () => {
          if (ws.readyState === WebSocket.OPEN) {
            clearTimeout(timeout);
            resolve();
          } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
            clearTimeout(timeout);
            reject(new Error("WebSocket closed before connection was established"));
          } else {
            // Still connecting, check again in 100ms
            setTimeout(checkState, 100);
          }
        };
        
        checkState();
      });
    }
    
    console.log(`WebSocket ready, subscribing with ID: ${subId}`);
    
    // Set up message handler for this subscription
    const messageHandler = (message: MessageEvent) => {
      try {
        // Log notices for debugging
        const data = JSON.parse(message.data);
        if (data[0] === "NOTICE") {
          console.warn(`Relay notice: ${data[1]}`);
        }
        
        if (data[0] === "EVENT" && data[1] === subId) {
          console.log("Received matching event:", data[2]);
          onEvent(data[2]);
        } else if (data[0] === "EOSE" && data[1] === subId) {
          console.log("End of stored events for subscription:", subId);
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };
    
    // Add the message handler
    ws.addEventListener("message", messageHandler);
    
    // Send the subscription request
    ws.send(JSON.stringify(["REQ", subId, filter]));
    console.log("Subscription request sent:", JSON.stringify(["REQ", subId, filter]));
    
    // Return a function to clean up the subscription
    return () => {
      console.log(`Cleaning up subscription: ${subId}`);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(["CLOSE", subId]));
        console.log(`Sent CLOSE for subscription: ${subId}`);
      } else {
        console.log(`WebSocket not open, couldn't send CLOSE for: ${subId}`);
      }
      ws.removeEventListener("message", messageHandler);
    };
  } catch (error) {
    console.error(`Subscription failed:`, error);
    throw error;
  }
};

export const parseEventToSimilarity = (event: NostrEvent): SimilarityEvent | null => {
  try {
    const items = event.tags.filter(tag => tag[0] === 'i');
    const kinds = event.tags.filter(tag => tag[0] === 'kind');
    const similarityTag = event.tags.find(tag => tag[0] === 'similarity');
    
    if (items.length !== 2 || kinds.length !== 2 || !similarityTag) {
      console.error("Invalid similarity event format", event);
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
};

export const createSimilarityEvent = async (
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
};