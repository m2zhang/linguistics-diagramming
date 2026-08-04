import { useEffect, useRef, useState } from 'react';
import { Download, File as FileIcon, Trash2, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import {
  deleteMaterial,
  listLectureMaterials,
  materialDownloadUrl,
  uploadMaterial,
  type Material,
} from '../../data/materials';
import { useUiStore } from '../../store/uiStore';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MaterialUpload({ lectureId, canManage }: { lectureId: string; canManage: boolean }) {
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useUiStore((s) => s.toast);

  useEffect(() => {
    listLectureMaterials(lectureId)
      .then(setMaterials)
      .catch(() => toast('Could not load materials', 'error'));
  }, [lectureId, toast]);

  const onFileChosen = async (file: File) => {
    setUploading(true);
    try {
      const material = await uploadMaterial(lectureId, file);
      setMaterials((prev) => [...(prev ?? []), material]);
      toast('Material uploaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  // The bucket is private, so the URL has to be minted on demand rather than
  // living in an href.
  const onDownload = async (materialId: string) => {
    try {
      window.open(await materialDownloadUrl(materialId), '_blank', 'noopener,noreferrer');
    } catch {
      toast('Could not open that file', 'error');
    }
  };

  const onDelete = async (materialId: string) => {
    try {
      await deleteMaterial(materialId);
      setMaterials((prev) => prev?.filter((m) => m.id !== materialId) ?? prev);
    } catch {
      toast('Could not delete material', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {materials?.length === 0 && !canManage && (
        <p className="text-sm text-text-dim">No materials shared for this lecture yet.</p>
      )}

      {materials?.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-bg-input px-3 py-2 text-sm"
        >
          <div className="flex min-w-0 items-center gap-2">
            <FileIcon size={15} className="shrink-0 text-text-faint" />
            <span className="truncate">{m.originalName}</span>
            <span className="shrink-0 text-xs text-text-faint">{formatSize(m.sizeBytes)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" title="Download" onClick={() => onDownload(m.id)}>
              <Download size={14} />
            </Button>
            {canManage && (
              <Button variant="destructive" size="sm" title="Delete" onClick={() => onDelete(m.id)}>
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        </div>
      ))}

      {canManage && (
        <div>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFileChosen(e.target.files[0])}
          />
          <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
            <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload material'}
          </Button>
        </div>
      )}
    </div>
  );
}
