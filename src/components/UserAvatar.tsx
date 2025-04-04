import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserProfile, formatPubkey } from '@/lib/userProfiles';

interface UserAvatarProps {
  pubkey: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

/**
 * Component for displaying a user's avatar with Nostr profile information
 */
export function UserAvatar({ pubkey, size = 'md', showTooltip = true, className = '' }: UserAvatarProps) {
  const { data: profile, isLoading } = useUserProfile(pubkey);
  
  // Size classes
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base'
  };
  
  // Get the proper size class
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  
  // Get initials for fallback
  const getInitials = (): string => {
    if (!profile || isLoading) return formatPubkey(pubkey).slice(0, 2).toUpperCase();
    
    const name = profile.metadata.name || profile.metadata.displayName;
    if (!name) return formatPubkey(pubkey).slice(0, 2).toUpperCase();
    
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };
  
  // Display name for the tooltip and as label
  const displayName = profile?.metadata?.name || 
                      profile?.metadata?.displayName ||
                      formatPubkey(pubkey);
  
  const avatar = (
    <Avatar className={`${sizeClass} ${className}`}>
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
      <AvatarFallback>
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );
  
  // Wrap with tooltip if showTooltip is true
  if (showTooltip) {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {avatar}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{displayName}</p>
          {profile?.metadata?.nip05 && (
            <p className="text-xs text-muted-foreground">{profile.metadata.nip05}</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }
  
  // Otherwise just return the avatar
  return avatar;
}

/**
 * Component that displays user's name and/or pubkey
 */
export function UserName({ pubkey, className = '' }: { pubkey: string; className?: string }) {
  const { data: profile } = useUserProfile(pubkey);
  
  const displayName = profile?.metadata?.name || 
                      profile?.metadata?.displayName;
  
  return (
    <span className={className}>
      {displayName || formatPubkey(pubkey)}
      {displayName && profile?.metadata?.nip05 && (
        <span className="text-xs text-muted-foreground ml-1">
          ✓
        </span>
      )}
    </span>
  );
}