# Outcome-First UX 아키텍처

> P1/P2 구현의 기준 문서. 현재 구현 기준의 감사(`current-ux-audit.md`)와 기능 매핑(`output-workflow-map.md`)을 전제로 한다.
> 스텝 모델·스키마는 **제안** 수준이며 확정은 P1에서 한다.

## 1. UX 철학

**AI recommends. User decides.**

```
USER INTENT → DESIRED OUTPUT → AI RECOMMENDED WORKFLOW
→ USER ADJUSTMENT (Add/Remove/Edit) → EXECUTION → OUTPUT → REUSE
```

- 사용자는 Entity/Graph/Projection을 몰라도 결과를 얻을 수 있어야 한다.
- Workflow ≠ Content. Workflow는 "어떤 작업을 어떤 순서로", Content는 그 결과물이다.
- Content Graph를 포함한 기존 엔진은 삭제·재작성하지 않고 Advanced 계층으로 이동해 유지한다.

## 2. Output Intent

Home의 단일 질문 — "무엇을 만들고 싶나요?" — 에 대해 두 방식의 입력을 받는다.

1. **선택형**: 🎬 영화 이야기 · 📖 소설 · 🎭 롤플레이 · 🚀 제품 반응 시뮬레이션 · 🎮 게임 콘텐츠 · 📢 광고 콘텐츠 · 🧩 콘텐츠 조합 · 📚 외부 콘텐츠 재구성 · ✨ 직접 설명하기
2. **자연어**: "새 AI 노트북 출시 반응이 궁금해요" → Intent 해석기가 Output 유형 + 필요 요소(제품, 타겟, 페르소나, 시나리오, 시뮬레이션, 분석)를 추출한다.

Intent 결과물(제안):

```ts
interface OutputIntent {
  outputType: "movie" | "novel" | "roleplay" | "product-reaction"
            | "game" | "advertisement" | "remix" | "external-transform";
  description: string;        // 사용자 원문
  extractedInputs: Record<string, string>; // 예: { product: "...", audience: "..." }
}
```

## 3. Workflow Planner

Intent → 추천 Workflow(스텝 목록) 생성. 각 Output 유형의 기본 템플릿은 `output-workflow-map.md`의 표를 그대로 사용하고, LLM이 extractedInputs로 스텝을 프리필·가지치기한다.

- AI는 추천할 뿐 강제하지 않는다. 생성 직후 사용자가 전체 목록을 검토·수정한 뒤 실행한다.
- 각 스텝은 기존 API 1개(또는 짧은 시퀀스)에 바인딩된다. 예: "가상 고객 만들기" → `POST /v1/sampling`.

## 4. Workflow Step 모델 (제안)

```ts
type StepType =
  | "input" | "generate" | "extract" | "analyze" | "transform"
  | "compose" | "remix" | "simulate" | "validate" | "compare"
  | "export" | "project";

type StepImportance = "required" | "recommended" | "optional"; // ✓ / ● / ○
type StepStatus = "pending" | "ready" | "running" | "complete" | "failed" | "skipped";

interface WorkflowStep {
  id: string;
  type: StepType;
  title: string;          // 사용자 용어 (§7 대응표 기준)
  description?: string;
  importance: StepImportance;
  input: string[];        // 참조하는 산출물 키 (예: "scenario", "populationId")
  output: string[];       // 생산하는 산출물 키
  status: StepStatus;
  dependencies: string[]; // 선행 스텝 id
  binding?: {             // 기존 기능 재사용 지점
    api: string;          // 예: "POST /v1/sampling"
    params?: Record<string, unknown>;
  };
}

interface Workflow {
  id: string;
  intent: OutputIntent;
  steps: WorkflowStep[];
  artifacts: Record<string, string>; // 산출물 키 → 실제 리소스 id (scenarioId, contentId, …)
}
```

- 저장 위치·영속화 방식은 P1에서 확정(초기엔 프론트 상태+로컬 저장으로 시작 가능, 서버 저장은 후속).

## 5. 사용자 제어 (User Control)

- 각 스텝 카드: **[ Edit ] [ Remove ]**. Workflow 하단: **[ + Add Step ]** (경쟁사 분석, Persona 추가, A/B 비교, 직접 입력 등).
- **의존성 경고**: 스텝 제거 시 `dependencies`를 역추적해 하류 스텝이 깨지면 경고한다.

  > "이 단계를 제거하면 Simulation에 필요한 Persona 정보가 없습니다."
  > [ 자동으로 대체 ] [ 계속 진행 ] [ 취소 ]

- required 스텝은 제거 대신 "건너뛸 수 없음" 안내; optional/recommended는 자유 제거.

## 6. Progressive Disclosure

| 계층 | 노출 대상 | 보이는 것 |
|---|---|---|
| **Beginner** (기본) | 모든 사용자 | Create → Describe → Review → Generate → Output. 스텝은 Vertical Stepper 카드(01/02/03…, ✓●○ 표시), Node Graph 없음 |
| **Intermediate** | Workflow를 편집하는 사용자 | 스텝 상세(입력/출력/의존성), Add/Remove/Edit, 산출물(Content) 목록 |
| **Advanced** (opt-in 토글/메뉴) | 전문가 | Content Graph, Entities/Relationships, Dependencies, Provenance/Lineage, Versions, Projection 원본, API |

Workflow UI는 Vertical Stepper/Cards가 기본이고, Advanced 사용자만 Graph View로 전환한다.

## 7. 용어 대응표 (내부 ↔ 사용자)

| 내부 용어 (Advanced에서만 노출) | 사용자 용어 (기본 UI) |
|---|---|
| Amplify / Draft Scenario | 이야기 초안 만들기 |
| Extract | 핵심 내용 가져오기 |
| Compose / Generate Graph | 이야기 구조 만들기 |
| Synthesize / Remix | 콘텐츠 조합하기 / 새로운 버전 만들기 |
| Classify | 장르·분위기 정리 |
| Projection | 다른 형태로 활용하기 |
| Entity | 구성 요소 (등장인물·장소·사물) |
| Relationship | 관계 |
| Content Graph | 콘텐츠 구조 |
| Validation | 점검하기 |
| Version / Snapshot(content) | 저장 시점 |
| Lineage / Provenance | 출처 / 어디서 왔는지 |
| Population / Dimension / Dependency Rule | 가상 인물 집단 / 특성 / 특성 규칙 |
| Sampling (strategy·seed) | 가상 인물 만들기 |
| Character Snapshot → Agent | (비노출 — 자동 준비 단계) |
| Simulation / Turns | 시뮬레이션 / 대화 횟수 |
| Evaluation | 결과 분석 |
| RoleplayX (schema) | 롤플레이 (내부 스키마 비노출) |
| MatrAIx Import | 콘텐츠 가져오기 |

## 8. 새 정보구조 (IA)

```
Home        — "무엇을 만들고 싶나요?" (Output Intent 진입)
Create      — Intent → Workflow Planner → 실행
Library     — 만든 것들 (시나리오·콘텐츠·시뮬레이션 결과·리포트)
Examples    — 실행형 예시 갤러리 ("Try this example")

Workspace   — 진행 중인 Workflow (Stepper) + 산출물 + Result

Advanced    — Graph · Explorer · Versions · Provenance · Projection 원본 · API
```

### 기존 라우트 수용 (최소 변경 마이그레이션)

| 기존 라우트 | 새 IA 위치 | 변경 |
|---|---|---|
| `/` Overview | **Home**으로 교체 (파이프라인 카드 → Intent 선택 + Examples 하이라이트) | 화면 교체, 라우트 유지 |
| `/world` (IDEA→SCENARIO 위저드) | **Create**의 스토리 계열 스텝 실행기로 재사용 | 진입 경로만 변경 |
| `/world` SCENARIOS 탭 | **Library** (시나리오) | 탭 → 페이지 승격 |
| `/content/:id` Workspace | 기본: **Result/콘텐츠 뷰**(텍스트 중심) · 그래프+Inspector+Validate+Versions는 **Advanced** 패널로 | 노출 계층만 변경, 라우트 유지 |
| `/populations`, `/characters`, `/agents` | **Advanced** (또는 Workflow 스텝 내부 자동 화면). Agents는 기본 UI에서 비노출 | 사이드바에서 Advanced 그룹으로 이동 |
| `/simulations`, `/evaluations` | 결과는 **Library/Result**로, 원본 목록은 **Advanced** | 노출 계층 변경 |
| `/explorer` | **Advanced** (Graph Explorer 그대로) | 사이드바 그룹 이동 |
| 사이드바 "Pipeline 1–6" | 제거 → Home/Create/Library/Examples + Advanced 접기 그룹 | layout.tsx 내비 데이터만 수정 |

핵심 원칙: **라우트와 페이지 컴포넌트는 유지**하고, 내비게이션 그룹·기본 랜딩·노출 계층만 바꾼다. 삭제되는 기능은 없다.

## 9. 결과(Result) 화면

Workflow 완료 시 내부 데이터가 아니라 **결과를 먼저** 보여준다.

- 상단: 결과 요약 (예: 시뮬레이션이면 "Overall Reaction 82% Positive", Key Drivers/Concerns, 세그먼트 결과; 스토리면 제목·로그라인·본문).
- 하단 액션: [ 상세 보기 ] [ Workflow 보기 ] [ 콘텐츠 구조 보기 (Advanced) ] [ 다른 Output 만들기 ]

## 10. 재사용(Reuse) UX

결과 화면에서 같은 canonical content를 다른 Output으로 바로 전환한다.

> "이 콘텐츠로 만들 수 있어요:" 🎭 롤플레이 · 🎬 영화 · 📖 소설 · 🎮 게임 · 📢 광고 · 🧪 시뮬레이션

선택 시 Workflow Planner가 기존 산출물(`artifacts`)을 입력으로 채운 새 Workflow를 추천한다 — 이미 완료된 스텝은 `complete`로 표시되어 건너뛴다.

## 11. Example-Driven Onboarding & 빈 상태

- **Examples**: 문서가 아니라 실행형. 각 예시("아이디어 하나로 영화 이야기", "신제품 고객 반응 시뮬레이션" 등)는 [ Try this example ]로 프리필된 Workflow를 즉시 실행한다. (P2)
- **빈 상태 규칙**: "No X" 단독 금지. 모든 빈 목록은
  "무엇부터 만들어볼까요?" + [ Example 시작 ] [ 새 콘텐츠 만들기 ] [ 콘텐츠 가져오기 ]
  를 제공하며, 파이프라인 선행 단계가 필요한 경우 해당 Workflow로 연결한다.

## 12. 비범위 (Do not overengineer)

전체 UI 재작성, 새 Graph DB, microservices, 새 AI agent framework, 모든 Projection 구현, marketplace/social 기능은 하지 않는다. 기존 API·화면을 최대한 재사용한다.
