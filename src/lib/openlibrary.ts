
import { Book } from "./nostr";

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

interface OpenLibraryResponse {
  docs: {
    key: string;
    title: string;
    author_name?: string[];
    isbn?: string[];
    cover_i?: number;
  }[];
  numFound: number;
}

export const searchBooks = async (query: string): Promise<Book[]> => {
  try {
    if (!query || query.trim() === '') return [];
    
    const response = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=key,title,author_name,isbn,cover_i`
    );
    
    if (!response.ok) {
      throw new Error(`OpenLibrary API error: ${response.status}`);
    }
    
    const data: OpenLibraryResponse = await response.json();
    
    return data.docs
      .filter(book => book.isbn && book.isbn.length > 0)
      .map(book => ({
        isbn: book.isbn?.[0] || '',
        title: book.title,
        author: book.author_name?.[0] || 'Unknown Author',
        cover: book.cover_i 
          ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` 
          : undefined
      }))
      .slice(0, 10); // Limit to 10 results for better UX
  } catch (error) {
    console.error("Failed to search books:", error);
    return [];
  }
};

export const getBookByISBN = async (isbn: string): Promise<Book | null> => {
  try {
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    
    if (!response.ok) {
      throw new Error(`OpenLibrary API error: ${response.status}`);
    }
    
    const data = await response.json();
    const bookData = data[`ISBN:${isbn}`];
    
    if (!bookData) {
      throw new Error(`Book with ISBN ${isbn} not found`);
    }
    
    return {
      isbn,
      title: bookData.title,
      author: bookData.authors?.[0]?.name || 'Unknown Author',
      cover: bookData.cover?.medium
    };
  } catch (error) {
    console.error(`Failed to get book by ISBN ${isbn}:`, error);
    return null;
  }
};

export const getBooksByISBNs = async (isbns: string[]): Promise<Record<string, Book>> => {
  try {
    // Normalize ISBNs - remove hyphens and ensure they're clean
    const normalizedISBNs = isbns.map(isbn => isbn.replace(/[-\s]/g, '').trim());
    
    const bibkeys = normalizedISBNs.map(isbn => `ISBN:${isbn}`).join(',');
    console.log('OpenLibrary request with bibkeys:', bibkeys);
    
    const url = `https://openlibrary.org/api/books?bibkeys=${bibkeys}&format=json&jscmd=data`;
    console.log('OpenLibrary API URL:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OpenLibrary API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('OpenLibrary API response:', data);
    
    const result: Record<string, Book> = {};
    
    normalizedISBNs.forEach((isbn, index) => {
      const originalISBN = isbns[index]; // Keep the original ISBN for the result
      const bookData = data[`ISBN:${isbn}`];
      
      if (bookData) {
        // Try to get a cover URL from different sources
        let coverUrl = null;
        if (bookData.cover) {
          // Sort cover sizes by preference: medium, large, small
          if (bookData.cover.medium) {
            coverUrl = bookData.cover.medium;
          } else if (bookData.cover.large) {
            coverUrl = bookData.cover.large;
          } else if (bookData.cover.small) {
            coverUrl = bookData.cover.small;
          }
        }
        
        // If no cover found in the API response, try the direct cover URL
        if (!coverUrl) {
          // Use the OpenLibrary cover API as a fallback
          coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
        }
        
        console.log(`ISBN ${originalISBN} cover URL:`, coverUrl);
        
        result[originalISBN] = {
          isbn: originalISBN,
          title: bookData.title,
          author: bookData.authors?.[0]?.name || 'Unknown Author',
          cover: coverUrl
        };
      } else {
        console.log(`No data found for ISBN: ${originalISBN}`);
        
        // Even if we couldn't get book data, try to get a cover directly
        result[originalISBN] = {
          isbn: originalISBN,
          title: `Book ${originalISBN}`,
          author: 'Unknown Author',
          cover: `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`
        };
      }
    });
    
    return result;
  } catch (error) {
    console.error("Failed to get books by ISBNs:", error);
    return {};
  }
};
