import { type LucideIcon, Lightbulb, PlusSquare, Download } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Action-suggesting empty state (P2 empty-state rule): never a bare "No X".
 * Always offers Example 시작 / 새로 만들기 / 가져오기.
 */
export function EmptyState({
  icon: Icon,
  title = "무엇부터 만들어볼까요?",
  hint,
}: {
  icon: LucideIcon;
  title?: string;
  hint?: string;
}) {
  return (
    <div
      className="col-span-full flex flex-col items-center justify-center border border-dashed border-border p-12 text-center text-muted-foreground bg-muted/10"
      data-testid="empty-state"
    >
      <Icon className="h-8 w-8 mb-3 opacity-50" />
      <h3 className="font-bold mb-1 text-foreground">{title}</h3>
      {hint && <p className="text-xs max-w-sm mb-1">{hint}</p>}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        <Button asChild size="sm" data-testid="button-empty-example">
          <Link href="/examples">
            <Lightbulb className="h-4 w-4 mr-2" /> 예시로 시작하기
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" data-testid="button-empty-create">
          <Link href="/create">
            <PlusSquare className="h-4 w-4 mr-2" /> 새로 만들기
          </Link>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" variant="outline" disabled data-testid="button-empty-import">
                <Download className="h-4 w-4 mr-2" /> 가져오기 (준비 중)
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>외부 콘텐츠 가져오기는 곧 지원될 예정이에요.</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
