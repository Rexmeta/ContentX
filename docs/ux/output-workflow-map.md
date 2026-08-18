# Output → Workflow → Operation → 기존 기능 매핑

> 기준: 2026-08-18. "기존 ContentX 기능/API" 열은 `artifacts/api-server/src/routes/*` 에서 실제로 확인한 엔드포인트만 기재한다. 없는 것은 **신규 필요**로 명시한다.
>
> 범례 — 스텝 상태: ✓ Required · ● Recommended · ○ Optional

## 기존 API 인벤토리 (매핑의 근거)

| 영역 | 엔드포인트 | 파일 |
|---|---|---|
| 콘텐츠 CRUD/그래프 | `GET/POST /v1/content`, `GET/DELETE /v1/content/:id`, `PATCH …/entities/:id`, `PATCH …/relationships/:id`, `POST …/validate`, `GET/POST …/versions`, `GET …/export`, `GET /v1/dashboard/summary` | routes/content.ts |
| MatrAIx import | `POST /v1/content/import/matraix` (dryRun 지원) | routes/content.ts |
| 시나리오 | `POST /v1/scenarios/draft`(amplify), `POST /v1/scenarios/synthesize`, CRUD `/v1/scenarios`, `POST …/:id/classify`, `POST /v1/scenarios/reclassify`, `GET …/:id/similar`, `GET /v1/categories` | routes/scenarios.ts |
| 프로젝션 | `POST /v1/projections` (`target: roleplayx \| novel \| business`), `GET /v1/projections/roleplayx/:id` | routes/projections.ts, lib/api-zod |
| 인구/샘플링 | CRUD `/v1/populations`, `GET …/:id/definition`(버전 재현), 의존 규칙 `/v1/dependencies`, `POST /v1/sampling`, `GET /v1/sampling/:id`, `GET /v1/populations/:id/sampling` | routes/populations.ts |
| 캐릭터/차원 | CRUD `/v1/characters`, `GET/POST /v1/dimensions` | routes/characters.ts |
| 스냅샷/에이전트 | CRUD `/v1/snapshots`, CRUD `/v1/agents` | routes/agents.ts |
| 시뮬레이션/평가 | `GET/POST /v1/simulations`, `GET …/:id`, `GET …/:id/events`, `GET/POST /v1/evaluations`, `GET …/:id`, `GET …/:id/lineage` | routes/simulations.ts |

공통 신규 컴포넌트(모든 Output이 공유):
- **Output Intent 해석기** (자연어/선택 → Intent) — **신규 필요**
- **Workflow Planner** (Intent → 추천 스텝 목록) — **신규 필요**
- **Workflow 실행기/상태 저장** (스텝 ↔ 기존 API 바인딩, status 추적) — **신규 필요**
- **결과(Result) 화면** — **신규 필요** (데이터는 기존 API 응답 재사용)

---

## 1. 🎬 Movie Story

| 필요 입력 | 아이디어(자연어), (○) 제목/톤 |
|---|---|

| # | Workflow 스텝 | 내부 Operation | 기존 기능/API | UI 스텝 (사용자 용어) |
|---|---|---|---|---|
| ✓1 | Idea | Input | — (폼) | "아이디어를 들려주세요" |
| ✓2 | Story Draft | Generate (amplify) | `POST /v1/scenarios/draft` | "이야기 초안 만들기" |
| ●3 | Review & Edit | Edit | `PATCH /v1/scenarios/:id` (또는 로컬 편집 후 저장) | "이야기 다듬기" |
| ●4 | Classify | Analyze | `POST /v1/scenarios/:id/classify` | "장르·분위기 정리" |
| ✓5 | Build World | Compose (graph) | `POST /v1/content` (scenario 포함) | "이야기 구조 만들기" |
| ○6 | Validate | Validate | `POST /v1/content/:id/validate` | "이야기 점검하기" |
| ✓7 | Movie Treatment | Project | **신규 필요** — `POST /v1/projections`에 `movie` 타깃 어댑터 추가 (현재 enum: roleplayx/novel/business) | "영화 이야기로 만들기" |

**최종 Output**: 영화 트리트먼트(로그라인·3막 구조·씬 개요) 텍스트 + Export.

## 2. 📖 Novel

| 필요 입력 | 아이디어 또는 기존 시나리오/콘텐츠 선택 |
|---|---|

| # | Workflow 스텝 | 내부 Operation | 기존 기능/API | UI 스텝 |
|---|---|---|---|---|
| ✓1 | Idea / Pick Content | Input | `GET /v1/scenarios`, `GET /v1/content` | "새로 쓰거나 기존 이야기 고르기" |
| ✓2 | Story Draft | Generate | `POST /v1/scenarios/draft` | "이야기 초안 만들기" |
| ●3 | Review & Edit | Edit | `PATCH /v1/scenarios/:id` | "이야기 다듬기" |
| ✓4 | Build World | Compose | `POST /v1/content` | "이야기 구조 만들기" |
| ○5 | Validate | Validate | `POST /v1/content/:id/validate` | "이야기 점검하기" |
| ✓6 | Novel Projection | Project | `POST /v1/projections` `target: novel` — **API 존재, UI 신규 필요** | "소설로 만들기" |

**최종 Output**: 소설 프로젝션 결과(챕터/산문) + Export.

## 3. 🎭 Roleplay

| 필요 입력 | 아이디어 또는 기존 콘텐츠 선택 |
|---|---|

| # | Workflow 스텝 | 내부 Operation | 기존 기능/API | UI 스텝 |
|---|---|---|---|---|
| ✓1 | Story Source | Input | `GET /v1/content` / draft 플로우(1~4 위와 동일) | "이야기 준비하기" |
| ✓2 | Build World | Compose | `POST /v1/content` | "이야기 구조 만들기" |
| ●3 | Character/Goal Check | Validate | `POST /v1/content/:id/validate` | "등장인물·목표 점검" |
| ✓4 | Roleplay Projection | Project | `GET /v1/projections/roleplayx/:id` 또는 `POST /v1/projections` `target: roleplayx` | "롤플레이로 바꾸기" |
| ○5 | Export | Export | `GET /v1/content/:id/export` | "내보내기" |

**최종 Output**: RoleplayX 시나리오(내부 스키마는 비노출) + Export.

## 4. 🚀 Product Reaction Simulation

| 필요 입력 | 제품 설명, 타겟 고객 설명, (●) 의사결정 요인 |
|---|---|

| # | Workflow 스텝 | 내부 Operation | 기존 기능/API | UI 스텝 |
|---|---|---|---|---|
| ✓1 | Product Definition | Input | — (폼; content로 저장 가능 `POST /v1/content`) | "제품을 설명해주세요" |
| ✓2 | Target Audience | Generate/Input | `POST /v1/populations` + `POST /v1/dimensions` + `POST /v1/dependencies` | "타겟 고객 정의하기" |
| ✓3 | Persona Generation | Generate (sample) | `POST /v1/sampling` (`GET /v1/populations/:id/sampling`) | "가상 고객 만들기" |
| ●4 | Persona Review | Edit | `GET/PATCH /v1/characters/:id` | "가상 고객 살펴보기" |
| ✓5 | Prepare Actors | Transform | `POST /v1/snapshots` → `POST /v1/agents` | (자동 실행, UI 비노출 가능) |
| ✓6 | Simulation Scenario | Compose | `POST /v1/scenarios/draft` 재사용 또는 시뮬레이션 바디 구성 | "반응 시나리오 정하기" |
| ✓7 | Reaction Simulation | Simulate | `POST /v1/simulations` (+ `GET …/events`) | "반응 시뮬레이션 돌리기" |
| ✓8 | Result Analysis | Analyze | `POST /v1/evaluations` + `GET /v1/evaluations?simulationId=` | "결과 분석 보기" |
| ○9 | Segment Comparison | Compare | **신규 필요** (평가 결과의 세그먼트 집계 뷰) | "고객 그룹별 비교" |

**최종 Output**: 반응 리포트(전체 반응, 주요 동인/우려, 세그먼트 비교) — 리포트 화면 **신규 필요**, 데이터는 기존 simulation/evaluation 응답.

## 5. 🎮 Game Content

| 필요 입력 | 게임 컨셉/세계관 아이디어 |
|---|---|

| # | Workflow 스텝 | 내부 Operation | 기존 기능/API | UI 스텝 |
|---|---|---|---|---|
| ✓1 | Concept | Input | — (폼) | "게임 컨셉 설명하기" |
| ✓2 | World Draft | Generate | `POST /v1/scenarios/draft` | "세계관 초안 만들기" |
| ✓3 | Build World | Compose | `POST /v1/content` | "세계 구조 만들기" |
| ●4 | NPC Cast | Generate | `POST /v1/populations` → `POST /v1/sampling` | "NPC 만들어내기" |
| ○5 | NPC Behavior Test | Simulate | `POST /v1/snapshots`→`/v1/agents`→`/v1/simulations` | "NPC 행동 미리보기" |
| ✓6 | Game Content Pack | Project/Export | **신규 필요** — 게임용 프로젝션 어댑터. 임시로 `GET /v1/content/:id/export`(canonical JSON) 제공 가능 | "게임 데이터로 내보내기" |

**최종 Output**: 세계관+NPC 데이터 팩(단기: canonical export, 장기: 게임 어댑터).

## 6. 📢 Advertisement

| 필요 입력 | 제품/브랜드 설명, 타겟 고객 |
|---|---|

| # | Workflow 스텝 | 내부 Operation | 기존 기능/API | UI 스텝 |
|---|---|---|---|---|
| ✓1 | Product/Brand | Input | — (폼) | "무엇을 광고하나요?" |
| ●2 | Audience Persona | Generate | `POST /v1/populations` → `POST /v1/sampling` | "타겟 고객 만들기" |
| ●3 | Reaction Pre-test | Simulate | `/v1/snapshots`→`/v1/agents`→`/v1/simulations`→`/v1/evaluations` | "광고 반응 미리 테스트" |
| ✓4 | Ad Story Draft | Generate | `POST /v1/scenarios/draft` (광고 내러티브 프롬프트) | "광고 스토리 만들기" |
| ✓5 | Ad Copy Projection | Project | **신규 필요** — `business` 타깃(`POST /v1/projections`)이 가장 근접, 광고 특화 어댑터는 신규 | "광고 문구로 뽑기" |

**최종 Output**: 광고 내러티브/카피 + (●) 사전 반응 리포트.

## 7. 🧩 Content Remix (두 콘텐츠 조합)

| 필요 입력 | 라이브러리의 시나리오 2개 이상 + 각자 가져올 요소 선택 |
|---|---|

| # | Workflow 스텝 | 내부 Operation | 기존 기능/API | UI 스텝 |
|---|---|---|---|---|
| ✓1 | Pick Sources | Input | `GET /v1/scenarios` (+ `GET …/:id/similar` 추천) | "조합할 콘텐츠 고르기" |
| ✓2 | Pick Elements | Analyze | synthesize 바디의 `elements`(characters/conflict/setting/twist/structure) | "가져올 요소 고르기" |
| ✓3 | Compose | Remix | `POST /v1/scenarios/synthesize` (lineage 서버 생성) | "콘텐츠 조합하기" |
| ●4 | Re-roll & Compare | Compare | 같은 recipe 재호출(현재 UI는 세션 한정 — 임시 저장은 태스크 #10) | "다른 버전 뽑아 비교" |
| ✓5 | Save | Export | `POST /v1/scenarios` (lineage 포함) | "라이브러리에 저장" |
| ○6 | Continue to Output | Project | 위 Output 1–3 플로우로 연결 | "이걸로 영화/소설/롤플레이 만들기" |

**최종 Output**: 계보(lineage)가 기록된 새 시나리오 → 원하는 Output으로 연결.

## 8. 📚 External Content Transformation (외부 콘텐츠 가져오기)

| 필요 입력 | MatrAIx 데이터셋(JSON). URL/텍스트/일반 파일은 아래 참조 |
|---|---|

| # | Workflow 스텝 | 내부 Operation | 기존 기능/API | UI 스텝 |
|---|---|---|---|---|
| ✓1 | Import | Import | `POST /v1/content/import/matraix` — **API 존재, UI 업로드 신규 필요**(태스크 #26) | "콘텐츠 가져오기" |
| ●2 | Preview | Validate | 같은 API의 `dryRun: true` | "가져올 내용 미리보기" |
| ✓3 | Structure Review | Review | `GET /v1/content/:id` (+ Advanced: 그래프) | "구조 확인하기" |
| ●4 | Edit | Edit | `PATCH …/entities/:id`, `PATCH …/relationships/:id` | "내용 다듬기" |
| ○5 | To Population | Transform | **신규 필요** (import→population 변환, 태스크 #33) | "가상 인물 집단으로 변환" |
| ○6 | Remix / Output | Remix/Project | Output 7 또는 1–3 플로우로 연결 | "새 콘텐츠로 재구성" |

**최종 Output**: 구조화된 콘텐츠 → 리믹스/프로젝션/시뮬레이션 재료.
**신규 필요(입력 소스 확장)**: URL/자유 텍스트/일반 파일 import는 현재 API가 없다 (MatrAIx JSON만 지원).

---

## 신규 필요 항목 요약

| 항목 | 성격 |
|---|---|
| Output Intent 해석 + Workflow Planner + 실행기/상태 | 신규 (P1 핵심) |
| 결과(Result)·리포트 화면, 세그먼트 비교 | 신규 (프론트) |
| `movie`/`game`/`ad` 프로젝션 어댑터 | 신규 (백엔드; `novel`/`business`는 API 존재·UI만 없음) |
| MatrAIx 업로드 UI, import→population 변환 | 신규 (기존 태스크 #26/#33과 일치) |
| URL/텍스트/파일 import | 신규 (스코프 협의 필요) |
