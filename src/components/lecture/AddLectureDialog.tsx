import { FormEvent, useState } from 'react';
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
import { createLecture, type Lecture } from '../../data/lectures';

export function AddLectureDialog({ courseId, onCreated }: { courseId: string; onCreated: (lecture: Lecture) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const lecture = await createLecture(courseId, { title, notes: notes.trim() || undefined });
      onCreated(lecture);
      setOpen(false);
      setTitle('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create lecture');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} /> Add lecture
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a lecture</DialogTitle>
          <DialogDescription>
            Share notes now; you can attach trees and materials from the lecture page after creating it.
          </DialogDescription>
        </DialogHeader>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lecture-title">Title</Label>
            <Input
              id="lecture-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Week 3 — Movement and traces"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lecture-notes">Notes (optional)</Label>
            <textarea
              id="lecture-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="What we covered today…"
              className="rounded-[var(--radius-sm)] border border-border bg-bg-input px-3 py-2 text-sm text-text placeholder:text-text-faint focus-visible:outline-none focus-visible:border-accent"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create lecture'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
