import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getGetAssessmentPackageVersionQueryKey, getGetAssessmentQueryKey, getListAssessmentPackagePublicationHistoryQueryKey, getListAssessmentsQueryKey, useCreateAssessmentPackageVersion, useListAssessments, type AssessmentPackageVersionCreateInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, ShieldCheck } from "lucide-react";
import { AssessmentVersionForm } from "./assessment-version-form";
import { trackEvent } from "@/lib/analytics";

export default function AssessmentsList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createVersion = useCreateAssessmentPackageVersion();
  const assessments = useListAssessments({ query: { queryKey: getListAssessmentsQueryKey() } });
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const create = (packageId: string, data: AssessmentPackageVersionCreateInput) => {
    createVersion.mutate({ id: packageId, data }, {
      onSuccess: (version) => {
        trackEvent("assessment_version_created", {
          version_number: version.version,
          scenario_count: data.scenarios.length,
          success: true,
        });
        queryClient.invalidateQueries({ queryKey: getListAssessmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAssessmentQueryKey(version.packageId) });
        queryClient.invalidateQueries({ queryKey: getGetAssessmentPackageVersionQueryKey(version.packageId, version.version) });
        queryClient.invalidateQueries({ queryKey: getListAssessmentPackagePublicationHistoryQueryKey(version.packageId) });
        setFormOpen(false);
        toast({ title: "불변 버전이 생성되었습니다", description: `v${version.version}은 이후 편집할 수 없습니다.` });
        setLocation(`/assessments/${version.packageId}?version=${version.version}`);
      },
      onError: (error) => {
        trackEvent("assessment_version_created", {
          version_number: data.version,
          scenario_count: data.scenarios.length,
          success: false,
        });
        toast({ variant: "destructive", title: "버전을 저장하지 못했습니다", description: error.message });
      },
    });
  };

  return (
    <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Assessments" }]} title={<Button data-testid="button-new-assessment" onClick={() => setFormOpen(true)}><PlusCircle className="h-4 w-4 mr-2" />새 평가</Button>}>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <section className="rounded-xl border bg-card p-5">
          <div className="flex gap-3"><ShieldCheck className="h-5 w-5 text-primary mt-0.5" /><div><h1 className="text-lg font-semibold">RoleplayX Assessment</h1><p className="text-sm text-muted-foreground mt-1">시나리오를 저장하면 immutable version이 생성됩니다. 생성 뒤 검증을 통과한 버전만 발행할 수 있습니다.</p></div></div>
        </section>
        {assessments.isLoading ? <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div> : assessments.error ? <div data-testid="status-assessments-error" className="rounded-xl border border-destructive/50 p-4 text-destructive">Assessment 목록을 불러오지 못했습니다.</div> : assessments.data?.length === 0 ? <div data-testid="status-assessments-empty" className="rounded-xl border p-8 text-center text-muted-foreground">저장된 평가가 없습니다. ‘새 평가’를 만들어 시작하세요.</div> : <div className="grid gap-3">{assessments.data?.map((item) => <Link data-testid={`card-assessment-${item.id}`} href={`/assessments/${item.id}?version=${item.currentVersion}`} key={item.id} className="rounded-xl border bg-card p-4 hover:border-primary"><div className="flex justify-between gap-3"><div><b>{item.title}</b><p className="text-sm text-muted-foreground">{item.description}</p></div><span className="text-xs font-mono">{item.status}</span></div><p className="mt-3 text-xs text-muted-foreground">{item.scenarioCount} scenarios · {item.competencyCount} competencies · v{item.currentVersion} · {item.latestTarget ? `${item.latestTarget.target} ${item.latestTarget.status}` : "발행 대상 없음"} · {new Date(item.updatedAt).toLocaleString()}</p></Link>)}</div>}
        <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>새 평가</DialogTitle></DialogHeader><section className="space-y-4">
          <div className="flex items-center gap-2"><PlusCircle className="h-5 w-5 text-primary" /><h2 className="font-semibold">새 assessment version</h2></div>
          <AssessmentVersionForm packageId="" version={1} showPackageId isPending={createVersion.isPending} onSubmit={create} />
        </section></DialogContent></Dialog>
      </div>
    </Layout>
  );
}