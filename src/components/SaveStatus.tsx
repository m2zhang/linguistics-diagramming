import { useFileStore } from '../store/fileStore';

const LABELS: Record<string, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: 'Offline — changes not saved',
};

/** Compact "Saving… / All changes saved / Offline" indicator for the toolbar. */
export function SaveStatus() {
  const status = useFileStore((s) => s.saveStatus);
  const label = LABELS[status];
  if (!label) return null;
  return <span className={`save-status save-status-${status}`}>{label}</span>;
}
