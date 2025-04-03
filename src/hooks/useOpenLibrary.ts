import { useQuery } from '@tanstack/react-query';
import { Book } from '@/hooks/useNostrService';
import { toast } from '@/components/ui/use-toast';

// API Constants
const OPENLIBRARY_BASE_URL = "https://openlibrary.org";
const COVERS_BASE_URL = "https://covers.openlibrary.org";

/**
 * Generate fallback cover URLs for a book based on ISBN
 */
function generateFallbackCoverUrls(isbn: string): string[] {
  const fallbacks: string[] = [];
  
  // Clean the ISBN (remove hyphens and spaces)
  const cleanIsbn = isbn.replace(/[-\s]/g, '').trim();
  
  // Only proceed if we have a valid ISBN
  if (!cleanIsbn) return fallbacks;
  
  // Add multiple size variants
  fallbacks.push(`${COVERS_BASE_URL}/b/isbn/${cleanIsbn}-M.jpg`);
  fallbacks.push(`${COVERS_BASE_URL}/b/isbn/${cleanIsbn}-L.jpg`);
  fallbacks.push(`${COVERS_BASE_URL}/b/olid/ISBN:${cleanIsbn}-M.jpg`);
  
  return fallbacks;
}

/**
 * Fetch book data from OpenLibrary API by ISBN
 */
async function fetchBooksByISBNs(isbns: string[]): Promise<Record<string, Book>> {
  try {
    // Handle empty array case
    if (!isbns.length) return {};
    
    // Normalize ISBNs
    const normalizedISBNs = isbns.map(isbn => isbn.replace(/[-\s]/g, '').trim());
    
    // Create bibkeys for API
    const bibkeys = normalizedISBNs.map(isbn => `ISBN:${isbn}`).join(',');
    
    // Fetch from API
    const response = await fetch(
      `${OPENLIBRARY_BASE_URL}/api/books?bibkeys=${bibkeys}&format=json&jscmd=data`,
      { 
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000) // 8s timeout using modern AbortSignal API
      }
    );
    
    if (!response.ok) {
      throw new Error(`OpenLibrary API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Process results
    const result: Record<string, Book> = {};
    
    isbns.forEach((originalISBN, i) => {
      const normalizedISBN = normalizedISBNs[i];
      const bookData = data[`ISBN:${normalizedISBN}`];
      
      if (bookData) {
        // Process book data
        let coverUrl = null;
        
        // Try to extract cover URL
        if (bookData.cover) {
          coverUrl = bookData.cover.medium || bookData.cover.large || bookData.cover.small;
        }
        
        if (!coverUrl) {
          // Default fallback
          coverUrl = `${COVERS_BASE_URL}/b/isbn/${normalizedISBN}-M.jpg`;
        }
        
        // Create book object
        result[originalISBN] = {
          isbn: originalISBN,
          title: bookData.title || `Book ${originalISBN}`,
          author: bookData.authors?.[0]?.name || "Unknown Author",
          cover: coverUrl,
          fallbackCoverUrls: generateFallbackCoverUrls(normalizedISBN)
        };
      } else {
        // Create fallback for books without data
        result[originalISBN] = {
          isbn: originalISBN,
          title: `Book ${originalISBN}`,
          author: "Unknown Author",
          cover: `${COVERS_BASE_URL}/b/isbn/${normalizedISBN}-M.jpg`,
          fallbackCoverUrls: generateFallbackCoverUrls(normalizedISBN)
        };
      }
    });
    
    return result;
  } catch (error) {
    console.error("Failed to fetch books by ISBNs:", error);
    toast({
      title: "API Error",
      description: "Failed to fetch book data from OpenLibrary.",
      variant: "destructive",
    });
    return {};
  }
}

/**
 * Search for books using OpenLibrary search API
 */
async function searchBooksApi(query: string): Promise<Book[]> {
  try {
    // Validate query
    if (!query || query.trim().length < 3) return [];
    
    // Fetch search results
    const response = await fetch(
      `${OPENLIBRARY_BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=20`,
      { signal: AbortSignal.timeout(8000) }
    );
    
    if (!response.ok) {
      throw new Error(`OpenLibrary API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.docs || !Array.isArray(data.docs)) {
      return [];
    }
    
    // Process search results
    const books: Book[] = [];
    
    for (const doc of data.docs) {
      // Skip books without title
      if (!doc.title) continue;
      
      // Extract ISBN
      let isbn = '';
      
      if (doc.isbn_13 && Array.isArray(doc.isbn_13) && doc.isbn_13.length > 0) {
        isbn = doc.isbn_13[0];
      } else if (doc.isbn && Array.isArray(doc.isbn) && doc.isbn.length > 0) {
        isbn = doc.isbn[0];
      } else if (doc.ia && Array.isArray(doc.ia)) {
        for (const item of doc.ia) {
          if (typeof item === 'string' && item.startsWith('isbn_')) {
            isbn = item.replace('isbn_', '');
            break;
          }
        }
      }
      
      // Skip books without ISBN
      if (!isbn) continue;
      
      // Generate cover URL
      const cleanIsbn = isbn.replace(/[-\s]/g, '').trim();
      let coverUrl = '';
      
      if (doc.cover_i) {
        coverUrl = `${COVERS_BASE_URL}/b/id/${doc.cover_i}-M.jpg`;
      } else if (doc.cover_edition_key) {
        coverUrl = `${COVERS_BASE_URL}/b/olid/${doc.cover_edition_key}-M.jpg`;
      } else if (cleanIsbn) {
        coverUrl = `${COVERS_BASE_URL}/b/isbn/${cleanIsbn}-M.jpg`;
      }
      
      // Create book object
      books.push({
        isbn: isbn,
        title: doc.title,
        author: doc.author_name?.[0] || 'Unknown Author',
        cover: coverUrl,
        editionKey: doc.cover_edition_key || null,
        fallbackCoverUrls: generateFallbackCoverUrls(isbn)
      });
    }
    
    return books;
  } catch (error) {
    console.error("Error searching books:", error);
    toast({
      title: "Search Error",
      description: "Failed to search OpenLibrary.",
      variant: "destructive",
    });
    return [];
  }
}

/**
 * Hook for fetching books by ISBNs using React Query
 */
export function useBooksByISBNs(isbns: string[]) {
  return useQuery({
    queryKey: ['books', 'isbn', isbns.sort().join(',')],
    queryFn: () => fetchBooksByISBNs(isbns),
    enabled: isbns.length > 0,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Hook for searching books using React Query
 */
export function useBookSearch(query: string) {
  return useQuery({
    queryKey: ['books', 'search', query],
    queryFn: () => searchBooksApi(query),
    enabled: query.trim().length >= 3,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}