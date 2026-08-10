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
import { LogIn } from 'lucide-react';
import { joinCourse } from '../../data/courses';

export function JoinCourseDialog({ onJoined }: { onJoined: (courseId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { courseId } = await joinCourse(code);
      onJoined(courseId);
      setOpen(false);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join course');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-white text-accent hover:bg-white/90 font-semibold shadow-sm border border-white/20">
          <LogIn size={16} /> Join course
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a course</DialogTitle>
          <DialogDescription>Enter the code your instructor shared with you.</DialogDescription>
        </DialogHeader>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="join-code">Join code</Label>
            <Input
              id="join-code"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={20}
              className="font-mono tracking-widest"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Joining…' : 'Join'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
