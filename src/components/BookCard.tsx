
import { Book } from "@/lib/nostr";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface BookCardProps {
  book: Book;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

export function BookCard({ book, className, onClick, selected }: BookCardProps) {
  // Track the current book state for dynamic updates
  const [currentBook, setCurrentBook] = useState<Book>(book);
  
  // Update the local state when the book is updated from background operations
  useEffect(() => {
    // Create a shallow copy of the book to monitor for changes
    const checkForUpdates = () => {
      if (book.cover !== currentBook.cover ||
          book.author !== currentBook.author) {
        console.log(`Book updated: ${book.title}`);
        setCurrentBook({ ...book });
      }
    };
    
    // Initial check
    checkForUpdates();
    
    // Set up interval to check for updates (every second)
    const intervalId = setInterval(checkForUpdates, 1000);
    
    // Cleanup interval
    return () => clearInterval(intervalId);
  }, [book, currentBook]);
  
  return (
    <div 
      className={cn(
        "p-4 rounded-lg border transition-colors cursor-pointer",
        selected 
          ? "border-similarteia-accent bg-similarteia-accent/5" 
          : "border-border bg-white hover:border-similarteia-accent/50",
        className
      )}
      onClick={onClick}
    >
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          {currentBook.cover ? (
            <img 
              src={currentBook.cover} 
              alt={currentBook.title} 
              className="w-20 h-28 object-cover rounded shadow"
              loading="eager"
              onError={(e) => {
                console.log(`Image failed to load for book ${currentBook.title}:`, e.currentTarget.src);
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement.innerHTML = `
                  <div class="w-20 h-28 bg-muted flex items-center justify-center rounded shadow">
                    <span class="text-xs text-muted-foreground">No Cover</span>
                  </div>
                `;
              }} 
            />
          ) : (
            <div className="w-20 h-28 bg-muted flex items-center justify-center rounded shadow">
              <span className="text-xs text-muted-foreground">No Cover</span>
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-similarteia-dark truncate">
            {currentBook.title}
          </h3>
          <p className="text-sm text-similarteia-muted truncate">
            {currentBook.author}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="text-green-600">ISBN: {currentBook.isbn}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
