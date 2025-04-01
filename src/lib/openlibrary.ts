
import { Book } from "./nostr";

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
    const bibkeys = isbns.map(isbn => `ISBN:${isbn}`).join(',');
    const response = await fetch(
      `https://openlibrary.org/api/books?bibkeys=${bibkeys}&format=json&jscmd=data`
    );
    
    if (!response.ok) {
      throw new Error(`OpenLibrary API error: ${response.status}`);
    }
    
    const data = await response.json();
    const result: Record<string, Book> = {};
    
    isbns.forEach(isbn => {
      const bookData = data[`ISBN:${isbn}`];
      if (bookData) {
        result[isbn] = {
          isbn,
          title: bookData.title,
          author: bookData.authors?.[0]?.name || 'Unknown Author',
          cover: bookData.cover?.medium
        };
      }
    });
    
    return result;
  } catch (error) {
    console.error("Failed to get books by ISBNs:", error);
    return {};
  }
};
