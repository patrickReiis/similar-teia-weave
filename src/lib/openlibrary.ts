import { toast } from "@/components/ui/use-toast";
import { Book } from "./nostr";

// Base OpenLibrary URL for API requests
const OPENLIBRARY_BASE_URL = "https://openlibrary.org";
// Base URL for cover images
const COVERS_BASE_URL = "https://covers.openlibrary.org";

// Cache configuration
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours for book data
const bookCache: Record<string, { data: Record<string, Book>; timestamp: number }> = {};

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
    const normalizedISBNs = isbns.map(isbn => isbn.replace(/[-\s]/g, '').trim());
    
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
          coverUrl = `${COVERS_BASE_URL}/b/isbn/${normalizedISBN}-M.jpg`;
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
          cover: `${COVERS_BASE_URL}/b/isbn/${normalizedISBN}-M.jpg`
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

/**
 * Search for books by title, author, etc.
 */
export const searchBooks = async (query: string): Promise<Book[]> => {
  try {
    if (!query || query.trim() === '') return [];
    
    // If query is too short, return empty array
    if (query.trim().length < 3) return [];
    
    const url = `${OPENLIBRARY_BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=20`;
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
    
    // Process search results to extract essential information immediately
    const books: Book[] = [];
    
    for (const doc of data.docs) {
      // Skip books without title
      if (!doc.title) continue;
      
      // Extract ISBN from all possible sources
      let isbn = '';
      
      // 1. Check for standard isbn arrays
      if (doc.isbn_13 && Array.isArray(doc.isbn_13) && doc.isbn_13.length > 0) {
        isbn = doc.isbn_13[0];
      } else if (doc.isbn && Array.isArray(doc.isbn) && doc.isbn.length > 0) {
        isbn = doc.isbn[0];
      } 
      // 2. Check the ia array for isbn prefixed entries (e.g., isbn_9781463538002)
      else if (doc.ia && Array.isArray(doc.ia)) {
        for (const item of doc.ia) {
          if (typeof item === 'string' && item.startsWith('isbn_')) {
            // Extract the ISBN from the string
            isbn = item.replace('isbn_', '');
            break;
          }
        }
      }
      
      // If we don't have an ISBN, skip this book
      if (!isbn) continue;
      
      // Generate initial cover URL based on what's available in search results
      let coverUrl = '';
      
      if (doc.cover_i) {
        coverUrl = `${COVERS_BASE_URL}/b/id/${doc.cover_i}-M.jpg`;
      } else if (doc.cover_edition_key) {
        coverUrl = `${COVERS_BASE_URL}/b/olid/${doc.cover_edition_key}-M.jpg`;
      } else {
        const normalizedISBN = isbn.replace(/[-\s]/g, '');
        coverUrl = `${COVERS_BASE_URL}/b/isbn/${normalizedISBN}-M.jpg`;
      }
      
      // Create a book entry with the information we have immediately
      const book: Book = {
        isbn: isbn,
        title: doc.title,
        author: doc.author_name?.[0] || 'Unknown Author',
        cover: coverUrl,
        // Add edition key so we can fetch more details in the background
        editionKey: doc.cover_edition_key || null
      };
      
      books.push(book);
    }
    
    console.log(`Found ${books.length} books with ISBNs`);
    
    // If we have edition keys, fetch detailed info in the background
    // This won't delay the initial display of results
    for (const book of books) {
      if (book.editionKey) {
        // No await here - we don't want to block
        fetchBookDetailsInBackground(book.editionKey, book);
      }
    }
    
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

/**
 * Fetch book details in the background and update the book object
 * This function intentionally doesn't return a Promise because we don't want to await it
 */
function fetchBookDetailsInBackground(editionKey: string, book: Book): void {
  (async () => {
    try {
      const key = editionKey.startsWith('OL') ? editionKey : `OL${editionKey}`;
      console.log(`Background fetch: book details for ${key}`);
      
      const url = `${OPENLIBRARY_BASE_URL}/books/${key}.json`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Background fetch error: ${response.status} for ${key}`);
        return;
      }
      
      const data = await response.json();
      
      // Update book cover if we have better covers in the detailed data
      if (data.covers && Array.isArray(data.covers) && data.covers.length > 0) {
        // Update with a better cover URL
        book.cover = `${COVERS_BASE_URL}/b/id/${data.covers[0]}-M.jpg`;
        console.log(`Background fetch: updated cover for "${book.title}"`);
      }
      
      // Update author name if possible
      if (data.authors && Array.isArray(data.authors) && data.authors[0]?.key) {
        try {
          const authorKey = data.authors[0].key;
          const authorUrl = `${OPENLIBRARY_BASE_URL}${authorKey}.json`;
          const authorResponse = await fetch(authorUrl);
          
          if (authorResponse.ok) {
            const authorData = await authorResponse.json();
            if (authorData.name) {
              book.author = authorData.name;
              console.log(`Background fetch: updated author for "${book.title}"`);
            }
          }
        } catch (authorError) {
          console.error('Background fetch: error getting author:', authorError);
        }
      }
      
    } catch (error) {
      console.error(`Background fetch: error for ${editionKey}:`, error);
    }
  })();
}