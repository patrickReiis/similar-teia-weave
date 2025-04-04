import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, KeyRound, Eye, LogIn } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { loginWithExtension, loginWithNsec, loginWithNpub, isLoading } = useAuth();
  
  const [nsecKey, setNsecKey] = useState("");
  const [npubKey, setNpubKey] = useState("");
  const [activeTab, setActiveTab] = useState("extension");
  
  // Handle login with extension
  const handleExtensionLogin = async () => {
    await loginWithExtension();
    onClose();
  };
  
  // Handle login with nsec
  const handleNsecLogin = async () => {
    await loginWithNsec(nsecKey);
    onClose();
  };
  
  // Handle login with npub (read-only)
  const handleNpubLogin = async () => {
    await loginWithNpub(npubKey);
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Login to SimilarTeia</DialogTitle>
          <DialogDescription>
            Connect using one of the available methods to access your account.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="extension" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="extension"><LogIn className="h-4 w-4 mr-2" /> Extension</TabsTrigger>
            <TabsTrigger value="nsec"><KeyRound className="h-4 w-4 mr-2" /> Private Key</TabsTrigger>
            <TabsTrigger value="npub"><Eye className="h-4 w-4 mr-2" /> Read-Only</TabsTrigger>
          </TabsList>
          
          {/* Extension Login Tab */}
          <TabsContent value="extension" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Login with a Nostr extension like nos2x, Alby, or Flamingo.
            </p>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Extension Required</AlertTitle>
              <AlertDescription>
                You need a Nostr browser extension installed to use this login method.
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={handleExtensionLogin} 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Connecting..." : "Connect with Extension"}
            </Button>
          </TabsContent>
          
          {/* Private Key Login Tab */}
          <TabsContent value="nsec" className="mt-4 space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Security Warning</AlertTitle>
              <AlertDescription>
                Never share your private key with anyone. This key gives full control of your account.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="nsec">Your private key (nsec or hex)</Label>
              <Input
                id="nsec"
                type="password"
                value={nsecKey}
                onChange={(e) => setNsecKey(e.target.value)}
                placeholder="nsec1... or hex private key"
              />
              <p className="text-xs text-muted-foreground">
                Your private key will be stored locally on your device and not shared.
              </p>
            </div>
            
            <Button
              onClick={handleNsecLogin}
              className="w-full"
              disabled={isLoading || !nsecKey.trim()}
            >
              {isLoading ? "Connecting..." : "Login with Private Key"}
            </Button>
          </TabsContent>
          
          {/* Public Key Login Tab */}
          <TabsContent value="npub" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Read-only access with a public key. You won't be able to create new content.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="npub">Public key (npub or hex)</Label>
              <Input
                id="npub"
                type="text"
                value={npubKey}
                onChange={(e) => setNpubKey(e.target.value)}
                placeholder="npub1... or hex public key"
              />
            </div>
            
            <Button
              onClick={handleNpubLogin}
              className="w-full"
              disabled={isLoading || !npubKey.trim()}
            >
              {isLoading ? "Connecting..." : "Browse in Read-Only Mode"}
            </Button>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="sm:w-auto w-full">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}