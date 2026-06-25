import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DemoLoginButton({
  className,
  variant = "outline",
}: {
  className?: string;
  variant?: "default" | "outline";
}) {
  return (
    <form action="/api/auth/demo-login" method="post" className={className}>
      <Button
        type="submit"
        variant={variant}
        className="h-11 w-full"
      >
        <Play className="size-4" />
        Try Demo — no signup required
      </Button>
    </form>
  );
}
