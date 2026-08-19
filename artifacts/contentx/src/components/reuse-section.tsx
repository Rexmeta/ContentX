import { usePlanWorkflow, WorkflowPlanInputOutputType } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { outputTypes } from "@/components/intent-selector";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Reuse/Transform UX (P2): from a result or content detail, spin the same
 * material into another output. Picking a type asks the Workflow Planner for
 * a recommended workflow prefilled with the source description.
 *
 * When `existingArtifacts` is supplied the planner pre-marks steps that
 * produced those artifacts as complete, so the new workflow starts from the
 * first un-covered step instead of repeating work.
 */
export function ReuseSection({
  sourceDescription,
  excludeOutputType,
  existingArtifacts,
  compact = false,
}: {
  /** Text carried into the new workflow's intent (idea/product summary). */
  sourceDescription: string;
  /** The output type already produced — hidden from the suggestions. */
  excludeOutputType?: string;
  /** Artifact key → resource id from the current workflow. Passed to the
   *  planner so it can skip steps already completed. */
  existingArtifacts?: Record<string, string>;
  compact?: boolean;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const planWorkflow = usePlanWorkflow();
  const [pendingType, setPendingType] = useState<string | null>(null);

  const candidates = outputTypes.filter((t) => t.id !== excludeOutputType);

  const handlePick = (outputType: string) => {
    setPendingType(outputType);
    planWorkflow.mutate(
      {
        data: {
          outputType: outputType as WorkflowPlanInputOutputType,
          ...(sourceDescription.trim() ? { description: sourceDescription.trim() } : {}),
          ...(existingArtifacts && Object.keys(existingArtifacts).length
            ? { existingArtifacts }
            : {}),
        },
      },
      {
        onSuccess: (res) => setLocation(`/workflows/${res.id}`),
        onError: () => {
          setPendingType(null);
          toast({
            title: "워크플로 생성 실패",
            description: "잠시 후 다시 시도해주세요.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div data-testid="section-reuse">
      <h3 className={cn("font-bold mb-1", compact ? "text-sm" : "text-base")}>
        이 콘텐츠는 이렇게도 활용할 수 있어요
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        다른 결과물을 고르면 같은 내용으로 미리 채워진 새 워크플로를 추천해 드려요.
      </p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((type) => {
          const isPending = planWorkflow.isPending && pendingType === type.id;
          return (
            <button
              key={type.id}
              onClick={() => handlePick(type.id)}
              disabled={planWorkflow.isPending || !type.supported}
              title={!type.supported ? "이 결과물은 아직 준비 중이에요." : type.desc}
              data-testid={`button-reuse-${type.id}`}
              className={cn(
                "flex items-center gap-1.5 border border-border rounded-full px-4 py-2 text-sm bg-card transition-colors min-h-9",
                type.supported
                  ? "hover:border-primary hover:text-primary"
                  : "opacity-50 cursor-not-allowed",
              )}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <type.icon className="h-3.5 w-3.5" />
              )}
              {type.label}
              {!type.supported && (
                <span className="tech-label rounded-full border border-border bg-muted px-2 py-px text-muted-foreground">
                  준비 중
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
