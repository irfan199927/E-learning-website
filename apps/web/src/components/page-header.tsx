import { Icon, type IconName } from "@/components/icons";

/**
 * Title block for the main screens: an icon chip in the sidebar's icon for that screen, the title, one line
 * of intro, and optional actions on the right (they wrap below on phones).
 */
export function PageHeader({
  icon,
  title,
  intro,
  children,
}: {
  icon: IconName;
  title: React.ReactNode;
  intro?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-fg-strong"
          aria-hidden="true"
        >
          <Icon name={icon} size={24} />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          {intro && <p className="mt-1 text-muted">{intro}</p>}
        </div>
      </div>
      {children}
    </header>
  );
}
