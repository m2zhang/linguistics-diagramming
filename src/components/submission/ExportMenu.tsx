import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { ExportFormat } from '../../lib/exportSubmission';

export function ExportMenu({
  label,
  onExport,
  disabled,
}: {
  label: string;
  onExport: (format: ExportFormat) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} onClick={(e) => e.stopPropagation()}>
          <Download size={14} /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => onExport('png')}>PNG</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport('pdf')}>PDF</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport('svg')}>SVG</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
