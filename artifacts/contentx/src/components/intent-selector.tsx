import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlanWorkflow } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { 
  Film, BookOpen, MessageSquare, LineChart, Gamepad2, Megaphone, Repeat, Sparkles, Send, Workflow
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { WorkflowPlanInputOutputType } from "@workspace/api-client-react";

export const outputTypes = [
  { id: "movie", label: "영화 이야기", icon: Film, supported: false, desc: "시나리오 및 세계관 설계" },
  { id: "novel", label: "소설", icon: BookOpen, supported: true, desc: "등장인물과 서사 구조" },
  { id: "roleplay", label: "롤플레이", icon: MessageSquare, supported: true, desc: "인터랙티브 대화 시나리오" },
  { id: "product-reaction", label: "제품 반응 시뮬레이션", icon: LineChart, supported: true, desc: "가상 인구의 반응 테스트" },
  { id: "game", label: "게임 콘텐츠", icon: Gamepad2, supported: false, desc: "퀘스트 및 아이템 설정" },
  { id: "advertisement", label: "광고 콘텐츠", icon: Megaphone, supported: false, desc: "타겟 마케팅 시나리오" },
  { id: "remix", label: "콘텐츠 조합", icon: Repeat, supported: false, desc: "기존 콘텐츠의 변형" },
  { id: "external-transform", label: "외부 콘텐츠 재구성", icon: Sparkles, supported: false, desc: "외부 IP 융합" },
];

export function IntentSelector({ isHome = false }: { isHome?: boolean }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const planWorkflow = usePlanWorkflow();
  const [description, setDescription] = useState("");

  const handleSelect = (outputType: string) => {
    planWorkflow.mutate(
      { data: { outputType: outputType as WorkflowPlanInputOutputType } },
      {
        onSuccess: (res) => {
          setLocation(`/workflows/${res.id}`);
        },
        onError: () => {
          toast({
            title: "워크플로 생성 실패",
            description: "시스템에 문제가 발생했습니다.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleNaturalLanguageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    planWorkflow.mutate(
      { data: { description } },
      {
        onSuccess: (res) => {
          setLocation(`/workflows/${res.id}`);
        },
        onError: () => {
          toast({
            title: "워크플로 생성 실패",
            description: "시스템에 문제가 발생했습니다.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <div className={cn("w-full max-w-4xl mx-auto flex flex-col items-center justify-center px-4 md:px-0", isHome ? "py-12 md:py-24" : "py-12")}>
      <h1 className="headline-display mb-4 text-center">무엇을 만들고 싶으세요?</h1>
      <p className="text-muted-foreground mb-8 md:mb-12 text-center max-w-lg">
        원하는 결과물을 선택하거나 자유롭게 설명해주세요. ContentX가 필요한 단계들을 구성해 드립니다.
      </p>

      <form onSubmit={handleNaturalLanguageSubmit} className="w-full max-w-2xl mb-8 md:mb-12 relative group">
        <div className="absolute -inset-0.5 bg-primary/20 opacity-0 group-focus-within:opacity-100 blur transition duration-300 rounded-full"></div>
        <div className="relative flex items-center bg-card border border-border rounded-full shadow-sm focus-within:ring-1 focus-within:ring-primary transition-all pl-2">
          <Input 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="어떤 콘텐츠를 구상 중인지 자유롭게 적어보세요..." 
            className="border-0 shadow-none focus-visible:ring-0 text-base py-6 px-4 bg-transparent"
          />
          <Button 
            type="submit" 
            size="icon"
            className="mr-2 shrink-0 h-10 w-10"
            disabled={!description.trim() || planWorkflow.isPending}
          >
            {planWorkflow.isPending ? <Workflow className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {outputTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => handleSelect(type.id)}
            disabled={planWorkflow.isPending || !type.supported}
            aria-disabled={!type.supported}
            title={!type.supported ? "이 결과물은 아직 준비 중이에요." : undefined}
            className={cn(
              "flex flex-col items-start p-5 text-left rounded-xl border bg-card transition-all focus:outline-none focus:ring-2 focus:ring-primary relative overflow-hidden group",
              type.supported
                ? "hover:bg-muted/30"
                : "opacity-60 cursor-not-allowed"
            )}
            data-testid={`card-output-${type.id}`}
          >
            <div className="mb-4 p-2 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform">
              <type.icon className="h-5 w-5" />
            </div>
            <h3 className="font-bold mb-1 flex items-center gap-2">
              {type.label}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {type.desc}
            </p>
            {!type.supported && (
              <div className="mt-4 inline-block px-2.5 py-0.5 text-[10px] font-mono border border-border bg-muted rounded-full text-muted-foreground uppercase tracking-wider">
                준비 중
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
