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

/** sessionStorage payload read back by SaveToLectureBanner once the
 *  instructor has built the tree in the shared editor — mirrors
 *  PENDING_ASSIGNMENT_KEY's two-step pattern so the title is settled before
 *  the canvas ever opens instead of being typed into an overlay on top of it. */
export interface PendingLectureTree {
  lectureId: string;
  courseId: string;
  title: string;
}
export const PENDING_LECTURE_TREE_KEY = 'syntaxtree.pendingLectureTree';

export function AddTreeDialog({ lectureId, courseId }: { lectureId: string; courseId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const navigate = useNavigate();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const pending: PendingLectureTree = { lectureId, courseId, title: title.trim() };
    sessionStorage.setItem(PENDING_LECTURE_TREE_KEY, JSON.stringify(pending));
    setOpen(false);
    setTitle('');
    navigate(`/editor?saveToLecture=${lectureId}&courseId=${courseId}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus size={14} /> Add tree
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Name this lesson tree</DialogTitle>
          <DialogDescription>Give it a title now — you'll build the diagram next.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tree-title">Title</Label>
            <Input
              id="tree-title"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Example 1 — Wh-movement"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!title.trim()}>
              Continue to build tree →
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
