import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Themed rounded "back to X" pill — white with a blue border/text at rest,
 *  fills solid blue on hover. Used everywhere the app needs a
 *  back-navigation link (course shell, lecture/assignment detail pages,
 *  profile, submission review). */
export function BackButton({ to, label, className }: { to: string; label: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-accent bg-bg-elevated px-3 py-1.5',
        'text-xs font-semibold text-accent no-underline transition-colors hover:bg-accent hover:text-white',
        className,
      )}
    >
      <ArrowLeft size={13} />
      {label}
    </Link>
  );
}
