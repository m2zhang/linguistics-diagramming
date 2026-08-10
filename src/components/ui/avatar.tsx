import { ComponentProps, forwardRef } from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { User } from 'lucide-react';
import { cn } from '../../lib/utils';
import { COURSE_COLOR_KEYS, courseColorHex } from '../../lib/courseColors';

export const Avatar = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  ComponentProps<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

export const AvatarImage = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  ComponentProps<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn('h-full w-full object-cover', className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

export const AvatarFallback = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  ComponentProps<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center bg-accent-soft text-xs font-semibold text-accent',
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

/** Deterministic hash of a string into [0, mod). Stable across renders/
 *  reloads since it's a pure function of the seed, not Math.random(). */
function hashToIndex(seed: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
}

/** No photo upload in this app — every avatar is a plain colored circle
 *  with a generic person silhouette. Deliberately not an illustrated/human
 *  image (nothing about a face or hairstyle to read as gendered) and not an
 *  abstract pattern either (a bare shape didn't read as "this is a person"
 *  at a glance) — just the universal default-avatar icon, colored
 *  differently per person so people are still visually distinguishable. */
export function ProfileAvatar({ seed, name, className }: { seed: string; name: string; className?: string }) {
  const color = courseColorHex(COURSE_COLOR_KEYS[hashToIndex(seed, COURSE_COLOR_KEYS.length)]);
  return (
    <Avatar className={className} title={name}>
      <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: color }}>
        <User className="h-[60%] w-[60%] text-white" strokeWidth={2} fill="currentColor" fillOpacity={0.25} />
      </div>
    </Avatar>
  );
}
