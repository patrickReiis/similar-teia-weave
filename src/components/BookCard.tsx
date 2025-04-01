
import { Book } from "@/lib/nostr";
import { cn } from "@/lib/utils";

interface BookCardProps {
  book: Book;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

export function BookCard({ book, className, onClick, selected }: BookCardProps) {
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
          {book.cover ? (
            <img 
              src={book.cover} 
              alt={book.title} 
              className="w-20 h-28 object-cover rounded shadow" 
            />
          ) : (
            <div className="w-20 h-28 bg-muted flex items-center justify-center rounded shadow">
              <span className="text-xs text-muted-foreground">No Cover</span>
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-similarteia-dark truncate">
            {book.title}
          </h3>
          <p className="text-sm text-similarteia-muted truncate">
            {book.author}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            ISBN: {book.isbn}
          </p>
        </div>
      </div>
    </div>
  );
}
