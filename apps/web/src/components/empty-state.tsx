import { Icon, type IconName } from "./icons";

/** Nothing to show yet: an icon in a soft circle, the message, and optionally what to do next. */
export function EmptyState({
  icon,
  children,
  action,
}: {
  icon: IconName;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
      <span
        className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary-fg"
        aria-hidden="true"
      >
        <Icon name={icon} size={26} />
      </span>
      <p className="max-w-md text-muted">{children}</p>
      {action}
    </div>
  );
}
