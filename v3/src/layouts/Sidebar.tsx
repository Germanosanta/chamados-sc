import { NavLink } from 'react-router-dom';
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/utils/cn';
import { NAV_BOTTOM, NAV_GROUPS, NAV_TOP, type NavItem } from '@/utils/sections';
import { useSessionStore } from '@/store/session';
import { useUiStore } from '@/store/ui';
import logo from '@/assets/img/coa.jpeg';

function Item({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const temPermissao = useSessionStore((s) => s.temPermissao);
  if (item.perm && !temPermissao(item.perm)) return null;

  return (
    <NavLink
      to={`/${item.id}`}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-base font-medium text-muted-foreground transition-colors',
          'hover:bg-muted hover:text-foreground',
          isActive && 'bg-primary-light text-primary-text font-semibold',
          collapsed && 'justify-center px-0',
        )
      }
      title={collapsed ? item.label : undefined}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40', collapsed && 'hidden')} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && <span className="text-sm">{item.label.slice(0, 2)}</span>}
    </NavLink>
  );
}

function Group({ label, items, collapsed }: { label: string; items: NavItem[]; collapsed: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-0.5">
      {!collapsed && (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center justify-between px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-subtle"
        >
          {label}
          <ChevronDown className={cn('h-3 w-3 transition-transform', !open && '-rotate-90')} />
        </button>
      )}
      {(open || collapsed) && (
        <div className="flex flex-col gap-0.5">
          {items.map((it) => (
            <Item key={it.id} item={it} collapsed={collapsed} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ inSheet = false }: { inSheet?: boolean }) {
  const collapsed = useUiStore((s) => !inSheet && s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebarCollapsed);

  return (
    <aside className={cn('flex h-full flex-col border-r border-border bg-surface', collapsed ? 'w-16' : 'w-64')}>
      <div className={cn('flex items-center gap-2.5 border-b border-border p-3', collapsed && 'justify-center px-0')}>
        <img src={logo} alt="Santa Colomba" className="h-8 w-8 shrink-0 rounded-sm object-cover" />
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground">Central de Chamados</div>
            <div className="truncate text-xs text-subtle">Santa Colomba · V3</div>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-2.5">
        <div className="flex flex-col gap-0.5">
          {NAV_TOP.map((it) => (
            <Item key={it.id} item={it} collapsed={collapsed} />
          ))}
        </div>
        {NAV_GROUPS.map((g) => (
          <Group key={g.label} label={g.label} items={g.items} collapsed={collapsed} />
        ))}
        <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-2.5">
          {NAV_BOTTOM.map((it) => (
            <Item key={it.id} item={it} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {!inSheet && (
        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="flex items-center justify-center gap-2 border-t border-border p-2.5 text-sm text-muted-foreground hover:bg-muted"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && 'Recolher'}
        </button>
      )}
    </aside>
  );
}
