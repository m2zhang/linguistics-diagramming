import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned controls — a search field, a "New …" button, an export menu. */
  actions?: ReactNode;
  /** Rendered above the title; a BackButton on the detail pages. */
  back?: ReactNode;
  className?: string;
}

/** Title block for a course page.
 *
 *  Its own rounded panel, tinted with the course colour, sitting above the
 *  content cards rather than inside one — the heading is the label for the
 *  cards below, so sharing a surface with them made every page read as a single
 *  undifferentiated box with the title looking like that box's own.
 *
 *  The tint comes from `--course-color`, which CourseShell sets on the content
 *  wrapper. Mixing toward transparent (rather than toward a fixed white) keeps
 *  it composited over whatever background is behind, so the same numbers work
 *  in both themes. Falls back to the app accent outside a course. */
export function PageHeader({ title, subtitle, actions, back, className }: PageHeaderProps) {
  return (
    <header
      className={cn('mb-5 rounded-[var(--radius)] border px-5 py-4', className)}
      style={{
        // 20% is the ceiling, not a taste call: the subtitle is --text-dim, and
        // above ~20% the tint lifts the dark-theme panel enough to push that
        // pairing under 4.5:1. Checked against the lightest course colours
        // (green, teal), which lift it the most.
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--course-color, var(--accent)) 20%, transparent) 0%, color-mix(in srgb, var(--course-color, var(--accent)) 8%, transparent) 100%)',
        borderColor: 'color-mix(in srgb, var(--course-color, var(--accent)) 34%, transparent)',
      }}
    >
      {back}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold leading-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-text-dim">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
