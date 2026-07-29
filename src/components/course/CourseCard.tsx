import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, MoreVertical, Star } from 'lucide-react';
import { Card, CardTitle, CardDescription } from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { updateCoursePreferences, type Course } from '../../data/courses';
import { COURSE_COLOR_KEYS, courseColorHex, type CourseColorKey } from '../../lib/courseColors';
import { cn } from '../../lib/utils';

export function CourseCard({
  course,
  role,
  onChange,
}: {
  course: Course;
  role: 'student' | 'instructor';
  onChange: (course: Course) => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const setPreference = async (input: { color?: CourseColorKey; favorite?: boolean; archived?: boolean }) => {
    try {
      const updated = await updateCoursePreferences(course.id, input);
      onChange(updated);
    } catch {
      // Non-critical UI preference — fail silently rather than interrupt with a toast.
    }
  };

  return (
    <Card
      className="cursor-pointer overflow-hidden transition-shadow hover:shadow-[0_8px_30px_rgba(40,50,90,0.18)]"
      onClick={() => navigate(`/courses/${course.id}`)}
    >
      {/* Color band: a full header-height block of the viewer's chosen color,
          not a thin accent line — the icon buttons sit on top of it with
          white-on-translucent-black styling, which stays readable against
          any of the nine palette colors and in both light/dark theme
          (unlike a theme-toned "ghost" button, which nearly disappeared
          against a dark card). */}
      <div
        className="relative flex h-12 items-start justify-end p-2"
        style={{ backgroundColor: courseColorHex(course.color) }}
        onClick={stop}
      >
        <button
          title={course.favorite ? 'Remove from favorites' : 'Mark as favorite'}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm transition-colors hover:bg-black/35"
          onClick={() => setPreference({ favorite: !course.favorite })}
        >
          <Star size={14} className={course.favorite ? 'fill-white' : ''} />
        </button>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              title="More options"
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm transition-colors hover:bg-black/35"
            >
              <MoreVertical size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Card color</DropdownMenuLabel>
            <div className="flex flex-wrap gap-1.5 px-2.5 py-1.5">
              {COURSE_COLOR_KEYS.map((key) => (
                <button
                  key={key}
                  title={key}
                  className={cn(
                    'h-5 w-5 rounded-full transition-transform hover:scale-110',
                    course.color === key && 'ring-2 ring-offset-2 ring-offset-bg-panel ring-text',
                  )}
                  style={{ backgroundColor: courseColorHex(key) }}
                  onClick={() => {
                    setPreference({ color: key });
                    setMenuOpen(false);
                  }}
                />
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setPreference({ archived: !course.archived })}>
              {course.archived ? (
                <>
                  <ArchiveRestore size={14} /> Unarchive
                </>
              ) : (
                <>
                  <Archive size={14} /> Archive
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-1.5 p-3.5">
        <div>
          <CardTitle className="text-sm">{course.title}</CardTitle>
          <CardDescription className="mt-0.5">
            {role === 'instructor' ? `${course.studentCount ?? 0} student${course.studentCount === 1 ? '' : 's'}` : course.instructorName}
          </CardDescription>
        </div>
        {course.description && <p className="text-xs text-text-dim line-clamp-2">{course.description}</p>}
        {role === 'instructor' && (
          <div className="font-mono text-xs text-text-faint">
            Join code: <span className="font-semibold text-accent">{course.joinCode}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
