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
import { createCourse, type Course } from '../../data/courses';

export function CreateCourseDialog({ onCreated }: { onCreated: (course: Course) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const course = await createCourse({ title, description: description.trim() || undefined });
      onCreated(course);
      setOpen(false);
      setTitle('');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create course');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} /> New course
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a course</DialogTitle>
          <DialogDescription>Students will join using a code generated after you create it.</DialogDescription>
        </DialogHeader>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="course-title">Title</Label>
            <Input
              id="course-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Syntax 101"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="course-description">Description (optional)</Label>
            <Input
              id="course-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Intro to generative syntax"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create course'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
