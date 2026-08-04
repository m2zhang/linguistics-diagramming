import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus } from 'lucide-react';
import { createAssignment, type Assignment, type AssignmentMode } from '../../data/assignments';

/** sessionStorage payload read back by CreateAssignmentBanner once the
 *  instructor has built the starting tree in the shared editor. */
export interface PendingAssignment {
  courseId: string;
  title: string;
  instructions?: string;
  dueAt?: string | null;
  maxGrade?: number | null;
}
export const PENDING_ASSIGNMENT_KEY = 'syntaxtree.pendingAssignment';

export function AssignmentEditorDialog({
  courseId,
  onCreated,
}: {
  courseId: string;
  onCreated: (assignment: Assignment) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxGrade, setMaxGrade] = useState('');
  const [mode, setMode] = useState<AssignmentMode>('blank');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const dueAtIso = dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'template') {
      // Two-step flow: stash the metadata, build the starting tree in the
      // real editor, then CreateAssignmentBanner does the actual POST with
      // both the metadata and the tree together (the DB requires
      // templateContent whenever mode='template', so we can't create the
      // row until the tree exists).
      const pending: PendingAssignment = {
        courseId,
        title,
        instructions: instructions.trim() || undefined,
        dueAt: dueAtIso,
        maxGrade: maxGrade ? Number(maxGrade) : null,
      };
      sessionStorage.setItem(PENDING_ASSIGNMENT_KEY, JSON.stringify(pending));
      setOpen(false);
      navigate('/editor?newAssignmentDraft=1');
      return;
    }

    setSubmitting(true);
    try {
      const assignment = await createAssignment(courseId, {
        title,
        instructions: instructions.trim() || undefined,
        mode: 'blank',
        dueAt: dueAtIso,
        maxGrade: maxGrade ? Number(maxGrade) : null,
      });
      onCreated(assignment);
      setOpen(false);
      setTitle('');
      setInstructions('');
      setDueDate('');
      setMaxGrade('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create assignment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} /> New assignment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New assignment</DialogTitle>
          <DialogDescription>
            Blank canvas: students start from scratch. Template: you build a starting tree first.
          </DialogDescription>
        </DialogHeader>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignment-title">Title</Label>
            <Input
              id="assignment-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Homework 2 — Wh-movement"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignment-instructions">Instructions (optional)</Label>
            <textarea
              id="assignment-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="Diagram the following sentences…"
              className="rounded-[var(--radius-sm)] border border-border bg-bg-input px-3 py-2 text-sm text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignment-due">Due date (optional)</Label>
            <Input id="assignment-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignment-max-grade">Total Points / Max Grade (optional)</Label>
            <Input id="assignment-max-grade" type="number" min="0" step="0.5" value={maxGrade} onChange={(e) => setMaxGrade(e.target.value)} placeholder="e.g. 100" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Starting point</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded-[var(--radius-sm)] border px-3 py-2 text-left text-sm transition-colors ${
                  mode === 'blank'
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-bg-input text-text-dim hover:border-accent hover:text-text'
                }`}
                onClick={() => setMode('blank')}
              >
                <div className="font-semibold">Blank canvas</div>
                <div className="text-xs opacity-80">Students draw from scratch</div>
              </button>
              <button
                type="button"
                className={`flex-1 rounded-[var(--radius-sm)] border px-3 py-2 text-left text-sm transition-colors ${
                  mode === 'template'
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-bg-input text-text-dim hover:border-accent hover:text-text'
                }`}
                onClick={() => setMode('template')}
              >
                <div className="font-semibold">Template tree</div>
                <div className="text-xs opacity-80">Students build on your tree</div>
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting || !title}>
              {mode === 'template'
                ? 'Continue to build tree →'
                : submitting
                  ? 'Creating…'
                  : 'Create assignment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
