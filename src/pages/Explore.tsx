
import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { SimilarityEventCard } from "@/components/SimilarityEventCard";
import { NostrEvent, SimilarityEvent, parseEventToSimilarity, SIMILARITY_EVENT_KIND, subscribeToEvents } from "@/lib/nostr";
import { Skeleton } from "@/components/ui/skeleton";

const Explore = () => {
  const [events, setEvents] = useState<SimilarityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    
    const fetchEvents = async () => {
      try {
        const unsubscribe = await subscribeToEvents(
          { kinds: [SIMILARITY_EVENT_KIND] },
          (event: NostrEvent) => {
            const similarityEvent = parseEventToSimilarity(event);
            if (similarityEvent) {
              setEvents(prev => {
                // Check if we already have this event
                if (prev.some(e => e.id === similarityEvent.id)) {
                  return prev;
                }
                return [...prev, similarityEvent];
              });
            }
          }
        );
        
        // After 5 seconds, consider the initial load complete
        setTimeout(() => {
          setIsLoading(false);
        }, 5000);
        
        return () => {
          unsubscribe();
        };
      } catch (error) {
        console.error("Failed to fetch events:", error);
        setIsLoading(false);
      }
    };
    
    fetchEvents();
  }, []);

  // Sort events by creation time
  const sortedEvents = [...events].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-similarteia-dark">
          Explore Book Similarities
        </h1>
        
        <p className="text-lg text-similarteia-muted mb-8">
          Discover connections between books created by users in the SimilarTeia community.
        </p>
        
        <div className="space-y-6">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-64" />
            ))
          ) : sortedEvents.length === 0 ? (
            <div className="bg-white p-8 rounded-lg text-center">
              <h2 className="text-xl font-medium mb-2 text-similarteia-dark">No similarities found</h2>
              <p className="text-similarteia-muted">
                Be the first to create a book similarity connection!
              </p>
            </div>
          ) : (
            sortedEvents.map((event) => (
              <SimilarityEventCard key={event.id} event={event} />
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Explore;
