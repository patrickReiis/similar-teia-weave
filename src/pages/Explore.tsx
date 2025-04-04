import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { SimilarityEventCard } from "@/components/SimilarityEventCard";
import { NostrEvent, SimilarityEvent, parseEventToSimilarity, SIMILARITY_EVENT_KIND, RELAY_URL, subscribeToEvents } from "@/lib/nostr";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { usePrefetchUserProfiles } from "@/lib/userProfiles";

const Explore = () => {
  const [events, setEvents] = useState<SimilarityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [unsubscribeFn, setUnsubscribeFn] = useState<(() => void) | null>(null);
  const hasReceivedEvents = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prefetchProfiles = usePrefetchUserProfiles();

  // Only run this effect when events array changes length
  const eventCount = events.length;
  useEffect(() => {
    if (eventCount > 0) {
      const authorPubkeys = events.map(event => event.pubkey);
      prefetchProfiles(authorPubkeys);
    }
  }, [eventCount, prefetchProfiles]);

  const fetchEvents = useCallback(async () => {
    // Clean up previous subscription if it exists
    if (unsubscribeFn) {
      unsubscribeFn();
      setUnsubscribeFn(null);
    }
    
    // Clean up previous timeout if exists
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    
    setIsLoading(true);
    setIsRetrying(true);
    hasReceivedEvents.current = false;
    
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
            hasReceivedEvents.current = true;
            
            // Since we're going to use similarityEvent,
            // prefetch the profile immediately
            if (similarityEvent.pubkey) {
              prefetchProfiles([similarityEvent.pubkey]);
            }
            
            setEvents(prev => {
              // Check if we already have this event
              if (prev.some(e => e.id === similarityEvent.id)) {
                return prev;
              }
              return [...prev, similarityEvent];
            });
            
            // Stop loading immediately after receiving the first event
            setIsLoading(false);
            setIsRetrying(false);
          } else {
            console.warn("Failed to parse event as similarity event:", event);
          }
        }
      );
      
      setUnsubscribeFn(() => unsubscribe);
      
      // Set a timeout to stop the loading state even if no events are received
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        setIsRetrying(false);
        
        if (!hasReceivedEvents.current) {
          console.log("No events received after timeout");
          toast({
            title: "Relay Status",
            description: "Connected, but no similarity events found",
          });
        } else {
          // Use a callback to get the latest events length
          setEvents(currentEvents => {
            console.log(`Found ${currentEvents.length} events`);
            return currentEvents;
          });
        }
      }, 5000);
      
    } catch (error) {
      console.error("Failed to fetch events:", error);
      toast({
        title: "Connection Error",
        description: `Failed to connect to relay: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [prefetchProfiles]); 
  
  // Initial fetch - runs once due to empty dependency array
  useEffect(() => {
    fetchEvents();
    
    // Cleanup function
    return () => {
      if (unsubscribeFn) {
        console.log("Unsubscribing from events");
        unsubscribeFn();
      }
      
      // Clean up timeout on unmount
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [fetchEvents]);

  // Sort events by creation time
  const sortedEvents = [...events].sort((a, b) => b.createdAt - a.createdAt);

  const handleRetry = () => {
    setEvents([]);
    fetchEvents();
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-similarteia-dark">
            Explore Book Similarities
          </h1>
          
          <Button 
            onClick={handleRetry} 
            variant="outline"
            disabled={isRetrying}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Connecting...' : 'Refresh'}
          </Button>
        </div>
        
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
              <p className="text-similarteia-muted mb-4">
                Be the first to create a book similarity connection or try refreshing!
              </p>
              <Button onClick={handleRetry} className="mt-2">
                Try Again
              </Button>
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