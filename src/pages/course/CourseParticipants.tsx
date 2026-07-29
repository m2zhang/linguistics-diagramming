import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, Copy, RefreshCw, Search, UserPlus } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ProfileAvatar } from '../../components/ui/avatar';
import { Card, CardContent } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { getRoster, regenerateJoinCode, removeStudent, type RosterEntry } from '../../data/courses';
import { useUiStore } from '../../store/uiStore';
import { copyText } from '../../utils/clipboard';
import type { CourseOutletContext } from './CourseShell';

interface Participant {
  id: string;
  name: string;
  email: string;
  type: 'Instructor' | 'Student';
  joinedAt: string | null;
}

export function CourseParticipants() {
  const { course, role, refreshCourse } = useOutletContext<CourseOutletContext>();
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const toast = useUiStore((s) => s.toast);

  useEffect(() => {
    let active = true;
    getRoster(course.id)
      .then((r) => active && setRoster(r))
      .catch(() => active && toast('Could not load participants', 'error'));
    return () => {
      active = false;
    };
  }, [course.id, toast]);

  const participants: Participant[] | null = useMemo(() => {
    if (roster === null) return null;
    const instructor: Participant = {
      id: course.instructorId,
      name: course.instructorName ?? 'Instructor',
      email: '',
      type: 'Instructor',
      joinedAt: null,
    };
    const students: Participant[] = roster.map((s) => ({
      id: s.id,
      name: s.displayName,
      email: s.email,
      type: 'Student',
      joinedAt: s.joinedAt,
    }));
    return [instructor, ...students];
  }, [roster, course]);

  const filtered = participants?.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
  });

  const onRemove = async (studentId: string) => {
    try {
      await removeStudent(course.id, studentId);
      setRoster((prev) => prev?.filter((s) => s.id !== studentId) ?? prev);
      toast('Student removed', 'success');
    } catch {
      toast('Could not remove student', 'error');
    }
  };

  const onCopyCode = async () => {
    const ok = await copyText(course.joinCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast('Could not copy — select and copy manually', 'error');
    }
  };

  const onRegenerate = async () => {
    try {
      await regenerateJoinCode(course.id);
      refreshCourse();
      toast('Join code regenerated', 'success');
    } catch {
      toast('Could not regenerate join code', 'error');
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Participants</h2>
          <p className="text-sm text-text-dim">{participants ? participants.length : '…'} people in this course</p>
        </div>
        <div className="relative w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <Input
            placeholder="Search people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {role === 'instructor' && (
        <Card className="mb-5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-accent-soft text-accent">
                <UserPlus size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold">Invite students</p>
                <p className="text-xs text-text-dim">Share this code — students enter it to join the course.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-[var(--radius-sm)] bg-bg-input px-3 py-1.5 font-mono text-lg font-semibold tracking-widest text-accent">
                {course.joinCode}
              </span>
              <Button variant="outline" size="sm" title="Copy join code" onClick={onCopyCode}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </Button>
              <Button variant="ghost" size="sm" title="Regenerate join code" onClick={onRegenerate}>
                <RefreshCw size={14} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filtered === undefined && <p className="text-sm text-text-dim">Loading…</p>}

      {filtered && filtered.length === 0 && (
        <p className="text-sm text-text-dim">No participants match "{query}".</p>
      )}

      {filtered && filtered.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {role === 'instructor' && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <ProfileAvatar seed={p.id} name={p.name} className="h-7 w-7 text-[11px]" />
                    {p.name}
                  </div>
                </TableCell>
                <TableCell className="text-text-dim">{p.email || '—'}</TableCell>
                <TableCell>
                  <Badge variant={p.type === 'Instructor' ? 'default' : 'secondary'}>{p.type}</Badge>
                </TableCell>
                <TableCell className="text-text-dim">
                  {p.joinedAt ? new Date(p.joinedAt).toLocaleDateString() : '—'}
                </TableCell>
                {role === 'instructor' && (
                  <TableCell>
                    {p.type === 'Student' && (
                      <Button variant="destructive" size="sm" onClick={() => onRemove(p.id)}>
                        Remove
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
