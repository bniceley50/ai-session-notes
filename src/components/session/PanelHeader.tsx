import type { ReactNode } from "react";

type Props = {
  title: string;
  status?: ReactNode;
  actions?: ReactNode;
  testId?: string;
};

export function PanelHeader({ title, status, actions, testId }: Props) {
  return (
    <header data-testid={testId} className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        {status}
      </div>
      {actions}
    </header>
  );
}
