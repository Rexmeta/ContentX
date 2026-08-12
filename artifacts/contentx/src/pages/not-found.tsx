import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex max-w-md flex-col items-center text-center p-8 border border-border bg-card shadow-lg">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-3xl font-bold tracking-tight font-sans text-foreground mb-2">404</h1>
        <p className="text-muted-foreground mb-6 font-mono text-sm">Target sector not found in Content Graph.</p>
        <Link href="/" className="inline-flex h-10 items-center justify-center bg-primary px-6 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none disabled:pointer-events-none disabled:opacity-50">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
