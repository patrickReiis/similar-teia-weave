import { toast } from "@/components/ui/use-toast";
import { nip19, getPublicKey as getPublicKeyFromPrivateKey } from "nostr-tools";

// Constants
const LOCAL_STORAGE_USER_KEY = 'similarteia_user';
const LOCAL_STORAGE_PRIVATE_KEY = 'similarteia_private_key'; // Encrypted in the future

// Types
export interface User {
  pubkey: string;
  privateKey?: string;
  created_at: number;
  loginMethod: 'extension' | 'nsec' | 'npub';
  lastActive: number;
}

// Current user state
let currentUser: User | null = null;

/**
 * Initialize the auth system by checking for saved user
 */
export function initAuth(): User | null {
  try {
    const savedUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      
      // If user was saved with private key, also restore from secure storage
      if (currentUser.loginMethod === 'nsec') {
        const privateKey = localStorage.getItem(LOCAL_STORAGE_PRIVATE_KEY);
        if (privateKey) {
          currentUser.privateKey = privateKey;
        } else {
          console.warn("Private key not found in storage, but user was logged in with nsec");
          clearAuth(); // Clear invalid state
          return null;
        }
      }
      
      // Update last active time
      currentUser.lastActive = Date.now();
      saveUser();
      
      return currentUser;
    }
    
    return null;
  } catch (error) {
    console.error("Failed to initialize auth:", error);
    clearAuth(); // Clear potentially corrupt data
    return null;
  }
}

/**
 * Save current user to storage
 */
function saveUser() {
  if (!currentUser) return;
  
  // Save user info without private key
  const userToSave = { ...currentUser };
  delete userToSave.privateKey;
  
  localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userToSave));
  
  // If user has private key, save it separately
  if (currentUser.privateKey) {
    localStorage.setItem(LOCAL_STORAGE_PRIVATE_KEY, currentUser.privateKey);
  }
}

/**
 * Clear all auth data
 */
export function clearAuth() {
  localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
  localStorage.removeItem(LOCAL_STORAGE_PRIVATE_KEY);
  currentUser = null;
}

/**
 * Log in with Nostr extension (NIP-07)
 */
export async function loginWithExtension(): Promise<User | null> {
  try {
    if (typeof window.nostr === 'undefined') {
      toast({
        title: "Nostr extension not found",
        description: "Please install a Nostr browser extension like nos2x, Alby, or Flamingo",
        variant: "destructive",
      });
      return null;
    }

    console.log("Requesting public key from extension...");
    const pubkey = await window.nostr.getPublicKey();
    
    if (!pubkey) {
      toast({
        title: "Login failed",
        description: "Could not get public key from extension",
        variant: "destructive",
      });
      return null;
    }

    console.log(`Got public key: ${pubkey}`);
    
    // Create user object
    currentUser = {
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      loginMethod: 'extension',
      lastActive: Date.now()
    };

    // Save to storage
    saveUser();
    
    toast({
      title: "Login successful",
      description: "You're now logged in with your Nostr extension",
    });

    return currentUser;
  } catch (error) {
    console.error("Extension login error:", error);
    toast({
      title: "Login failed",
      description: error instanceof Error ? error.message : "Could not connect to Nostr extension",
      variant: "destructive",
    });
    return null;
  }
}

/**
 * Login with private key (nsec)
 */
export async function loginWithPrivateKey(nsecOrHex: string): Promise<User | null> {
  try {
    let privateKey: string;
    
    // Handle nsec format
    if (nsecOrHex.startsWith('nsec')) {
      try {
        const decoded = nip19.decode(nsecOrHex);
        if (decoded.type !== 'nsec') {
          throw new Error("Invalid nsec format");
        }
        privateKey = decoded.data as string;
      } catch (error) {
        toast({
          title: "Invalid private key",
          description: "The nsec key format is invalid",
          variant: "destructive",
        });
        return null;
      }
    } else {
      // Assume hex format
      if (!/^[0-9a-f]{64}$/i.test(nsecOrHex)) {
        toast({
          title: "Invalid private key",
          description: "Private key must be 64 hex characters or valid nsec",
          variant: "destructive",
        });
        return null;
      }
      privateKey = nsecOrHex;
    }
    
    // Derive public key
    const pubkey = getPublicKeyFromPrivateKey(privateKey);
    
    if (!pubkey) {
      toast({
        title: "Invalid private key",
        description: "Could not derive public key from private key",
        variant: "destructive",
      });
      return null;
    }
    
    // Create user object
    currentUser = {
      pubkey,
      privateKey,
      created_at: Math.floor(Date.now() / 1000),
      loginMethod: 'nsec',
      lastActive: Date.now()
    };
    
    // Save to storage
    saveUser();
    
    toast({
      title: "Login successful",
      description: "You're now logged in with your private key",
    });
    
    return currentUser;
  } catch (error) {
    console.error("Private key login error:", error);
    toast({
      title: "Login failed",
      description: error instanceof Error ? error.message : "Invalid private key",
      variant: "destructive",
    });
    return null;
  }
}

/**
 * Login with public key (read-only)
 */
export async function loginWithPublicKey(npubOrHex: string): Promise<User | null> {
  try {
    let pubkey: string;
    
    // Handle npub format
    if (npubOrHex.startsWith('npub')) {
      try {
        const decoded = nip19.decode(npubOrHex);
        if (decoded.type !== 'npub') {
          throw new Error("Invalid npub format");
        }
        pubkey = decoded.data as string;
      } catch (error) {
        toast({
          title: "Invalid public key",
          description: "The npub key format is invalid",
          variant: "destructive",
        });
        return null;
      }
    } else {
      // Assume hex format
      if (!/^[0-9a-f]{64}$/i.test(npubOrHex)) {
        toast({
          title: "Invalid public key",
          description: "Public key must be 64 hex characters or valid npub",
          variant: "destructive",
        });
        return null;
      }
      pubkey = npubOrHex;
    }
    
    // Create user object (read-only)
    currentUser = {
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      loginMethod: 'npub',
      lastActive: Date.now()
    };
    
    // Save to storage
    saveUser();
    
    toast({
      title: "Read-only login successful",
      description: "You're now logged in with a public key (read-only mode)",
    });
    
    return currentUser;
  } catch (error) {
    console.error("Public key login error:", error);
    toast({
      title: "Login failed",
      description: error instanceof Error ? error.message : "Invalid public key",
      variant: "destructive",
    });
    return null;
  }
}

/**
 * Log out current user
 */
export function logout(): void {
  clearAuth();
  
  toast({
    title: "Logged out",
    description: "You've been logged out successfully",
  });
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): User | null {
  return currentUser;
}

/**
 * Check if user is logged in
 */
export function isLoggedIn(): boolean {
  return currentUser !== null;
}

/**
 * Check if current login method can sign events
 */
export function canSignEvents(): boolean {
  if (!currentUser) return false;
  return currentUser.loginMethod === 'extension' || currentUser.loginMethod === 'nsec';
}

/**
 * Format hex pubkey to npub
 */
export function pubkeyToNpub(pubkey: string): string {
  try {
    return nip19.npubEncode(pubkey);
  } catch (error) {
    console.error("Error converting pubkey to npub:", error);
    return pubkey;
  }
}

/**
 * Format hex privkey to nsec
 */
export function privkeyToNsec(privkey: string): string {
  try {
    return nip19.nsecEncode(privkey);
  } catch (error) {
    console.error("Error converting privkey to nsec:", error);
    return privkey;
  }
}

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: any): Promise<any>;
    };
  }
}