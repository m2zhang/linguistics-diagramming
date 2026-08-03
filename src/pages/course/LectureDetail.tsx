import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ExternalLink, GitBranch, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { BackButton } from '../../components/ui/back-button';
import { MaterialUpload } from '../../components/lecture/MaterialUpload';
import { AddTreeDialog } from '../../components/lecture/AddTreeDialog';
import { deleteLecture, deleteLectureTree, getLecture, type LectureDetail as LectureDetailData } from '../../data/lectures';
import { useTreeStore } from '../../store/treeStore';
import { EMPTY_ANNOTATIONS, cloneWithNewIds } from '../../model/types';
import { useUiStore } from '../../store/uiStore';
import { primeEditorSession } from '../../hooks/usePersistence';
import type { CourseOutletContext } from './CourseShell';

export function LectureDetail() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const { course, role } = useOutletContext<CourseOutletContext>();
  const [lecture, setLecture] = useState<LectureDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useUiStore((s) => s.toast);
  const navigate = useNavigate();

  const refresh = () => {
    if (!lectureId) return;
    setError(null);
    getLecture(lectureId)
      .then(setLecture)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load lecture'));
  };

  useEffect(refresh, [lectureId]);

  const openTreeInEditor = (tree: LectureDetailData['trees'][number]) => {
    const state = tree.content;
    const cloned = state.tree ? cloneWithNewIds(state.tree) : null;
    const annotations = state.annotations ?? EMPTY_ANNOTATIONS;
    useTreeStore.getState().replaceTree(cloned);
    useTreeStore.getState().setAnnotations(annotations);
    primeEditorSession(cloned, annotations);
    // viewLecture (not saveToLecture — that's the "author a brand-new tree"
    // flow) tells the editor's back button where to return to.
    navigate(`/editor?viewLecture=${lecture!.id}&courseId=${course.id}`);
  };

  const onDeleteTree = async (treeId: string) => {
    try {
      await deleteLectureTree(treeId);
      setLecture((prev) => (prev ? { ...prev, trees: prev.trees.filter((t) => t.id !== treeId) } : prev));
    } catch {
      toast('Could not delete tree', 'error');
    }
  };

  const onDeleteLecture = async () => {
    if (!lectureId) return;
    setDeleting(true);
    try {
      await deleteLecture(lectureId);
      toast('Lecture deleted', 'success');
      navigate(`/courses/${course.id}/lectures`);
    } catch {
      toast('Could not delete lecture', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <div>
        <p className="text-sm text-danger">{error}</p>
        <BackButton to={`/courses/${course.id}/lectures`} label="Back to lectures" className="mt-3" />
      </div>
    );
  }

  if (!lecture) {
    return <p className="text-sm text-text-dim">Loading…</p>;
  }

  return (
    <div>
      <BackButton to={`/courses/${course.id}/lectures`} label="Back to lectures" className="mb-4" />

      <div className="mb-6 flex items-start justify-between gap-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">{lecture.title}</h2>
        {role === 'instructor' && (
          <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
            <Trash2 size={14} /> Delete lecture
          </Button>
        )}
      </div>

      {lecture.notes && (
        <Card className="mb-4">
          <CardContent className="pt-4 whitespace-pre-wrap text-sm text-text">{lecture.notes}</CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Lesson trees</CardTitle>
          {role === 'instructor' && <AddTreeDialog lectureId={lecture.id} courseId={course.id} />}
        </CardHeader>
        <CardContent>
          {lecture.trees.length === 0 ? (
            <p className="text-sm text-text-dim">No trees shared for this lecture yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {lecture.trees.map((tree) => (
                <div
                  key={tree.id}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-bg-input px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <GitBranch size={15} className="shrink-0 text-text-faint" />
                    <span className="truncate">{tree.title}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button size="sm" onClick={() => openTreeInEditor(tree)}>
                      <ExternalLink size={14} /> Open
                    </Button>
                    {role === 'instructor' && (
                      <Button variant="destructive" size="sm" title="Delete" onClick={() => onDeleteTree(tree.id)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Materials</CardTitle>
        </CardHeader>
        <CardContent>
          <MaterialUpload lectureId={lecture.id} canManage={role === 'instructor'} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${lecture.title}"?`}
        description="This removes its trees and materials too. This can't be undone."
        confirmLabel="Delete"
        destructive
        confirming={deleting}
        onConfirm={onDeleteLecture}
      />
    </div>
  );
}
