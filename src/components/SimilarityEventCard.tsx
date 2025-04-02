
import { useEffect, useState } from "react";
import { SimilarityEvent, Book } from "@/lib/nostr";
import { getBooksByISBNs } from "@/lib/openlibrary";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

interface SimilarityEventCardProps {
  event: SimilarityEvent;
}

export function SimilarityEventCard({ event }: SimilarityEventCardProps) {
  const [books, setBooks] = useState<Record<string, Book>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setIsLoading(true);
        const isbns = [event.book1.isbn, event.book2.isbn];
        console.log('Fetching books for ISBNs:', isbns);
        const fetchedBooks = await getBooksByISBNs(isbns);
        console.log('Fetched books:', fetchedBooks);
        setBooks(fetchedBooks);
      } catch (error) {
        console.error("Failed to fetch books:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooks();
  }, [event]);

  const book1 = books[event.book1.isbn] || event.book1;
  const book2 = books[event.book2.isbn] || event.book2;
  
  console.log('Book 1 display data:', book1);
  console.log('Book 2 display data:', book2);
  
  // Function to truncate pubkey for display
  const formatPubkey = (pubkey: string) => {
    return `${pubkey.substring(0, 6)}...${pubkey.substring(pubkey.length - 4)}`;
  };

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
          <div className="text-sm text-muted-foreground">
            By {formatPubkey(event.pubkey)}
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
                {book1.cover ? (
                  <img
                    src={book1.cover}
                    alt={book1.title}
                    className="w-20 h-28 object-cover rounded shadow-md hover:shadow-lg transition-all"
                    loading="eager"
                    onError={(e) => {
                      console.log('Image failed to load:', e.currentTarget.src);
                      
                      // Get the original URL to avoid infinite retries
                      const originalSrc = e.currentTarget.src;
                      
                      // Try another path format for OpenLibrary covers if this isn't already that format
                      if (!originalSrc.includes('/covers/b/isbn/')) {
                        // Try the direct ISBN cover endpoint
                        const cleanIsbn = book1.isbn.replace(/[-\s]/g, '').trim();
                        const newSrc = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg`;
                        console.log(`Trying alternate cover URL: ${newSrc}`);
                        e.currentTarget.src = newSrc;
                        
                        // If this one fails too, show the fallback
                        e.currentTarget.onerror = () => {
                          console.log('Alternate image URL failed too, showing fallback');
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement.innerHTML = `
                            <div class="w-20 h-28 bg-muted flex items-center justify-center rounded shadow">
                              <span class="text-xs text-muted-foreground">No Cover</span>
                            </div>
                          `;
                        };
                      } else {
                        // We're already using the direct ISBN fallback, show the no-cover element
                        console.log('Already using ISBN fallback, showing no-cover element');
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement.innerHTML = `
                          <div class="w-20 h-28 bg-muted flex items-center justify-center rounded shadow">
                            <span class="text-xs text-muted-foreground">No Cover</span>
                          </div>
                        `;
                      }
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
                {book2.cover ? (
                  <img
                    src={book2.cover}
                    alt={book2.title}
                    className="w-20 h-28 object-cover rounded shadow-md hover:shadow-lg transition-all"
                    loading="eager"
                    onError={(e) => {
                      console.log('Image failed to load:', e.currentTarget.src);
                      
                      // Get the original URL to avoid infinite retries
                      const originalSrc = e.currentTarget.src;
                      
                      // Try another path format for OpenLibrary covers if this isn't already that format
                      if (!originalSrc.includes('/covers/b/isbn/')) {
                        // Try the direct ISBN cover endpoint
                        const cleanIsbn = book2.isbn.replace(/[-\s]/g, '').trim();
                        const newSrc = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg`;
                        console.log(`Trying alternate cover URL: ${newSrc}`);
                        e.currentTarget.src = newSrc;
                        
                        // If this one fails too, show the fallback
                        e.currentTarget.onerror = () => {
                          console.log('Alternate image URL failed too, showing fallback');
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement.innerHTML = `
                            <div class="w-20 h-28 bg-muted flex items-center justify-center rounded shadow">
                              <span class="text-xs text-muted-foreground">No Cover</span>
                            </div>
                          `;
                        };
                      } else {
                        // We're already using the direct ISBN fallback, show the no-cover element
                        console.log('Already using ISBN fallback, showing no-cover element');
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement.innerHTML = `
                          <div class="w-20 h-28 bg-muted flex items-center justify-center rounded shadow">
                            <span class="text-xs text-muted-foreground">No Cover</span>
                          </div>
                        `;
                      }
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
