import { useState } from "react";
import { cn } from "@/lib/utils";

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackUrls?: string[];
  fallbackComponent?: React.ReactNode;
  className?: string;
}

/**
 * A reusable image component with fallback support.
 * It will try the primary src, then any fallbacks in sequence, and finally show a fallback component.
 */
export function ImageWithFallback({
  src,
  alt,
  fallbackUrls = [],
  fallbackComponent,
  className,
  ...props
}: ImageWithFallbackProps) {
  const [imgSrc, setImgSrc] = useState<string>(src);
  const [fallbackIndex, setFallbackIndex] = useState<number>(-1);
  const [showFallback, setShowFallback] = useState<boolean>(false);
  
  const handleError = () => {
    // Log error
    console.log(`Image failed to load: ${imgSrc}`);
    
    // Try next fallback URL if available
    const nextIndex = fallbackIndex + 1;
    
    if (nextIndex < fallbackUrls.length) {
      console.log(`Trying fallback URL ${nextIndex + 1}/${fallbackUrls.length}: ${fallbackUrls[nextIndex]}`);
      setImgSrc(fallbackUrls[nextIndex]);
      setFallbackIndex(nextIndex);
    } else {
      // All fallbacks exhausted, show fallback component
      console.log('All fallback URLs exhausted');
      setShowFallback(true);
    }
  };

  if (showFallback) {
    // Show fallback component or default "No Cover" element
    return fallbackComponent ? (
      <>{fallbackComponent}</>
    ) : (
      <div className={cn("bg-muted flex items-center justify-center", className)}>
        <span className="text-xs text-muted-foreground">No Cover</span>
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      {...props}
    />
  );
}