import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  badge: string;
  title: string;
  body: string;
}

export function EmptyState({ icon, badge, title, body }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-blue-600/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
        {icon}
      </div>
      <span className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {badge}
      </span>
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-500 dark:text-slate-400">
        {body}
      </p>
    </div>
  );
}
