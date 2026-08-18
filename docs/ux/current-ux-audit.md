# 현재 UX 감사 (Current UX Audit)

> 기준: 2026-08-18, 실제 코드 확인 기반. 추측 없이 각 항목에 코드 근거를 병기한다.
> 스코프: `artifacts/contentx` (프론트엔드) + `artifacts/api-server` (기능 존재 여부 확인용).

---

## 1. 현재 내비게이션 (Current Navigation)

근거: `artifacts/contentx/src/components/layout.tsx`

사이드바는 3개 그룹으로 구성된다.

| 그룹 | 항목 | 경로 | 비고 |
|---|---|---|---|
| (일반) | Overview | `/` | 진입점 |
| **Pipeline** (1–6 번호 스텝퍼) | World | `/world` | "Define the source world" |
| | Population | `/populations` | "Import & structure people" |
| | Characters | `/characters` | "Sample individuals" |
| | Agents | `/agents` | "Instantiate actors" |
| | Simulation | `/simulations` | "Run interactions" |
| | Evaluation | `/evaluations` | "Score & derive content" |
| **Tools** | Graph Explorer | `/explorer` | 5개 perspective 그래프 뷰 |

- 내비게이션 자체가 **내부 파이프라인(엔진 구조)을 그대로 노출**한다. "Stages flow top to bottom — each builds on the previous one." (layout.tsx L84) — 사용자는 결과가 아니라 공정 순서를 먼저 배워야 한다.
- "Create"에 해당하는 항목이 없다. 생성 진입점은 `/world` 페이지 내부의 IDEA 폼에 숨어 있다.

## 2. 현재 화면 (Current Screens)

근거: `artifacts/contentx/src/App.tsx` 라우트 테이블.

| 라우트 | 페이지 | 내용 |
|---|---|---|
| `/` | `overview.tsx` | 제품 소개 + Trust strip + 8단계 스테이지 카드(SOURCE→…→CONTENT) 메트릭 |
| `/world` | `world.tsx` | 2-스텝 위저드(IDEA→SCENARIO DRAFT), 시나리오 라이브러리, 분류/합성(synthesize)/re-roll/후보 비교, CONTENT·SCENARIOS·LINEAGE 탭 |
| `/content/:id` | `workspace.tsx` | 콘텐츠 그래프 워크스페이스: 엔티티 목록 + SVG 그래프 + Inspector/Validation/Versions/Export 패널 |
| `/populations`, `/populations/:id` | 목록/상세 | 인구 정의, 차원, 의존 규칙, 샘플링 |
| `/characters`, `/characters/:id` | 목록/상세 | 샘플링된 캐릭터 |
| `/agents`, `/agents/:id` | 목록/상세 | 스냅샷 기반 런타임 에이전트 |
| `/simulations`, `/simulations/:id` | 목록/상세 | 시뮬레이션 실행 기록/이벤트 |
| `/evaluations`, `/evaluations/:id` | 목록/상세 | 평가 결과 |
| `/explorer` | `explorer.tsx` | World/Population/Character/Simulation/Lineage 5개 perspective 그래프 + Inspector |

## 3. 현재 유저 플로우 (Current User Flow)

이야기 하나를 롤플레이로 만들려면 사용자가 실제로 거치는 경로:

1. `/world`에서 아이디어 입력 → "Amplify" (`useDraftScenario`, world.tsx L142)
2. SCENARIO DRAFT 화면에서 편집/분류 → "Save to Library" 또는 그래프 생성(`handleConfirmGraph` L225)
3. `/content/:id` Workspace에서 그래프 확인·Validate·Version·Export
4. 롤플레이 결과는 Workspace의 Export 패널 또는 `GET /v1/projections/roleplayx/:id`로 획득

→ **원하는 Output(롤플레이)이 플로우의 마지막에, 그것도 "Export/Projection"이라는 기술 용어 뒤에 숨어 있다.** 시뮬레이션 계열(인구→캐릭터→에이전트→시뮬레이션→평가)은 이 플로우와 별도 트랙이며, 두 트랙을 잇는 UI 안내가 없다.

## 4. 스펙 §2의 8개 질문에 대한 답

### Q1. 사용자가 무엇을 해야 하는지 명확한가? — **아니다**
- Overview(`overview.tsx`)는 "AI-native World & Content Intelligence Engine"이라는 제품 정의와 8개 스테이지 카드를 보여줄 뿐, "지금 무엇을 하라"는 단일 CTA가 없다. 모든 카드가 동급의 링크다(L219–251).
- 유일한 생성 시작점(아이디어 입력)은 `/world` 안에 있으며, 내비 라벨 "World"에서 이를 유추할 수 없다.

### Q2. 처음 접했을 때 ContentX가 무엇인지 이해할 수 있는가? — **부분적으로만**
- "What is ContentX?" 설명 블록은 있으나(overview.tsx L179–189) 엔진 관점의 문장이다. "이 서비스로 무엇을 만들 수 있는가"(영화/소설/롤플레이/시뮬레이션 결과)를 보여주는 예시·갤러리가 없다.
- CONTENT 스테이지 카드의 "Roleplay/Novel/Business Scenario: Available"(L146–148)이 Output에 대한 유일한 힌트인데, 클릭하면 `/world`로 갈 뿐 해당 Output을 만드는 경로로 이어지지 않는다.

### Q3. Graph가 사용자에게 과도하게 노출되어 있는가? — **그렇다**
- 콘텐츠 생성 완료 즉시 `/content/:id` 그래프 워크스페이스로 랜딩한다(world.tsx L234). 첫 결과 화면이 SVG 노드 그래프 + Entity 목록 + Inspector다.
- 위저드 스텝퍼 3단계 이름 자체가 "3. GRAPH GENERATION"(world.tsx L448).
- `/explorer`는 5개 perspective 전부 그래프이며 Tools로 항상 노출된다.
- 결과물(이야기 텍스트, 롤플레이 시나리오)을 그래프 없이 보는 화면이 존재하지 않는다.

### Q4. 내부 architecture terminology가 UX에 노출되어 있는가? — **광범위하게 그렇다**
코드에서 확인되는 사용자 노출 용어:
- **Entity / Relationship / Attributes** — workspace.tsx 좌측 패널 "Entities", Inspector "Entity • {kind}", "Relationship"(L131, L261)
- **Content Graph / Graph Generation** — world.tsx 스텝퍼, 토스트 "Content graph generated successfully"(L231)
- **Lineage / Provenance** — world.tsx LINEAGE 탭, explorer.tsx Lineage perspective("Provenance (derived from)" L224)
- **Projection Targets** — overview.tsx CONTENT 카드(L142)
- **Snapshot / Agent / Sampling Run / seed / strategy** — explorer.tsx 노드 라벨("Run {strategy} · seed {seed}" L128), 내비 "Instantiate actors"
- **Amplify / Synthesize / Classify / Reclassify** — world.tsx 버튼·토스트 다수
- **Canonical / Validation / Version** — workspace.tsx 패널명
- Overview 파이프라인 문자열 "SOURCE → POPULATION → CHARACTERS → AGENTS → SIMULATION → BEHAVIOR → EVALUATION → CONTENT"(L166)은 아키텍처 다이어그램 그대로다.

### Q5. 원하는 Output까지 도달하는 경로가 복잡한가? — **그렇다**
- 롤플레이 하나에 최소 4개 화면(IDEA → SCENARIO → Workspace → Export 패널)을 지나며, 각 단계에서 "다음에 무엇을 해야 하는지"를 시스템이 제안하지 않는다.
- Product-reaction류 결과는 World 트랙과 무관하게 Populations→Characters→Agents→Simulations→Evaluations 5개 화면을 **사용자가 순서를 알고** 직접 밟아야 한다. 이 순서를 아는 방법은 사이드바의 번호뿐이다.
- 두 트랙(스토리 생성 vs. 시뮬레이션)의 교차점(예: "이 이야기 속 인물로 시뮬레이션 돌리기")으로 안내하는 UI가 없다.

### Q6. 기존 기능을 사용자가 발견하기 어려운가? — **그렇다**
- **Synthesis(합성)**: `/world`의 SCENARIOS 탭에서 "synthesize mode"를 켜고 2개 이상 시나리오의 요소를 선택해야 나타난다(world.tsx L83–94, L350). 강력한 차별 기능인데 탭+모드 토글 2중으로 숨어 있다.
- **Re-roll/후보 비교**: 합성 직후 세션에서만 나타난다(L452 조건: `synthesisRecipe && candidates.length > 0 && !currentScenarioId`). 이탈 시 소실.
- **RoleplayX 프로젝션**: UI 진입점이 Workspace Export 패널 내부뿐. `POST /v1/projections`의 `novel`/`business` 타깃(lib/api-zod generated: `zod.enum(['roleplayx','novel','business'])`)은 **UI에서 아예 노출되지 않는다**.
- **MatrAIx import**: `POST /v1/content/import/matraix`가 존재하지만 UI 진입점이 없다(별도 태스크 #26으로 확인됨).
- **populations/:id/definition(버전 재현)**, `GET /v1/evaluations/:id/lineage` 등 API는 있으나 UI 없음.

### Q7. 빈 화면에서 무엇을 해야 하는지 알기 어려운가? — **그렇다**
- 목록 페이지의 빈 상태는 정보만 있고 실행 가능한 CTA가 없거나 약하다: "No Populations"(populations/list.tsx L52), "No Characters"(characters/list.tsx L58), "No Agents Found"(agents/list.tsx L36), "No Simulations"(simulations/list.tsx L60), "No Evaluations"(evaluations/list.tsx L61).
- 이들은 "이전 파이프라인 단계를 먼저 하라"는 안내나 원클릭 시작(예: Example 실행)을 제공하지 않는다 — 스펙 §20("빈 화면을 보여주지 마라") 위반.
- Overview는 데이터가 0이어도 0으로 채워진 메트릭 카드를 보여줄 뿐 시작 경로를 제안하지 않는다.

### Q8. Workflow를 사용자가 직접 설계해야 하는 부분이 있는가? — **사실상 전부**
- 파이프라인 순서는 사이드바 번호로 암시될 뿐, 시스템이 다음 스텝을 추천·프리필하지 않는다.
- 시뮬레이션을 돌리려면 사용자가 스스로 "스냅샷을 만들고 → 에이전트를 만들고 → 시뮬레이션 바디를 구성"해야 하며(`POST /v1/snapshots`, `POST /v1/agents`, `POST /v1/simulations`), 각 화면은 서로를 참조하지 않는다.
- "원하는 결과"를 입력받는 곳이 없으므로 Workflow 추천 자체가 존재하지 않는다.

## 5. 인지 부하 / 발견 가능성 종합

- **인지 부하**: 첫 세션에서 사용자에게 요구되는 개념 수 ≈ 15개(Entity, Relationship, Graph, Scenario, Classification, Lineage, Population, Dimension, Dependency Rule, Sampling, Snapshot, Agent, Simulation, Evaluation, Projection). 전부 내부 모델 용어다.
- **발견 가능성**: 가치가 높은 기능일수록 깊이 숨어 있다(합성 = 2중 토글, 프로젝션 = 4번째 화면의 패널, novel/business 프로젝션·MatrAIx import = UI 부재).
- **Output 가시성**: 최종 결과물이 1급 시민이 아니다. 결과 = "그래프가 생겼다"이며, 소설/롤플레이/시뮬레이션 리포트 형태의 결과 화면이 없다.

## 6. 개선 권고 (P1/P2 입력)

1. **Outcome-First 진입점 신설**: Home에서 "무엇을 만들고 싶나요?" → Output Intent 선택/자연어 입력. (신규)
2. **Workflow 추천 UI**: Intent → 추천 스텝(Vertical Stepper) → Add/Remove/Edit → 실행. 기존 API를 스텝 실행기로 재사용. (신규 오케스트레이션 + 기존 API)
3. **Graph를 Advanced로 이동**: `/content/:id`의 그래프·Inspector·`/explorer`를 Advanced 뷰로 격리, 기본 결과 화면은 텍스트/리포트 중심. (라우트 유지, 노출만 변경)
4. **용어 번역 레이어**: §4의 Q4 목록을 사용자 용어로 치환(대응표는 `outcome-first-ux.md` §7).
5. **빈 상태 전면 교체**: 모든 목록 빈 상태에 "Example 시작 / 새로 만들기 / 가져오기" CTA.
6. **결과 화면에서 재사용**: 결과 하단에 "다른 Output으로 활용하기" (projection targets 노출).
7. **숨은 기능 승격**: synthesize/re-roll을 Create 플로우의 명시적 스텝("콘텐츠 조합하기")으로, novel/business 프로젝션을 Output 선택지로 노출.
