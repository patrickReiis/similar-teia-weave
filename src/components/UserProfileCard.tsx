import { useUserProfile, formatPubkey } from '@/lib/userProfiles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLinkIcon } from 'lucide-react';

interface UserProfileCardProps {
  pubkey: string;
  showBanner?: boolean;
  className?: string;
}

/**
 * Component for displaying a user's profile card with metadata
 */
export function UserProfileCard({ pubkey, showBanner = true, className = '' }: UserProfileCardProps) {
  const { data: profile, isLoading } = useUserProfile(pubkey);
  
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  // Handle the case where profile might be undefined
  if (!profile) {
    return null;
  }
  
  const { metadata } = profile;
  
  // Display name - use name or displayName or fallback to formatted pubkey
  const displayName = metadata.name || metadata.displayName || formatPubkey(pubkey);
  
  // Get initials for avatar fallback
  const getInitials = (): string => {
    const name = metadata.name || metadata.displayName;
    if (!name) return formatPubkey(pubkey).slice(0, 2).toUpperCase();
    
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };
  
  return (
    <Card className={className}>
      {/* Show banner if available and showBanner is true */}
      {showBanner && metadata.banner && (
        <div 
          className="h-32 bg-cover bg-center rounded-t-lg" 
          style={{ backgroundImage: `url(${metadata.banner})` }}
        />
      )}
      
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          {/* Avatar */}
          <Avatar className="h-10 w-10">
            {metadata.picture ? (
              <AvatarImage 
                src={metadata.picture} 
                alt={displayName}
                onError={(e) => {
                  // If image fails to load, remove the src to show fallback
                  (e.target as HTMLImageElement).src = '';
                }} 
              />
            ) : null}
            <AvatarFallback>{getInitials()}</AvatarFallback>
          </Avatar>
          
          {/* Name */}
          <span>{displayName}</span>
          
          {/* Verification badge if NIP-05 identity exists */}
          {metadata.nip05 && (
            <span className="text-xs text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">
              ✓ {metadata.nip05.split('@')[1]}
            </span>
          )}
        </CardTitle>
        
        {/* NIP-05 as subtitle */}
        {metadata.nip05 && (
          <CardDescription>
            {metadata.nip05}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* About text */}
        {metadata.about && (
          <p className="text-sm text-similarteia-muted">
            {metadata.about}
          </p>
        )}
        
        {/* Website if available */}
        {metadata.website && (
          <a 
            href={metadata.website} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline flex items-center gap-1"
          >
            <ExternalLinkIcon size={14} />
            {metadata.website.replace(/(^\w+:|^)\/\//, '')} {/* Remove protocol */}
          </a>
        )}
        
        {/* Public key in small text */}
        <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
          <span>Pubkey: {formatPubkey(pubkey)}</span>
        </div>
      </CardContent>
    </Card>
  );
}