
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

export const RELAY_URL = "wss://ditto.pub/relay";
export const SIMILARITY_EVENT_KIND = 1729;

let socket: WebSocket | null = null;
let pubkey: string | null = null;

export const connectToRelay = (): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      resolve(socket);
      return;
    }

    socket = new WebSocket(RELAY_URL);

    socket.onopen = () => {
      console.log("Connected to relay:", RELAY_URL);
      resolve(socket as WebSocket);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      reject(error);
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
  try {
    const ws = await connectToRelay();
    const subId = Math.random().toString(36).substring(2);
    
    const messageHandler = (message: MessageEvent) => {
      const data = JSON.parse(message.data);
      if (data[0] === "EVENT" && data[1] === subId) {
        onEvent(data[2]);
      }
    };
    
    ws.addEventListener("message", messageHandler);
    ws.send(JSON.stringify(["REQ", subId, filter]));
    
    // Return unsubscribe function
    return () => {
      ws.send(JSON.stringify(["CLOSE", subId]));
      ws.removeEventListener("message", messageHandler);
    };
  } catch (error) {
    console.error("Failed to subscribe to events:", error);
    throw error;
  }
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
