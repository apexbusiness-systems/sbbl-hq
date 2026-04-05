import * as React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface PlayerAvatarProps extends React.ComponentPropsWithoutRef<typeof Avatar> {
  src?: string | null;
  alt: string;
  fallbackDelayMs?: number;
}

export function PlayerAvatar({ src, alt, className, fallbackDelayMs, ...props }: PlayerAvatarProps) {
  // Compute initials from the name (alt text)
  const initials = alt
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Avatar className={cn("shrink-0", className)} {...props}>
      {src && (
        <AvatarImage
          src={src}
          alt={alt}
          className="object-cover"
        />
      )}
      <AvatarFallback
        delayMs={fallbackDelayMs}
        className="bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider"
      >
        {initials || '?'}
      </AvatarFallback>
    </Avatar>
  );
}
