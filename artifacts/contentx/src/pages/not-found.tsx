import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-4">
      <div className="flex max-w-md flex-col items-center text-center p-6 md:p-8 border border-border bg-card rounded-xl shadow-lg">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="headline-display text-foreground mb-2">404</h1>
        <p className="text-muted-foreground mb-6 font-mono text-sm">Target sector not found in Content Graph.</p>
        <Link href="/" className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none disabled:pointer-events-none disabled:opacity-50">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
