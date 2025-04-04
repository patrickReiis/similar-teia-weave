import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { NostrEvent, RELAY_URL, generateShortId } from '@/lib/nostr';
import { useCallback } from 'react';

// Constants for Nostr kinds
export const NOSTR_KINDS = {
  SET_METADATA: 0,
  TEXT_NOTE: 1
};

// Types for Nostr user metadata
export interface NostrUserMetadata {
  name?: string;
  displayName?: string;
  picture?: string;
  banner?: string;
  about?: string;
  website?: string;
  nip05?: string;
  lud16?: string;
  [key: string]: any; // For any additional fields
}

export interface UserProfile {
  pubkey: string;
  metadata: NostrUserMetadata;
  loaded: boolean;
  createdAt?: number;
  raw?: string; // Raw JSON content
}

// Constants
const PROFILE_CACHE_TIME = 1000 * 60 * 60 * 24; // 24 hours
const PROFILE_CACHE = new Map<string, { profile: UserProfile, timestamp: number }>();
const BATCH_SIZE = 10; // Number of profiles to fetch in a single batch query

/**
 * Prefetch a user profile (for direct use outside of hooks)
 */
export function prefetchUserProfile(queryClient: QueryClient, pubkey: string): void {
  if (!pubkey) return;
  
  queryClient.prefetchQuery({
    queryKey: ['userProfile', pubkey],
    queryFn: () => fetchUserProfile(pubkey),
    staleTime: PROFILE_CACHE_TIME
  });
}

/**
 * Parse profile content from a Nostr kind 0 event
 */
function parseProfileContent(content: string): NostrUserMetadata {
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error("Error parsing profile content:", error);
    return {};
  }
}

/**
* Fetches a single user profile
*/
export async function fetchUserProfile(pubkey: string): Promise<UserProfile> {
  console.log(`Fetching profile for ${pubkey.slice(0, 6)}... from ${RELAY_URL}`);
  
  // Check memory cache first
  const cacheKey = `${pubkey}`;
  const now = Date.now();
  const cached = PROFILE_CACHE.get(cacheKey);
  if (cached && (now - cached.timestamp < PROFILE_CACHE_TIME)) {
    console.log(`Using cached profile for ${pubkey.slice(0, 6)}...`);
    return cached.profile;
  }
  
  try {
    // Create WebSocket connection
    const socket = new WebSocket(RELAY_URL);
    
    // Promise that will resolve once we get profile data
    const profilePromise = new Promise<UserProfile>((resolve, reject) => {
      // Set timeout to ensure we don't hang indefinitely
      const timeoutId = setTimeout(() => {
        console.log(`Timeout fetching profile for ${pubkey.slice(0, 6)}...`);
        socket.close();
        
        // Return a minimal profile on timeout
        const emptyProfile = {
          pubkey,
          metadata: {},
          loaded: false
        };
        
        PROFILE_CACHE.set(cacheKey, { profile: emptyProfile, timestamp: now });
        resolve(emptyProfile);
      }, 10000);
      
      // Setup event handlers
      socket.onopen = () => {
        console.log(`WebSocket opened to ${RELAY_URL}`);
        
        // Create a short subscription ID for this request
        const subscriptionId = generateShortId("p");
        
        // This is the correct filter format for Nostr kind 0 events (profiles)
        const filter = {
          kinds: [NOSTR_KINDS.SET_METADATA],
          authors: [pubkey]
        };
        
        const requestMessage = JSON.stringify(["REQ", subscriptionId, filter]);
        console.log(`Sending subscription request with ID ${subscriptionId}`);
        socket.send(requestMessage);
      };
      
      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          
          // Check for error notices from relays
          if (Array.isArray(data) && data[0] === "NOTICE") {
            console.warn(`Relay notice: ${data[1]}`);
          }
          
          // Check if this is an EVENT message
          if (Array.isArray(data) && data[0] === "EVENT") {
            console.log(`Received EVENT message`);
            const event = data[2] as NostrEvent;
            
            // Verify this is from the correct user and is a profile event
            if (event.pubkey === pubkey && event.kind === NOSTR_KINDS.SET_METADATA) {
              console.log(`Valid profile event received`);
              clearTimeout(timeoutId);
              
              // Parse profile content
              const metadata = parseProfileContent(event.content);
              console.log(`Parsed profile: name=${metadata.name}, has picture: ${!!metadata.picture}`);
              
              // Create profile object
              const profile: UserProfile = {
                pubkey,
                metadata,
                loaded: true,
                createdAt: event.created_at,
                raw: event.content
              };
              
              // Save to cache
              PROFILE_CACHE.set(cacheKey, { profile, timestamp: now });
              
              // Close socket and resolve
              socket.close();
              console.log(`Successfully fetched and cached profile`);
              resolve(profile);
            }
          }
          
          // If we receive EOSE (End of Stored Events)
          if (Array.isArray(data) && data[0] === "EOSE") {
            console.log(`Received EOSE - no profile events found for ${pubkey.slice(0, 6)}...`);
            clearTimeout(timeoutId);
            socket.close();
            
            // If we get here without finding a profile, we didn't find any profile
            const emptyProfile = {
              pubkey,
              metadata: {},
              loaded: true // Mark as loaded since we know there's no profile
            };
            
            PROFILE_CACHE.set(cacheKey, { profile: emptyProfile, timestamp: now });
            resolve(emptyProfile);
          }
        } catch (error) {
          console.error(`Error processing profile message:`, error);
        }
      };
      
      socket.onerror = (error) => {
        console.error(`WebSocket error fetching profile:`, error);
        clearTimeout(timeoutId);
        socket.close();
        
        // Return empty profile on error
        const emptyProfile = {
          pubkey,
          metadata: {},
          loaded: false
        };
        
        PROFILE_CACHE.set(cacheKey, { profile: emptyProfile, timestamp: now });
        resolve(emptyProfile);
      };
      
      socket.onclose = () => {
        console.log(`WebSocket connection closed`);
        clearTimeout(timeoutId);
      };
    });
    
    return await profilePromise;
  } catch (error) {
    console.error(`Error in fetchUserProfile:`, error);
    
    // Return empty profile on any error
    const emptyProfile = {
      pubkey,
      metadata: {},
      loaded: false
    };
    
    PROFILE_CACHE.set(cacheKey, { profile: emptyProfile, timestamp: now });
    return emptyProfile;
  }
}

/**
 * Batch fetch multiple user profiles at once
 * This is more efficient when loading many profiles
 */
export async function batchFetchUserProfiles(pubkeys: string[]): Promise<Map<string, UserProfile>> {
  if (!pubkeys.length) return new Map();
  
  console.log(`Batch fetching ${pubkeys.length} profiles`);
  
  // Remove duplicates
  const uniquePubkeys = [...new Set(pubkeys)];
  console.log(`Removed duplicates. Fetching ${uniquePubkeys.length} unique profiles`);
  
  const result = new Map<string, UserProfile>();
  const pubkeysToFetch: string[] = [];
  
  // Check cache first
  const now = Date.now();
  uniquePubkeys.forEach(pubkey => {
    const cached = PROFILE_CACHE.get(pubkey);
    if (cached && (now - cached.timestamp < PROFILE_CACHE_TIME)) {
      console.log(`Using cached profile for ${pubkey.slice(0, 6)}...`);
      result.set(pubkey, cached.profile);
    } else {
      pubkeysToFetch.push(pubkey);
    }
  });
  
  // If all profiles were in cache, return immediately
  if (pubkeysToFetch.length === 0) {
    console.log(`All profiles found in cache`);
    return result;
  }
  
  console.log(`Fetching ${pubkeysToFetch.length} profiles from relay`);
  
  // Process in batches to avoid too many authors in a single query
  for (let i = 0; i < pubkeysToFetch.length; i += BATCH_SIZE) {
    const batchPubkeys = pubkeysToFetch.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${i / BATCH_SIZE + 1}: ${batchPubkeys.length} profiles`);
    
    try {
      // Create WebSocket connection
      const socket = new WebSocket(RELAY_URL);
      
      // Promise for this batch
      const batchPromise = new Promise<void>((resolve) => {
        // Track which profiles we've received
        const receivedProfiles = new Set<string>();
        
        // Timeout for the whole batch
        const timeoutId = setTimeout(() => {
          console.log(`Batch timeout for ${batchPubkeys.length} profiles`);
          
          // Create empty profiles for all pubkeys we didn't receive
          batchPubkeys.forEach(pubkey => {
            if (!receivedProfiles.has(pubkey)) {
              console.log(`No profile received for ${pubkey.slice(0, 6)}... before timeout`);
              const emptyProfile = {
                pubkey,
                metadata: {},
                loaded: false
              };
              
              result.set(pubkey, emptyProfile);
              PROFILE_CACHE.set(pubkey, { profile: emptyProfile, timestamp: now });
            }
          });
          
          socket.close();
          resolve();
        }, 10000);
        
        // Setup event handlers
        socket.onopen = () => {
          console.log(`WebSocket opened for batch of ${batchPubkeys.length} profiles`);
          
          // Create a short subscription for this batch
          const subscriptionId = generateShortId("b");
          
          // This is the correct filter format for Nostr kind 0 events (profiles)
          const filter = {
            kinds: [NOSTR_KINDS.SET_METADATA],
            authors: batchPubkeys
          };
          
          const requestMessage = JSON.stringify(["REQ", subscriptionId, filter]);
          console.log(`Sending batch subscription request with id ${subscriptionId}`);
          socket.send(requestMessage);
        };
        
        socket.onmessage = (message) => {
          try {
            const data = JSON.parse(message.data);
            
            // Check for error notices from relays
            if (Array.isArray(data) && data[0] === "NOTICE") {
              console.warn(`Relay notice: ${data[1]}`);
            }
            
            // Check if this is an EVENT message
            if (Array.isArray(data) && data[0] === "EVENT") {
              console.log(`Received EVENT message in batch`);
              const event = data[2] as NostrEvent;
              
              // Check if this event is a profile and from one of our requested pubkeys
              if (event.kind === NOSTR_KINDS.SET_METADATA && batchPubkeys.includes(event.pubkey)) {
                console.log(`Valid profile event for ${event.pubkey.slice(0, 6)}...`);
                
                // Parse profile content
                const metadata = parseProfileContent(event.content);
                console.log(`Parsed profile for ${event.pubkey.slice(0, 6)}: name=${metadata.name}, has picture: ${!!metadata.picture}`);
                
                // Create profile object
                const profile: UserProfile = {
                  pubkey: event.pubkey,
                  metadata,
                  loaded: true,
                  createdAt: event.created_at,
                  raw: event.content
                };
                
                // Save to result and cache
                result.set(event.pubkey, profile);
                PROFILE_CACHE.set(event.pubkey, { profile, timestamp: now });
                
                // Mark as received
                receivedProfiles.add(event.pubkey);
                
                // If we've received all profiles, resolve early
                if (receivedProfiles.size === batchPubkeys.length) {
                  console.log(`All ${batchPubkeys.length} profiles received, resolving early`);
                  clearTimeout(timeoutId);
                  socket.close();
                  resolve();
                }
              }
            }
            
            // If we receive EOSE (End of Stored Events)
            if (Array.isArray(data) && data[0] === "EOSE") {
              console.log(`Received EOSE - found ${receivedProfiles.size} of ${batchPubkeys.length} profiles`);
              
              // Create empty profiles for any pubkeys we didn't receive
              batchPubkeys.forEach(pubkey => {
                if (!receivedProfiles.has(pubkey)) {
                  console.log(`Creating empty profile for ${pubkey.slice(0, 6)}... (not found)`);
                  const emptyProfile = {
                    pubkey,
                    metadata: {},
                    loaded: true // Mark as loaded since we know there's no profile
                  };
                  
                  result.set(pubkey, emptyProfile);
                  PROFILE_CACHE.set(pubkey, { profile: emptyProfile, timestamp: now });
                }
              });
              
              clearTimeout(timeoutId);
              socket.close();
              resolve();
            }
          } catch (error) {
            console.error("Error processing batch profile message:", error);
          }
        };
        
        socket.onerror = () => {
          console.error(`WebSocket error in batch profile fetch`);
          clearTimeout(timeoutId);
          
          // Create empty profiles for any pubkeys we didn't receive
          batchPubkeys.forEach(pubkey => {
            if (!receivedProfiles.has(pubkey)) {
              const emptyProfile = {
                pubkey,
                metadata: {},
                loaded: false
              };
              
              result.set(pubkey, emptyProfile);
              PROFILE_CACHE.set(pubkey, { profile: emptyProfile, timestamp: now });
            }
          });
          
          socket.close();
          resolve();
        };
        
        socket.onclose = () => {
          console.log(`WebSocket connection closed for batch`);
          clearTimeout(timeoutId);
          resolve();
        };
      });
      
      await batchPromise;
    } catch (error) {
      console.error("Error in batch profile fetch:", error);
      
      // Handle error by creating empty profiles
      batchPubkeys.forEach(pubkey => {
        if (!result.has(pubkey)) {
          console.log(`Creating error fallback profile for ${pubkey.slice(0, 6)}...`);
          const emptyProfile = {
            pubkey,
            metadata: {},
            loaded: false
          };
          
          result.set(pubkey, emptyProfile);
          PROFILE_CACHE.set(pubkey, { profile: emptyProfile, timestamp: now });
        }
      });
    }
  }
  
  return result;
}

/**
 * React Query hook for fetching and caching user profiles
 */
export function useUserProfile(pubkey: string | null) {
  return useQuery({
    queryKey: ['userProfile', pubkey],
    queryFn: () => pubkey ? fetchUserProfile(pubkey) : Promise.resolve({ pubkey: '', metadata: {}, loaded: false }),
    enabled: !!pubkey,
    staleTime: PROFILE_CACHE_TIME,
    cacheTime: PROFILE_CACHE_TIME,
  });
}

/**
 * Format a public key for display (shortens the key)
 */
export function formatPubkey(pubkey: string): string {
  if (!pubkey) return '';
  return `${pubkey.substring(0, 6)}...${pubkey.substring(pubkey.length - 4)}`;
}

/**
 * Hook to prefetch multiple user profiles with a stable reference
 */
export function usePrefetchUserProfiles() {
  const queryClient = useQueryClient();
  
  // Use useCallback to ensure the function reference is stable
  return useCallback(async (pubkeys: string[]) => {
    if (!pubkeys.length) return;
    
    // Filter out empty pubkeys and unique them
    const uniquePubkeys = [...new Set(pubkeys.filter(pk => !!pk))];
    console.log(`Prefetching ${uniquePubkeys.length} profiles`);
    
    if (uniquePubkeys.length <= 3) {
      // For small numbers of pubkeys, fetch individually
      uniquePubkeys.forEach(pubkey => {
        console.log(`Individual prefetch for ${pubkey.slice(0, 6)}...`);
        prefetchUserProfile(queryClient, pubkey);
      });
    } else {
      // For larger batches, use the more efficient batch fetch
      console.log(`Batch prefetching ${uniquePubkeys.length} profiles`);
      try {
        const profilesMap = await batchFetchUserProfiles(uniquePubkeys);
        
        // Update React Query cache for each profile
        profilesMap.forEach((profile, pubkey) => {
          queryClient.setQueryData(['userProfile', pubkey], profile);
        });
      } catch (error) {
        console.error("Error prefetching profiles:", error);
      }
    }
  }, [queryClient]);
}