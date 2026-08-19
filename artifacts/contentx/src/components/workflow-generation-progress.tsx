import type { WorkflowStep } from "@workspace/api-client-react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkflowGenerationProgress({
  progress,
  testId,
}: {
  progress: WorkflowStep["progress"];
  testId: string;
}) {
  if (!progress?.events.length) return null;

  return (
    <ol className="mt-3 space-y-2" data-testid={testId}>
      {progress.events.map((event, index) => (
        <li
          key={`${event.phase}-${index}`}
          className="grid grid-cols-[18px_1fr_auto] items-center gap-2 text-xs"
        >
          <span className="flex h-[18px] w-[18px] items-center justify-center">
            {event.status === "complete" ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : event.status === "failed" ? (
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            )}
          </span>
          <span
            className={cn(
              event.status === "running"
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {event.label}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {new Date(event.at).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}