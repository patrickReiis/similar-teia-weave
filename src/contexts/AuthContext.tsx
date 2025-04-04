import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";
import { usePrefetchUserProfiles } from "@/lib/userProfiles";
import { 
  initAuth, 
  logout as authLogout, 
  loginWithExtension, 
  loginWithPrivateKey, 
  loginWithPublicKey, 
  isLoggedIn, 
  getCurrentUser,
  canSignEvents,
  type User
} from "@/lib/auth";
import { connectToRelay } from "@/lib/nostr";

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  canSign: boolean;
  loginWithExtension: () => Promise<void>;
  loginWithNsec: (nsec: string) => Promise<void>;
  loginWithNpub: (npub: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isLoading: true,
  isAuthenticated: false,
  user: null,
  canSign: false,
  loginWithExtension: async () => {},
  loginWithNsec: async () => {},
  loginWithNpub: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const prefetchProfiles = usePrefetchUserProfiles();

  // When user changes and is not null, prefetch the user's profile
  useEffect(() => {
    if (user?.pubkey) {
      console.log('Prefetching profile for current user:', user.pubkey);
      prefetchProfiles([user.pubkey]);
    }
  }, [user?.pubkey, prefetchProfiles]);

  // Initialize auth on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        // Initialize auth system
        const user = initAuth();
        
        if (user) {
          setUser(user);
          
          // Try to connect to relay
          connectToRelay().catch(error => {
            console.error("Failed to connect to relay:", error);
            toast({
              title: "Connection Error",
              description: "Failed to connect to Nostr relay. Some features may not work.",
              variant: "destructive",
            });
          });
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        toast({
          title: "Authentication Error",
          description: "Failed to initialize authentication. Please try logging in again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeAuth();
  }, []);

  const handleLoginWithExtension = useCallback(async () => {
    try {
      setIsLoading(true);
      const user = await loginWithExtension();
      
      if (user) {
        setUser(user);
        
        // Try to connect to relay
        try {
          await connectToRelay();
        } catch (error) {
          console.error("Failed to connect to relay:", error);
          toast({
            title: "Connection Warning",
            description: "Connected to Nostr but couldn't establish relay connection. Some features may not work.",
          });
        }
      }
    } catch (error) {
      console.error("Extension login error:", error);
      toast({
        title: "Login Failed",
        description: "Could not log in with extension.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLoginWithNsec = useCallback(async (nsec: string) => {
    try {
      setIsLoading(true);
      const user = await loginWithPrivateKey(nsec);
      
      if (user) {
        setUser(user);
        
        // Try to connect to relay
        try {
          await connectToRelay();
        } catch (error) {
          console.error("Failed to connect to relay:", error);
          toast({
            title: "Connection Warning",
            description: "Connected to Nostr but couldn't establish relay connection. Some features may not work.",
          });
        }
      }
    } catch (error) {
      console.error("Private key login error:", error);
      toast({
        title: "Login Failed",
        description: "Could not log in with private key.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLoginWithNpub = useCallback(async (npub: string) => {
    try {
      setIsLoading(true);
      const user = await loginWithPublicKey(npub);
      
      if (user) {
        setUser(user);
        
        // Try to connect to relay
        try {
          await connectToRelay();
        } catch (error) {
          console.error("Failed to connect to relay:", error);
          toast({
            title: "Connection Warning",
            description: "Connected to Nostr but couldn't establish relay connection. Some features may not work.",
          });
        }
        
        toast({
          title: "Read-Only Mode",
          description: "You're logged in with a public key. You can view content but cannot create new content.",
        });
      }
    } catch (error) {
      console.error("Public key login error:", error);
      toast({
        title: "Login Failed",
        description: "Could not log in with public key.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    authLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated: isLoggedIn(),
        user: user || getCurrentUser(),
        canSign: canSignEvents(),
        loginWithExtension: handleLoginWithExtension,
        loginWithNsec: handleLoginWithNsec,
        loginWithNpub: handleLoginWithNpub,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};