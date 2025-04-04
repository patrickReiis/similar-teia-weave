import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { getPublicKey, connectToRelay, RELAY_URL } from "@/lib/nostr";
import { toast } from "@/components/ui/use-toast";
import { usePrefetchUserProfiles } from "@/lib/userProfiles";

interface NostrContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  pubkey: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

const NostrContext = createContext<NostrContextType>({
  isLoading: true,
  isAuthenticated: false,
  pubkey: null,
  login: async () => {},
  logout: () => {},
});

export const useNostr = () => useContext(NostrContext);

export const NostrProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pubkey, setPubkey] = useState<string | null>(null);
  const prefetchProfiles = usePrefetchUserProfiles();

  // When pubkey changes and is not null, prefetch the user's profile
  useEffect(() => {
    if (pubkey) {
      console.log('Prefetching profile for current user:', pubkey);
      prefetchProfiles([pubkey]);
    }
  }, [pubkey, prefetchProfiles]);

  // Initial connection and authentication check
  useEffect(() => {
    // Try to connect to relay on mount
    connectToRelay().catch(error => {
      console.error("Failed to connect to relay:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to Nostr relay. Please try again later.",
        variant: "destructive",
      });
    });
    
    // Check if the user is already authenticated
    const checkAuth = async () => {
      try {
        // Check if window.nostr exists
        if (!window.nostr) {
          setIsLoading(false);
          return;
        }
        
        // Try to get the public key silently
        const key = await getPublicKey();
        if (key) {
          setPubkey(key);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Create stable login function
  const login = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Check if Nostr extension exists
      if (!window.nostr) {
        toast({
          title: "Nostr Extension Required",
          description: "Please install a Nostr browser extension to login.",
          variant: "destructive",
        });
        return;
      }
      
      // Get public key from extension
      const key = await getPublicKey();
      setPubkey(key);
      setIsAuthenticated(true);
      
      toast({
        title: "Login Successful",
        description: "You've successfully logged in with Nostr!",
      });
    } catch (error) {
      console.error("Login failed:", error);
      toast({
        title: "Login Failed",
        description: error instanceof Error ? error.message : "Failed to login with Nostr",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create stable logout function
  const logout = useCallback(() => {
    setPubkey(null);
    setIsAuthenticated(false);
    toast({
      title: "Logged Out",
      description: "You've been logged out successfully.",
    });
  }, []);

  return (
    <NostrContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        pubkey,
        login,
        logout,
      }}
    >
      {children}
    </NostrContext.Provider>
  );
};