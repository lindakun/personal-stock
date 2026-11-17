import { Plus } from 'lucide-react';

export type WorkspaceView = 'workbench' | 'portfolio' | 'compare';

interface TopBarProps {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  onOpenAddStock: () => void;
}

export function TopBar({ activeView, onSelectView, onOpenAddStock }: TopBarProps) {
  const navItems: Array<{ id: WorkspaceView; label: string }> = [
    { id: 'workbench', label: '行情推演' },
    { id: 'portfolio', label: '组合沙盘' },
    { id: 'compare', label: '方案对比' },
  ];

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 lg:px-6 flex items-center justify-between gap-8 shrink-0">
      {/* Zone 1: Brand wordmark */}
      <button
        type="button"
        onClick={() => onSelectView('workbench')}
        className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 font-display whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
      >
        观潮推演
      </button>

      {/* Zone 2: Primary navigation links */}
      <nav aria-label="主工作区导航" className="flex items-center gap-6 h-full">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`relative h-full flex items-center text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isActive
                  ? 'text-slate-900 dark:text-slate-50'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {item.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-500" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Primary CTA */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={onOpenAddStock}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>添加股票</span>
        </button>
      </div>
    </header>
  );
}
