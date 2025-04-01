
import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { SimilarityEventCard } from "@/components/SimilarityEventCard";
import { NostrEvent, SimilarityEvent, parseEventToSimilarity, SIMILARITY_EVENT_KIND, RELAY_URL, subscribeToEvents } from "@/lib/nostr";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";

const Explore = () => {
  const [events, setEvents] = useState<SimilarityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    
    const fetchEvents = async () => {
      try {
        console.log(`Connecting to relay: ${RELAY_URL}`);
        toast({
          title: "Connecting to Relay",
          description: `Attempting to connect to ${RELAY_URL}`,
        });
        
        const unsubscribe = await subscribeToEvents(
          { kinds: [SIMILARITY_EVENT_KIND] },
          (event: NostrEvent) => {
            console.log("Received event:", event);
            const similarityEvent = parseEventToSimilarity(event);
            if (similarityEvent) {
              console.log("Parsed similarity event:", similarityEvent);
              setEvents(prev => {
                // Check if we already have this event
                if (prev.some(e => e.id === similarityEvent.id)) {
                  return prev;
                }
                return [...prev, similarityEvent];
              });
            } else {
              console.warn("Failed to parse event as similarity event:", event);
            }
          }
        );
        
        // After 5 seconds, consider the initial load complete
        setTimeout(() => {
          setIsLoading(false);
          if (events.length === 0) {
            console.log("No events received after timeout");
            toast({
              title: "Relay Status",
              description: "Connected, but no similarity events found",
            });
          } else {
            console.log(`Found ${events.length} events`);
          }
        }, 5000);
        
        return () => {
          console.log("Unsubscribing from events");
          unsubscribe();
        };
      } catch (error) {
        console.error("Failed to fetch events:", error);
        toast({
          title: "Connection Error",
          description: `Failed to connect to relay: ${error instanceof Error ? error.message : "Unknown error"}`,
          variant: "destructive",
        });
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
