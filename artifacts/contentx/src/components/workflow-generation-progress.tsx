import type { WorkflowStep } from "@workspace/api-client-react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ClipboardList,
  Eye,
  Loader2,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SENSITIVE_KEY =
  /(?:chain.?of.?thought|reasoning|thinking|prompt|internal|provider.?trace)/i;

function sanitizePreviewValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[깊은 내용 생략]";
  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => sanitizePreviewValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY.test(key))
        .slice(0, 20)
        .map(([key, item]) => [
          key,
          sanitizePreviewValue(item, depth + 1),
        ]),
    );
  }
  return value;
}

function previewValue(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 1_200);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "없음";
  try {
    return (
      JSON.stringify(sanitizePreviewValue(value), null, 2) ?? String(value)
    ).slice(0, 1_200);
  } catch {
    return String(value).slice(0, 1_200);
  }
}

function previewDetails(value?: Record<string, unknown> | null) {
  if (!value) return [];
  return Object.entries(value)
    .filter(([key, item]) => !SENSITIVE_KEY.test(key) && item !== undefined)
    .slice(0, 8)
    .map(([label, item]) => ({ label, value: previewValue(item) }));
}

const CHECKPOINT_META = {
  input: { label: "사용한 입력", icon: ClipboardList },
  preview: { label: "중간 결과", icon: Eye },
  validation: { label: "검증 결과", icon: ShieldCheck },
  handoff: { label: "다음 단계 전달", icon: ArrowRight },
  review: { label: "검토 수정", icon: MessageSquare },
} as const;

export function WorkflowGenerationProgress({
  progress,
  testId,
  result,
  inputParams,
}: {
  progress: WorkflowStep["progress"];
  testId: string;
  result?: Record<string, unknown> | null;
  inputParams?: Record<string, unknown> | null;
}) {
  const checkpoints = [...(progress?.checkpoints ?? [])];
  if (
    inputParams &&
    !checkpoints.some((checkpoint) => checkpoint.kind === "input")
  ) {
    const details = previewDetails(inputParams);
    if (details.length > 0) {
      checkpoints.unshift({
        kind: "input",
        title: "이번 단계에 사용한 내용",
        summary: "이 단계에 저장된 입력값입니다.",
        details,
        at: progress?.startedAt ?? new Date(0).toISOString(),
      });
    }
  }
  if (
    result &&
    !checkpoints.some((checkpoint) => checkpoint.kind === "preview")
  ) {
    const details = previewDetails(result);
    if (details.length > 0) {
      checkpoints.push({
        kind: "preview",
        title: "이 단계에서 만들어진 결과",
        summary: "저장된 단계 결과를 확인할 수 있습니다.",
        details,
        at: progress?.updatedAt ?? new Date(0).toISOString(),
      });
    }
  }

  if (!progress?.events.length && checkpoints.length === 0) return null;

  return (
    <div className="mt-3 space-y-3" data-testid={testId}>
      {!!progress?.events.length && (
        <ol className="space-y-2">
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
      )}

      {checkpoints.length > 0 && (
        <div className="space-y-2" data-testid={`${testId}-checkpoints`}>
          {checkpoints.map((checkpoint, index) => {
            const meta = CHECKPOINT_META[checkpoint.kind];
            const Icon = meta.icon;
            return (
              <details
                key={`${checkpoint.kind}-${checkpoint.at}-${index}`}
                className="group rounded-lg border border-border/70 bg-background/70"
                open={index === checkpoints.length - 1}
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                    {meta.label}
                  </span>
                  <span className="truncate">{checkpoint.title}</span>
                </summary>
                <div className="space-y-2 border-t border-border/60 px-3 py-3">
                  <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {checkpoint.summary}
                  </p>
                  {checkpoint.details.length > 0 && (
                    <dl className="grid gap-2 sm:grid-cols-2">
                      {checkpoint.details.map((detail, detailIndex) => (
                        <div
                          key={`${detail.label}-${detailIndex}`}
                          className="rounded-md bg-muted/30 p-2.5"
                        >
                          <dt className="mb-1 text-[10px] font-mono text-muted-foreground">
                            {detail.label}
                          </dt>
                          <dd className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                            {detail.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}