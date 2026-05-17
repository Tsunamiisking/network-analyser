import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, BarChart2, Wifi, X } from 'lucide-react';
import { cn } from '../lib/utils';

const NAV = [
  { to: '/',          label: 'Overview',  Icon: LayoutDashboard },
  { to: '/reports',   label: 'Reports',   Icon: FileText },
  { to: '/analytics', label: 'Analytics', Icon: BarChart2 },
];

export default function Sidebar({ open, onClose }) {
  return (
    <aside
      className={cn(
        'flex flex-col w-64 md:w-60 min-h-screen border-r shrink-0',
        // Mobile: fixed off-screen; slide in when open. Desktop: static in flow.
        'fixed md:static z-30',
        'transition-transform duration-200 ease-in-out md:transition-none',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}
      style={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
        <Wifi size={20} className="text-blue-600" />
        <span className="font-semibold text-sm text-gray-900">NetAnalyser</span>
        <span className="ml-auto text-xs text-gray-400 font-mono">Admin</span>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden ml-2 p-1 rounded text-gray-400 hover:text-gray-600"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t text-xs text-gray-400" style={{ borderColor: 'hsl(var(--border))' }}>
        Nigerian Network Monitor
      </div>
    </aside>
  );
}
