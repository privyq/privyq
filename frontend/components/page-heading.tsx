export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-blue">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-base text-muted">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
