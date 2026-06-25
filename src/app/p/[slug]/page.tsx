import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPublicRoadmap } from "@/lib/public-roadmap";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";

type PublicRoadmapPageProps = {
  params: Promise<{ slug: string }>;
};

const columns = [
  { status: "TODO", label: "Planned" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "IN_REVIEW", label: "In review" },
  { status: "DONE", label: "Completed" },
] as const;

export default async function PublicRoadmapPage({
  params,
}: PublicRoadmapPageProps) {
  const { slug } = await params;
  const requestHeaders = await headers();
  const rateLimit = await checkRateLimit({
    key: `public-roadmap-page:${getRequestIp(requestHeaders)}`,
    limit: 30,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
        <section className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">Too many requests</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This roadmap has been requested too frequently. Please try again shortly.
          </p>
        </section>
      </main>
    );
  }

  const roadmap = await getPublicRoadmap(slug);

  if (!roadmap) {
    notFound();
  }

  const completedPercentage =
    roadmap.progress.total === 0
      ? 0
      : Math.round((roadmap.progress.byStatus.done / roadmap.progress.total) * 100);

  return (
    <main className="min-h-screen bg-muted/30 text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="font-semibold">
            DevBoard
          </Link>
          <span className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
            Public roadmap
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
        <section className="border-b pb-8">
          <p className="text-sm font-medium text-muted-foreground">Product roadmap</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
            {roadmap.project.name}
          </h1>
          {roadmap.project.description ? (
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              {roadmap.project.description}
            </p>
          ) : null}

          <div className="mt-8 max-w-3xl">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall progress</span>
              <span className="text-muted-foreground">
                {roadmap.progress.byStatus.done} of {roadmap.progress.total} completed
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${completedPercentage}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ProgressMetric label="Planned" value={roadmap.progress.byStatus.todo} />
              <ProgressMetric
                label="In progress"
                value={roadmap.progress.byStatus.inProgress}
              />
              <ProgressMetric label="Review" value={roadmap.progress.byStatus.review} />
              <ProgressMetric label="Completed" value={roadmap.progress.byStatus.done} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 py-8 lg:grid-cols-4">
          {columns.map((column) => {
            const issues = roadmap.issues.filter(
              (issue) => issue.status === column.status,
            );

            return (
              <section key={column.status} aria-labelledby={`column-${column.status}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 id={`column-${column.status}`} className="text-sm font-semibold">
                    {column.label}
                  </h2>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs">
                    {issues.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {issues.length === 0 ? (
                    <div className="rounded-md border border-dashed bg-background/60 px-3 py-8 text-center text-sm text-muted-foreground">
                      No items
                    </div>
                  ) : (
                    issues.map((issue) => (
                      <article
                        key={`${issue.key}-${issue.createdAt}`}
                        className="rounded-md border bg-background p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {issue.key}
                          </p>
                          <span className="rounded-md border px-2 py-0.5 text-[11px] font-medium">
                            {issue.priority}
                          </span>
                        </div>
                        <h3 className="mt-3 text-sm font-semibold leading-5">
                          {issue.title}
                        </h3>
                        {issue.labels.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {issue.labels.map((label) => (
                              <span
                                key={label}
                                className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </section>
      </div>

      <footer className="border-t bg-background">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 py-3 text-xs text-muted-foreground sm:px-8">
          <span>
            Updated{" "}
            {new Intl.DateTimeFormat("en", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date(roadmap.lastUpdatedAt))}
          </span>
          <Link href="/" className="font-medium text-foreground hover:underline">
            Powered by DevBoard
          </Link>
        </div>
      </footer>
    </main>
  );
}

function ProgressMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background px-3 py-3">
      <p className="text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
