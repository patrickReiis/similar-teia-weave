
import { useState, useEffect } from "react";
import { Book } from "@/lib/nostr";
import { searchBooks } from "@/lib/openlibrary";
import { Input } from "@/components/ui/input";
import { BookCard } from "@/components/BookCard";
import { Skeleton } from "@/components/ui/skeleton";

interface BookSearchProps {
  onSelectBook: (book: Book) => void;
  placeholder?: string;
}

export function BookSearch({ onSelectBook, placeholder = "Search for a book..." }: BookSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous timeout
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    
    if (query.trim() === "") {
      setResults([]);
      return;
    }
    
    // Set loading state
    setIsLoading(true);
    
    // Set a new timeout
    const timeout = setTimeout(async () => {
      try {
        const books = await searchBooks(query);
        setResults(books);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsLoading(false);
      }
    }, 500);
    
    setDebounceTimeout(timeout);
    
    // Cleanup on unmount
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [query]);

  return (
    <div className="w-full">
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full"
      />
      
      {query.trim() !== "" && (
        <div className="mt-2 book-search-results rounded-md border bg-white">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="w-20 h-28 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-similarteia-muted">
              {query.length < 3
                ? "Type at least 3 characters to search"
                : "No results found"}
            </div>
          ) : (
            <div className="p-2">
              {results.map((book) => (
                <BookCard
                  key={book.isbn}
                  book={book}
                  onClick={() => {
                    onSelectBook(book);
                    setQuery("");
                    setResults([]);
                  }}
                  className="mb-2"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
