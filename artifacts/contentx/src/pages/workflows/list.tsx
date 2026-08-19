import { Layout } from "@/components/layout";
import { useListWorkflows, useDeleteWorkflow } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { MoreVertical, Play, Trash2, Plus, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListWorkflowsQueryKey } from "@workspace/api-client-react";

export default function WorkflowsList() {
  const { data: workflows, isLoading } = useListWorkflows();
  const [, setLocation] = useLocation();
  const deleteWorkflow = useDeleteWorkflow();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("정말 이 워크플로를 삭제하시겠습니까?")) return;
    
    deleteWorkflow.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "워크플로가 삭제되었습니다." });
        queryClient.invalidateQueries({ queryKey: getListWorkflowsQueryKey() });
      },
      onError: () => {
        toast({ title: "삭제 실패", variant: "destructive" });
      }
    });
  };

  // A workflow whose stored status is "running" is only ACTIVELY executing
  // when one of its steps is currently running; otherwise it is simply
  // in progress and waiting for the user to continue. Showing a spinner for
  // the latter makes an idle workflow look stuck.
  const isActivelyExecuting = (workflow: { status: string; steps: { status: string }[] }) =>
    workflow.status === 'running' && workflow.steps.some(s => s.status === 'running');

  const getStatusIcon = (workflow: { status: string; steps: { status: string }[] }) => {
    switch (workflow.status) {
      case 'complete': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'running':
        return isActivelyExecuting(workflow)
          ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
          : <Clock className="h-4 w-4 text-primary" />;
      case 'draft': return <Clock className="h-4 w-4 text-muted-foreground" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (workflow: { status: string; steps: { status: string }[] }) => {
    switch (workflow.status) {
      case 'complete': return "완료됨";
      case 'failed': return "실패";
      case 'running': return isActivelyExecuting(workflow) ? "실행 중" : "이어서 진행";
      case 'draft': return "대기 중";
      default: return workflow.status;
    }
  };

  return (
    <Layout 
      breadcrumbs={[{ label: "내 작업" }]}
      title={
        <Button onClick={() => setLocation('/')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          새 워크플로
        </Button>
      }
    >
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="headline-lg">작업 보관함</h1>
          <p className="text-muted-foreground mt-1">생성 중이거나 완료된 모든 워크플로를 관리합니다.</p>
        </div>

        <div className="border border-border bg-card rounded-xl overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>상태</TableHead>
                <TableHead>제목</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>진행률</TableHead>
                <TableHead>업데이트</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    불러오는 중...
                  </TableCell>
                </TableRow>
              ) : workflows?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    <div className="font-semibold text-foreground mb-1">무엇부터 만들어볼까요?</div>
                    <div className="text-xs mb-4">아직 작업 내역이 없어요. 예시로 시작하거나 새로 만들어보세요.</div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button asChild size="sm" data-testid="button-empty-example">
                        <Link href="/examples">예시로 시작하기</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" data-testid="button-empty-create">
                        <Link href="/">새로 만들기</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : workflows?.map((workflow) => {
                const completedSteps = workflow.steps.filter(s => s.status === 'complete' || s.status === 'skipped').length;
                const totalSteps = workflow.steps.length;
                const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

                return (
                  <TableRow 
                    key={workflow.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setLocation(`/workflows/${workflow.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(workflow)}
                        <span className="text-sm">{getStatusText(workflow)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{workflow.title}</TableCell>
                    <TableCell>
                      <span className="text-xs font-mono px-2 py-1 bg-muted rounded-full text-muted-foreground">
                        {workflow.intent.outputType || 'custom'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {completedSteps}/{totalSteps}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(workflow.updatedAt), { addSuffix: true, locale: ko })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/workflows/${workflow.id}`)}>
                            <Play className="h-4 w-4 mr-2" /> 이어서 하기
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => handleDelete(workflow.id, e)}>
                            <Trash2 className="h-4 w-4 mr-2" /> 삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
