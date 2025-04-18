import { useEffect, useState, useCallback } from "react";
import { SimilarityEvent, Book } from "@/lib/nostr";
import { getBooksByISBNs } from "@/lib/openlibrary";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { UserAvatar, UserName } from "./UserAvatar";
import { BookCover } from "./BookCover";
import { usePrefetchUserProfiles } from "@/lib/userProfiles";

interface SimilarityEventCardProps {
  event: SimilarityEvent;
}

export function SimilarityEventCard({ event }: SimilarityEventCardProps) {
  const [books, setBooks] = useState<Record<string, Book>>({});
  const [isLoading, setIsLoading] = useState(true);
  const prefetchProfiles = usePrefetchUserProfiles();
  
  // Prefetch the user profile when component mounts
  // Using a separate effect with fewer dependencies to avoid unnecessary re-runs
  useEffect(() => {
    if (event?.pubkey) {
      prefetchProfiles([event.pubkey]);
    }
  }, [event?.pubkey, prefetchProfiles]);

  // Books fetch effect kept separate to avoid mixing concerns
  const fetchBooks = useCallback(async (isbns: string[]) => {
    try {
      setIsLoading(true);
      console.log('Fetching books for ISBNs:', isbns);
      const fetchedBooks = await getBooksByISBNs(isbns);
      console.log('Fetched books:', fetchedBooks);
      setBooks(fetchedBooks);
    } catch (error) {
      console.error("Failed to fetch books:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if (event?.book1?.isbn && event?.book2?.isbn) {
      fetchBooks([event.book1.isbn, event.book2.isbn]);
    }
  }, [event?.book1?.isbn, event?.book2?.isbn, fetchBooks]);

  // Get books from state or fallback to event data
  const book1 = books[event.book1.isbn] || event.book1;
  const book2 = books[event.book2.isbn] || event.book2;

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Calculate the width of the similarity bar
  const similarityBarWidth = `${event.similarity * 100}%`;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm">
            <UserAvatar pubkey={event.pubkey} size="sm" />
            <UserName pubkey={event.pubkey} className="font-medium" />
          </div>
          <div className="text-sm text-muted-foreground">
            {formatDate(event.createdAt)}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        {isLoading ? (
          <div className="space-y-4">
            <div className="flex gap-4">
              <Skeleton className="w-20 h-28 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
            
            <div className="flex gap-4">
              <Skeleton className="w-20 h-28 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-4 mb-4 relative">
              <div className="flex-shrink-0">
                <BookCover book={book1} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-similarteia-dark truncate">
                  {book1.title}
                </h3>
                <p className="text-sm text-similarteia-muted truncate">
                  {book1.author}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ISBN: {book1.isbn}
                </p>
              </div>
              
              {/* Add a visual connector between books */}
              <div className="absolute -bottom-3 left-10 right-10 flex justify-center pointer-events-none opacity-70">
                <svg height="10" width="100%" className="text-gray-300">
                  <line x1="0" y1="5" x2="100%" y2="5" stroke="currentColor" strokeWidth="1" strokeDasharray="4" />
                </svg>
              </div>
            </div>

            <div className="mb-6 mt-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted-foreground">0%</span>
                <div className="flex flex-col items-center">
                  <div className={`${
                    event.similarity < 0.3 
                      ? 'bg-white border-blue-400 text-blue-500' 
                      : event.similarity < 0.7 
                        ? 'bg-white border-purple-500 text-purple-600'
                        : 'bg-white border-similarteia-accent text-similarteia-accent'
                  } shadow-md rounded-full px-4 py-1 border mb-1 transition-all hover:shadow-lg`}>
                    <span className="font-medium">
                      {Math.round(event.similarity * 100)}% Similarity
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground italic">
                    {event.similarity < 0.3 
                      ? 'Slightly Similar'
                      : event.similarity < 0.5
                        ? 'Moderately Similar'
                        : event.similarity < 0.7
                          ? 'Quite Similar'
                          : event.similarity < 0.9
                            ? 'Very Similar'
                            : 'Extremely Similar'
                    }
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">100%</span>
              </div>
              
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                <div
                  className="absolute h-full transition-all duration-1000 ease-out"
                  style={{ 
                    width: similarityBarWidth,
                    background: event.similarity < 0.3
                      ? 'linear-gradient(90deg, rgba(96,165,250,0.5) 0%, rgba(96,165,250,1) 100%)'
                      : event.similarity < 0.7
                        ? 'linear-gradient(90deg, rgba(145,115,220,0.5) 0%, rgba(145,115,220,1) 100%)'
                        : 'linear-gradient(90deg, rgba(155,135,245,0.5) 0%, rgba(155,135,245,1) 100%)',
                    boxShadow: event.similarity < 0.3
                      ? '0 0 8px rgba(96,165,250,0.6)'
                      : event.similarity < 0.7
                        ? '0 0 8px rgba(145,115,220,0.6)'
                        : '0 0 8px rgba(155,135,245,0.6)'
                  }}
                />
              </div>
            </div>
            
            <div className="flex gap-4 relative">
              <div className="flex-shrink-0">
                <BookCover book={book2} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-similarteia-dark truncate">
                  {book2.title}
                </h3>
                <p className="text-sm text-similarteia-muted truncate">
                  {book2.author}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ISBN: {book2.isbn}
                </p>
              </div>
              
              {/* Add a visual connector between books */}
              <div className="absolute -top-3 left-10 right-10 flex justify-center pointer-events-none opacity-70">
                <svg height="10" width="100%" className="text-gray-300">
                  <line x1="0" y1="5" x2="100%" y2="5" stroke="currentColor" strokeWidth="1" strokeDasharray="4" />
                </svg>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="text-sm">
              {event.content || "No additional details provided."}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}