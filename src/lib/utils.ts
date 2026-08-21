import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui's standard classname combinator: clsx for conditionals, then
 *  tailwind-merge to resolve conflicting utility classes (e.g. two `px-*`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
