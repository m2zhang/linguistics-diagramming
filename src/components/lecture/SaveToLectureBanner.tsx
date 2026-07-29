import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { BackButton } from '../ui/back-button';
import { addLectureTree } from '../../data/lectures';
import { useTreeStore } from '../../store/treeStore';
import { currentProjectState } from '../../export/projectState';
import { useUiStore } from '../../store/uiStore';

/** Shown over the editor when it was opened from a lecture's "+ Add tree"
 *  button (/editor?saveToLecture=<id>&courseId=<id>) — lets the instructor
 *  build a tree with the normal canvas, then save it back to that lecture
 *  as a lesson tree instead of just exporting/downloading it. */
export function SaveToLectureBanner() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const lectureId = params.get('saveToLecture');
  const courseId = params.get('courseId');
  if (!lectureId) return null;

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    const tree = useTreeStore.getState().tree;
    if (!tree) {
      toast('Build a tree first', 'error');
      return;
    }
    setSaving(true);
    try {
      await addLectureTree(lectureId, { title, content: currentProjectState(tree) });
      toast('Saved to lecture', 'success');
      navigate(courseId ? `/courses/${courseId}/lectures/${lectureId}` : '/dashboard');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save tree', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-[var(--radius)] border border-accent bg-bg-panel px-3 py-2 shadow-[var(--shadow)]">
      <span className="text-xs font-semibold text-text-dim">Saving to lecture:</span>
      <form onSubmit={onSave} className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tree title, e.g. Example 1"
          required
          className="h-8 w-56"
        />
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save as lesson tree'}
        </Button>
      </form>
      <BackButton to={courseId ? `/courses/${courseId}/lectures/${lectureId}` : '/dashboard'} label="Lecture" />
    </div>
  );
}
