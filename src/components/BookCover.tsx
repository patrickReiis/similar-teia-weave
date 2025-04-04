import { Book } from "@/lib/nostr";
import { ImageWithFallback } from "./ui/image-with-fallback";

interface BookCoverProps {
  book: Book;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Reusable component for displaying book covers with fallbacks and consistent styling
 */
export function BookCover({ book, size = 'md', className = '' }: BookCoverProps) {
  // Size mappings
  const sizeMappings = {
    sm: 'w-16 h-24',
    md: 'w-20 h-28',
    lg: 'w-28 h-40'
  };
  
  const sizeClass = sizeMappings[size] || sizeMappings.md;
  
  if (!book) return null;
  
  return (
    book.cover ? (
      <ImageWithFallback
        src={book.cover}
        alt={book.title}
        fallbackUrls={book.fallbackCoverUrls}
        className={`${sizeClass} object-cover rounded shadow-md hover:shadow-lg transition-all ${className}`}
        loading="eager"
        fallbackComponent={
          <div className={`${sizeClass} bg-muted flex items-center justify-center rounded shadow ${className}`}>
            <span className="text-xs text-muted-foreground text-center px-1">No Cover</span>
          </div>
        }
      />
    ) : (
      <div className={`${sizeClass} bg-muted flex items-center justify-center rounded shadow ${className}`}>
        <span className="text-xs text-muted-foreground text-center px-1">No Cover</span>
      </div>
    )
  );
}