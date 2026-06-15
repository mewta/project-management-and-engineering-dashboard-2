import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-12">
      <section className="w-full max-w-md rounded-lg border bg-background p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
            DevBoard
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Create account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start with an account, then create your first organization.
          </p>
        </div>
        <SignupForm />
      </section>
    </main>
  );
}
