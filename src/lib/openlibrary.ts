import { toast } from "@/components/ui/use-toast";
import { Book } from "./nostr";

// Base OpenLibrary URL
const OPENLIBRARY_BASE_URL = "https://openlibrary.org";

// Cache configuration
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours for book data
const bookCache: Record<string, { data: Record<string, Book>; timestamp: number }> = {};

// Function to check if an image URL is valid/reachable
const checkImageExists = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error(`Failed to check image at ${url}:`, error);
    return false;
  }
};

/**
 * Get book information from OpenLibrary by ISBN
 */
export const getBooksByISBNs = async (isbns: string[]): Promise<Record<string, Book>> => {
  try {
    // Create a cache key from sorted ISBNs to ensure consistency
    const cacheKey = [...isbns].sort().join(',');
    
    // Check cache first
    const now = Date.now();
    const cached = bookCache[cacheKey];
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      console.log("Using cached book data");
      return cached.data;
    }
    
    // Normalize ISBNs - remove hyphens and ensure they're clean
    const normalizedISBNs = isbns.map(isbn => isbn.replace(/[-\\s]/g, '').trim());
    
    // Create comma-separated list of ISBN bibkeys
    const bibkeys = normalizedISBNs.map(isbn => `ISBN:${isbn}`).join(',');
    console.log('OpenLibrary request with bibkeys:', bibkeys);
    
    // Construct the API URL
    const url = `${OPENLIBRARY_BASE_URL}/api/books?bibkeys=${bibkeys}&format=json&jscmd=data`;
    console.log('OpenLibrary API URL:', url);
    
    // Fetch data with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`OpenLibrary API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('OpenLibrary API response:', data);
    
    const result: Record<string, Book> = {};
    
    // Process each ISBN from the original list
    for (let i = 0; i < isbns.length; i++) {
      const originalISBN = isbns[i];
      const normalizedISBN = normalizedISBNs[i];
      const bookData = data[`ISBN:${normalizedISBN}`];
      
      if (bookData) {
        // Process book data
        console.log(`Found data for ISBN ${originalISBN}`);
        
        // Try to get a cover URL with multiple fallbacks
        let coverUrl = null;
        
        // 1. Try cover objects from the API response
        if (bookData.cover) {
          if (bookData.cover.medium) {
            coverUrl = bookData.cover.medium;
          } else if (bookData.cover.large) {
            coverUrl = bookData.cover.large;
          } else if (bookData.cover.small) {
            coverUrl = bookData.cover.small;
          }
        }
        
        // 2. If no cover from API, try direct cover API with normalized ISBN
        if (!coverUrl) {
          coverUrl = `${OPENLIBRARY_BASE_URL}/covers/b/isbn/${normalizedISBN}-M.jpg`;
        }
        
        result[originalISBN] = {
          isbn: originalISBN,
          title: bookData.title || `Book ${originalISBN}`,
          author: bookData.authors?.[0]?.name || "Unknown Author",
          cover: coverUrl
        };
      } else {
        console.log(`No data found for ISBN ${originalISBN}, using fallback`);
        
        // Create a basic fallback entry with direct cover URL
        result[originalISBN] = {
          isbn: originalISBN,
          title: `Book ${originalISBN}`,
          author: "Unknown Author",
          cover: `${OPENLIBRARY_BASE_URL}/covers/b/isbn/${normalizedISBN}-M.jpg`
        };
      }
    }
    
    // Cache the result
    bookCache[cacheKey] = { data: result, timestamp: now };
    
    return result;
  } catch (error) {
    console.error("Failed to get books by ISBNs:", error);
    toast({
      title: "API Error",
      description: "Failed to fetch book data from OpenLibrary. Please try again later.",
      variant: "destructive",
    });
    return {};
  }
};

export interface SearchResult {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  isbn?: string[];
  first_publish_year?: number;
}

/**
 * Search for books by title, author, etc.
 */
export const searchBooks = async (query: string): Promise<Book[]> => {
  try {
    if (!query || query.trim() === '') return [];
    
    const url = `${OPENLIBRARY_BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=10`;
    console.log('Search URL:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OpenLibrary API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Search returned ${data.docs?.length || 0} results`);
    
    if (!data.docs || !Array.isArray(data.docs)) {
      return [];
    }
    
    // Process search results into Book objects
    const books: Book[] = data.docs
      .filter((doc: SearchResult) => doc.isbn && doc.isbn.length > 0)
      .map((doc: SearchResult) => {
        const isbn = doc.isbn?.[0] || '';
        
        // Generate the best possible cover URL
        let coverUrl = '';
        if (doc.cover_i) {
          coverUrl = `${OPENLIBRARY_BASE_URL}/covers/b/id/${doc.cover_i}-M.jpg`;
        } else if (isbn) {
          const normalizedISBN = isbn.replace(/[-\\s]/g, '');
          coverUrl = `${OPENLIBRARY_BASE_URL}/covers/b/isbn/${normalizedISBN}-M.jpg`;
        }
        
        return {
          isbn: isbn,
          title: doc.title || 'Unknown Title',
          author: doc.author_name?.[0] || 'Unknown Author',
          cover: coverUrl
        };
      });
    
    return books;
  } catch (error) {
    console.error("Error searching books:", error);
    toast({
      title: "Search Error",
      description: "Failed to search OpenLibrary. Please try again later.",
      variant: "destructive",
    });
    return [];
  }
};