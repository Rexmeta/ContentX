import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { EXAMPLES } from "@/lib/examples";
import { usePlanWorkflow, WorkflowPlanInputOutputType } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, Play, ChevronRight } from "lucide-react";

/**
 * Example Gallery (P2): executable examples, not documentation.
 * "Try this example" plans a prefilled workflow and jumps straight into it.
 */
export default function Examples() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const planWorkflow = usePlanWorkflow();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleTry = (exampleId: string) => {
    const example = EXAMPLES.find((e) => e.id === exampleId);
    if (!example || !example.supported) return;
    setPendingId(example.id);
    planWorkflow.mutate(
      {
        data: {
          outputType: example.outputType as WorkflowPlanInputOutputType,
          description: example.description,
        },
      },
      {
        onSuccess: (res) => setLocation(`/workflows/${res.id}`),
        onError: () => {
          setPendingId(null);
          toast({
            title: "예시 시작 실패",
            description: "잠시 후 다시 시도해주세요.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Layout breadcrumbs={[{ label: "예시", href: "/examples" }]}>
      <div className="p-6 max-w-5xl mx-auto space-y-8 pb-24">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">예시로 시작하기</h1>
          <p className="text-muted-foreground max-w-2xl">
            설명서를 읽는 대신, 미리 채워진 예시를 그대로 실행해보세요.
            시작하면 단계들이 준비된 워크플로가 열리고, 내용을 자유롭게 바꾼 뒤 실행할 수 있어요.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXAMPLES.map((example) => {
            const isPending = planWorkflow.isPending && pendingId === example.id;
            return (
              <div
                key={example.id}
                data-testid={`card-example-${example.id}`}
                className={cn(
                  "border bg-card flex flex-col",
                  example.supported ? "hover:border-primary/50 transition-colors" : "opacity-70",
                )}
              >
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-primary/10 rounded-sm text-primary">
                      <example.icon className="h-5 w-5" />
                    </div>
                    {!example.supported && (
                      <span
                        className="px-2 py-0.5 text-[10px] font-mono border border-border bg-muted text-muted-foreground uppercase tracking-wider"
                        data-testid={`badge-coming-soon-${example.id}`}
                      >
                        준비 중
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold mb-1">{example.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{example.summary}</p>

                  <div className="border-l-2 border-primary/20 pl-3 mb-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                      예시 입력
                    </div>
                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                      “{example.description}”
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {example.stepsPreview.map((step, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
                        <span className="bg-muted/50 px-1.5 py-0.5 rounded-sm">{step}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 border-t border-border bg-muted/10">
                  <Button
                    className="w-full"
                    disabled={!example.supported || planWorkflow.isPending}
                    onClick={() => handleTry(example.id)}
                    data-testid={`button-try-example-${example.id}`}
                    variant={example.supported ? "default" : "outline"}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    {example.supported ? "이 예시 실행해보기" : "곧 지원될 예정이에요"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
