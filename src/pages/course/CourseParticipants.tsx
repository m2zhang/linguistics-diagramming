import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, Copy, RefreshCw, Search, UserPlus } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ProfileAvatar } from '../../components/ui/avatar';
import { Card, CardContent } from '../../components/ui/card';
import { PageHeader } from '../../components/layout/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { getRoster, regenerateJoinCode, removeStudent, updateParticipantRole, type RosterEntry } from '../../data/courses';
import { useUiStore } from '../../store/uiStore';
import { copyText } from '../../utils/clipboard';
import type { CourseOutletContext } from './CourseShell';

interface Participant {
  id: string;
  name: string;
  email: string;
  type: 'Instructor' | 'TA' | 'Student';
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
      email: course.instructorEmail ?? '',
      type: 'Instructor',
      joinedAt: null,
    };
    const students: Participant[] = roster.map((s) => ({
      id: s.id,
      name: s.displayName,
      email: s.email,
      type: s.role === 'ta' ? 'TA' : 'Student',
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

  const onRoleChange = async (studentId: string, newType: 'Student' | 'TA') => {
    try {
      const dbRole = newType === 'TA' ? 'ta' : 'student';
      await updateParticipantRole(course.id, studentId, dbRole);
      setRoster((prev) => prev?.map((s) => (s.id === studentId ? { ...s, role: dbRole } : s)) ?? prev);
      toast('Role updated', 'success');
    } catch {
      toast('Could not update role', 'error');
    }
  };

  const onCopyCode = async () => {
    if (!course.joinCode) return;
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
      <PageHeader
        title="Participants"
        subtitle={
          participants
            ? `${participants.length} ${participants.length === 1 ? 'person' : 'people'} in this course`
            : 'Loading…'
        }
        actions={
          <div className="relative w-64">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <Input
              placeholder="Search people…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        }
      />

      {role === 'instructor' && (
        <Card className="mb-4">
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
        <Card className="px-2 py-1.5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {role === 'instructor' && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="py-2.5 font-medium">
                    <div className="flex items-center gap-2.5">
                      <ProfileAvatar seed={p.id} name={p.name} className="h-7 w-7 text-[11px]" />
                      {p.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-text-dim">{p.email || '—'}</TableCell>
                  <TableCell>
                    {role === 'instructor' && p.type !== 'Instructor' ? (
                      <select
                        className="rounded-[var(--radius-sm)] border border-border bg-bg-input px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-accent"
                        value={p.type}
                        onChange={(e) => onRoleChange(p.id, e.target.value as 'Student' | 'TA')}
                      >
                        <option value="Student">Student</option>
                        <option value="TA">TA</option>
                      </select>
                    ) : (
                      <Badge variant={p.type === 'Instructor' ? 'default' : p.type === 'TA' ? 'outline' : 'secondary'}>{p.type}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-text-dim">
                    {p.joinedAt ? new Date(p.joinedAt).toLocaleDateString() : '—'}
                  </TableCell>
                  {role === 'instructor' && (
                    <TableCell className="text-right">
                      {p.type !== 'Instructor' && (
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
        </Card>
      )}
    </div>
  );
}
