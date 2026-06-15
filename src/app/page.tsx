import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-20">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          DevBoard
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Real-time project management for small engineering teams.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          Track organizations, projects, issues, assignments, comments, activity,
          and sprint analytics in one deployable full-stack Next.js app.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md border px-5 text-sm font-medium"
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
