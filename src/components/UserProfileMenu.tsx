import { useNostr } from "@/contexts/NostrContext";
import { useUserProfile, formatPubkey } from "@/lib/userProfiles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User } from "lucide-react";

export function UserProfileMenu() {
  const { isAuthenticated, pubkey, logout } = useNostr();
  const { data: profile } = useUserProfile(pubkey);
  
  if (!isAuthenticated || !pubkey) {
    return null;
  }
  
  // Get display name from profile or use formatted pubkey
  const displayName = profile?.metadata?.name || 
                     profile?.metadata?.displayName || 
                     formatPubkey(pubkey);
  
  // Get initials for avatar fallback
  const getInitials = (): string => {
    if (!profile) return formatPubkey(pubkey).slice(0, 2).toUpperCase();
    
    const name = profile.metadata.name || profile.metadata.displayName;
    if (!name) return formatPubkey(pubkey).slice(0, 2).toUpperCase();
    
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            {profile?.metadata?.picture ? (
              <AvatarImage 
                src={profile.metadata.picture} 
                alt={displayName}
                onError={(e) => {
                  // If image fails to load, remove the src to show fallback
                  (e.target as HTMLImageElement).src = '';
                }} 
              />
            ) : null}
            <AvatarFallback>{getInitials()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-medium">{displayName}</span>
            {profile?.metadata?.nip05 && (
              <span className="text-xs text-muted-foreground">{profile.metadata.nip05}</span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="flex items-center">
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={logout} className="text-red-500 focus:text-red-500 flex items-center">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}