
import { toast } from "@/components/ui/use-toast";

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

// Update the relay URL
export const RELAY_URL = "wss://relay.damus.io";
export const SIMILARITY_EVENT_KIND = 1729;
export const MAX_RETRY_COUNT = 3;
export const RETRY_DELAY = 2000;

let socket: WebSocket | null = null;
let pubkey: string | null = null;
let connectionAttempts = 0;

export const connectToRelay = (): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log("Using existing open WebSocket connection");
      connectionAttempts = 0;
      resolve(socket);
      return;
    }
    
    // Close existing socket if it exists
    if (socket) {
      console.log("Closing existing socket");
      socket.close();
      socket = null;
    }

    connectionAttempts++;
    console.log(`Connection attempt ${connectionAttempts} to relay: ${RELAY_URL}`);
    
    socket = new WebSocket(RELAY_URL);

    socket.onopen = () => {
      console.log("Connected to relay:", RELAY_URL);
      connectionAttempts = 0;
      resolve(socket as WebSocket);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      
      // If we haven't exceeded max retries, try again
      if (connectionAttempts < MAX_RETRY_COUNT) {
        console.log(`Retrying connection in ${RETRY_DELAY}ms (attempt ${connectionAttempts}/${MAX_RETRY_COUNT})`);
        setTimeout(() => {
          if (socket) {
            socket.close();
            socket = null;
          }
          // Create a new promise chain for retry
          connectToRelay()
            .then(resolve)
            .catch(reject);
        }, RETRY_DELAY);
      } else {
        connectionAttempts = 0;
        reject(error);
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from relay");
      socket = null;
    };
  });
};

export const getPublicKey = async (): Promise<string> => {
  if (pubkey) return pubkey;
  
  try {
    // Check if window.nostr exists
    if (!window.nostr) {
      throw new Error("Nostr extension not found. Please install a Nostr extension.");
    }
    
    // Request public key from extension
    pubkey = await window.nostr.getPublicKey();
    return pubkey;
  } catch (error) {
    console.error("Failed to get public key:", error);
    throw error;
  }
};

export const signEvent = async (event: NostrEvent): Promise<NostrEvent> => {
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
};

export const publishEvent = async (event: NostrEvent): Promise<string> => {
  try {
    const ws = await connectToRelay();
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Publish timeout"));
      }, 10000);
      
      const messageHandler = (message: MessageEvent) => {
        const data = JSON.parse(message.data);
        if (data[0] === "OK" && data[1] === event.id) {
          clearTimeout(timeoutId);
          ws.removeEventListener("message", messageHandler);
          resolve(data[1]);
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
  let retryCount = 0;
  let ws: WebSocket;
  const subId = Math.random().toString(36).substring(2);
  let messageHandler: (message: MessageEvent) => void;
  
  const setupSubscription = async (): Promise<() => void> => {
    try {
      console.log(`Setting up subscription (attempt ${retryCount + 1})`);
      ws = await connectToRelay();
      
      // Make sure we're connected before continuing
      if (ws.readyState !== WebSocket.OPEN) {
        console.log("Waiting for WebSocket connection to be ready...");
        // Wait for the connection to be established
        await new Promise<void>((resolve, reject) => {
          const checkState = () => {
            if (ws.readyState === WebSocket.OPEN) {
              resolve();
            } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
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
      
      messageHandler = (message: MessageEvent) => {
        try {
          const data = JSON.parse(message.data);
          if (data[0] === "EVENT" && data[1] === subId) {
            console.log("Received matching event:", data[2]);
            onEvent(data[2]);
          } else if (data[0] === "EOSE" && data[1] === subId) {
            console.log("End of stored events");
          }
        } catch (error) {
          console.error("Error handling WebSocket message:", error);
        }
      };
      
      ws.addEventListener("message", messageHandler);
      ws.send(JSON.stringify(["REQ", subId, filter]));
      console.log("Subscription request sent:", JSON.stringify(["REQ", subId, filter]));
      
      // Return unsubscribe function
      return () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(["CLOSE", subId]));
        }
        if (ws) {
          ws.removeEventListener("message", messageHandler);
        }
      };
    } catch (error) {
      console.error(`Subscription attempt ${retryCount + 1} failed:`, error);
      
      // If we haven't exceeded max retries, try again
      if (retryCount < MAX_RETRY_COUNT) {
        retryCount++;
        console.log(`Retrying subscription in ${RETRY_DELAY}ms (attempt ${retryCount}/${MAX_RETRY_COUNT})`);
        return new Promise((resolve) => {
          setTimeout(async () => {
            const unsubscribe = await setupSubscription();
            resolve(unsubscribe);
          }, RETRY_DELAY);
        });
      }
      throw error;
    }
  };
  
  return setupSubscription();
};

export const parseEventToSimilarity = (event: NostrEvent): SimilarityEvent | null => {
  try {
    // Find all 'i' tags (items)
    const items = event.tags.filter(tag => tag[0] === 'i');
    
    // Find all 'kind' tags
    const kinds = event.tags.filter(tag => tag[0] === 'kind');
    
    // Find similarity tag
    const similarityTag = event.tags.find(tag => tag[0] === 'similarity');
    
    if (items.length !== 2 || kinds.length !== 2 || !similarityTag) {
      console.error("Invalid similarity event format", event);
      return null;
    }
    
    // Check if both items are books (ISBN)
    if (!kinds.every(tag => tag[1] === 'isbn')) {
      return null; // Not a book similarity event
    }
    
    // Extract ISBNs
    const isbn1 = items[0][1].replace('isbn:', '');
    const isbn2 = items[1][1].replace('isbn:', '');
    
    // For now we'll create placeholder book objects
    // In a real app, you'd fetch the book details from OpenLibrary
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

// Type declaration for the Nostr window extension
declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: NostrEvent): Promise<NostrEvent>;
    };
  }
}
