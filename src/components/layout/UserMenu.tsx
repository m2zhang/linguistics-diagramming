import { Link } from 'react-router-dom';
import { ChevronDown, Keyboard, LogOut, Shield, User } from 'lucide-react';
import { ProfileAvatar } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useAuthStore } from '../../store/authStore';

export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-1.5 outline-none transition-colors hover:bg-bg-input cursor-pointer border-none bg-transparent">
        <ProfileAvatar seed={user.id} name={user.displayName} className="h-7 w-7 ring-2 ring-bg-panel" />
        <ChevronDown size={13} className="text-text-faint" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 z-50">
        <DropdownMenuLabel>
          <div className="flex items-center gap-2.5">
            <ProfileAvatar seed={user.id} name={user.displayName} className="h-8 w-8" />
            <div className="min-w-0">
              <div className="truncate font-semibold text-text text-sm">{user.displayName}</div>
              <div className="font-normal capitalize text-text-dim text-xs">{user.role}</div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <User size={14} /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile?tab=security">
            <Shield size={14} /> Security
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile?tab=shortcuts">
            <Keyboard size={14} /> Keyboard shortcuts
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout()}>
          <LogOut size={14} /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
