
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
        const fetchedBooks = await getBooksByISBNs(isbns);
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
            <div className="flex gap-4 mb-4">
              <div className="flex-shrink-0">
                {book1.cover ? (
                  <img
                    src={book1.cover}
                    alt={book1.title}
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
                  {book1.title}
                </h3>
                <p className="text-sm text-similarteia-muted truncate">
                  {book1.author}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ISBN: {book1.isbn}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <div className="relative h-2 bg-gray-200 rounded-full my-4">
                <div
                  className="absolute h-2 bg-similarteia-accent rounded-full"
                  style={{ width: similarityBarWidth }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0% Similar</span>
                <span>{Math.round(event.similarity * 100)}% Similar</span>
                <span>100% Similar</span>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                {book2.cover ? (
                  <img
                    src={book2.cover}
                    alt={book2.title}
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
                  {book2.title}
                </h3>
                <p className="text-sm text-similarteia-muted truncate">
                  {book2.author}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ISBN: {book2.isbn}
                </p>
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
