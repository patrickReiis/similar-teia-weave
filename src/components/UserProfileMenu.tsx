import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import { LogOut, User, KeyRound, AlertTriangle } from "lucide-react";

export function UserProfileMenu() {
  const { user, canSign, logout } = useAuth();
  const { data: profile } = useUserProfile(user?.pubkey || null);
  
  if (!user?.pubkey) {
    return null;
  }
  
  // Get display name from profile or use formatted pubkey
  const displayName = profile?.metadata?.name || 
                     profile?.metadata?.displayName || 
                     formatPubkey(user.pubkey);
  
  // Get initials for avatar fallback
  const getInitials = (): string => {
    if (!profile) return formatPubkey(user.pubkey).slice(0, 2).toUpperCase();
    
    const name = profile.metadata.name || profile.metadata.displayName;
    if (!name) return formatPubkey(user.pubkey).slice(0, 2).toUpperCase();
    
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };
  
  // Determine login method icon and text
  const getLoginMethodInfo = () => {
    switch (user.loginMethod) {
      case 'extension':
        return { icon: <User className="mr-2 h-4 w-4" />, text: "Extension" };
      case 'nsec':
        return { icon: <KeyRound className="mr-2 h-4 w-4" />, text: "Private Key" };
      case 'npub':
        return { icon: <AlertTriangle className="mr-2 h-4 w-4" />, text: "Read-Only Mode" };
      default:
        return { icon: <User className="mr-2 h-4 w-4" />, text: "Unknown" };
    }
  };
  
  const loginMethodInfo = getLoginMethodInfo();
  
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
          {loginMethodInfo.icon}
          <span>{loginMethodInfo.text}</span>
          {!canSign && (
            <span className="ml-2 text-xs text-yellow-500">(Cannot sign events)</span>
          )}
        </DropdownMenuItem>
        
        <DropdownMenuItem disabled className="flex items-center">
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={logout} className="text-red-500 focus:text-red-500 flex items-center">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}