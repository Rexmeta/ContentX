# 진단형 롤플레이: 작성·접근 경계·수신 매핑

## 확인 범위

이 저장소에서 확인한 수신 구현은 `domains/assessment/roleplayxClient.ts`의
RoleplayX validate/import와 엄격한 `AssessmentScenarioPackageV1`뿐이다.
RoleplayBot 저장소, 공식 진단 수신 계약, 실행 환경, 실행 결과는 제공되지 않았다.
두 제품을 같은 계약으로 가정하지 않는다. **대화 실행·의도 판별·단서 제시·평가 엔진을
ContentX에 추가하지 않았다.** 아래 매핑은 수신 측이 구현·확인해야 하는 계약이다.

## 작성과 버전

- 평가 목록 → **진단 샘플**: 로그인한 작성자 소유의 김 대리 면담 샘플 생성.
- 기존 평가 상세 → **진단 설계 시작**: 기존 평가 차원 키를 연결해 작성.
  과거 상황 설명은 비공개 원인을 담을 수 있어 공개 브리핑으로 자동 복사하지 않는다.
- **진단 편집 · 새 버전** → **새 버전 저장**: 선택한 버전을 복사하고 최신 버전 + 1을
  배정한다. 원본 v1의 인물·대화 흐름·평가 설정을 보존하고 진단 원본을 함께 저장한다.
  과거 버전을 선택해 같은 동작을 하면 과거 설정을 복원한 새 후속 버전이 생긴다.
  발행 여부와 관계없이 기존 불변 스냅샷을 수정하지 않는다.
- 브리핑은 역할과 권한/관계/대화 이유/목표, 준비 시간으로 구성한다.
  총 250~400자와 60~120초는 **파일럿 시작 권장값**이다. 분량 밖의 내용과 240초 등도 저장된다.
- 자료와 단서, 기준 ID는 생성 시 한 번 만들며 수정/재열기/복원 때 유지한다.
  기준 삭제 시 연결을 해제하고, 연결할 기준이 없는 단서는 저장을 막는다.
- 표는 열 제목·행 데이터로 보존하고 실제 HTML 표/열·행 머리글로 표시한다.
  이미지는 대체 텍스트, 영상은 대본, 시각 자료에는 핵심 사실의 접근 가능한 텍스트도 필수다.
- AI 모드에서도 공개 브리핑과 `private/cues/criteria`를 분리하도록 지시하고 구조·참조를 검증한다.
  호출자가 명시한 진단 원본은 AI 기본값보다 우선한다. 생성한 진단 서사는 공개 시나리오 라이브러리에 복제하지 않는다.

## 저장 계약과 기존 v1

1. `assessment_package_versions.package_json`: 기존 엄격한 v1, 그대로 유지.
2. `diagnostic_json`: `contentx.diagnostic.v1`인 별도 원본.
3. `diagnostic_hash`: 객체 키 정렬을 적용한 원본 SHA-256. 읽기 시 일치 여부 확인.
4. `assessment_packages.diagnostic_owner_id`: 서버가 확인한 Clerk 작성자 ID.
5. `assessment_media`: 소유자·안전한 객체 참조·유형만 저장. 바이트/서명 URL/DB JSON의 base64 저장 없음.

패키지 행 잠금 안에서 소유권 확인, 후속 버전 할당, 원본 검증과 스냅샷 삽입을 수행한다.
같은 v1 해시에 다른 진단 원본을 붙여 기존 버전으로 재사용하려는 요청은 거절한다.
기존 진단 패키지에서 진단 원본 없이 일반 버전을 생성하는 것도 거절한다.
기존 비진단 시나리오의 컴파일·조회·발행·v1 내보내기는 변경하지 않는다.

## API 접근 경계

경로 앞에는 `/api`가 붙는다.

| 경로 | 권한/반환 |
|---|---|
| `POST /v1/assessments/diagnostic-sample` | 로그인; 새 작성자 소유 샘플 |
| `POST /v1/assessments/from-template` + `diagnosticMode:true` | 로그인; 구조 검증 후 진단 버전 |
| `GET /v1/assessments/{id}/versions/{v}/diagnostic` | 소유자; 진단 원본 |
| `POST .../diagnostic` | 소유자 또는 기존 비진단 평가를 변환하는 로그인 작성자; 새 버전 |
| `GET .../diagnostic-export` | 소유자; 버전이 명시된 진단 내보내기 |
| `GET .../package` | 진단 패키지는 소유자; 기존 v1 그대로 |
| `GET .../participant?phase=preparation\|conversation` | 공개 미리보기; 서버 허용목록 필드만 |
| `GET .../media/{assetId}?phase=...` | 위 공개 투영에 포함된 첨부만; 그 외 404 |
| `POST /v1/assessment-media/uploads` | 로그인; 허용 미디어 유형의 비공개 직접 업로드 URL |

진단 패키지의 상세/이력/검증/발행 및 deprecated assessment-packages 별칭에도 소유자
경계를 적용한다. 익명 401, 다른 작성자 403. 클라이언트가 보낸 actor ID나
`x-organization-id`는 인증 근거로 사용하지 않는다. 진단 목록은 소유자에게만 보인다.
일반 참가자 응답은 소유자용 응답을 받아 UI로 숨기는 방식이 아니다.
단독 참가자 페이지는 참가자 쿼리만 호출한다. 로그인 사용자 변경 시 쿼리 캐시를 비운다.

공개 투영 필드:
`schemaVersion`, `phase`, `scenarios[].{scenarioKey,briefing,materials}`.
중첩 필드도 명시적으로 선별한다. 비공개 단서, 인물 설정, 평가 기준, 내부 지시,
provenance, 작성 원본과 저장소 경로는 내려가지 않는다.
공개 객체 경로와 임의 원본 객체 다운로드 라우트는 등록하지 않았다.

**시점 의미**
- preparation: `displayAt=preparation|both`.
- conversation: `displayAt=conversation` 또는 `reopenDuringConversation=true`.
  준비 때 보였어도 재열람 불가인 자료는 대화 상태 응답/미디어에서 제외한다.
- 이는 **작성자용 상태 미리보기**이며 phase를 URL로 선택할 수 있다.
  실제 시험의 신뢰할 수 있는 진행 단계/발행 여부/응시자 권한은 수신 엔진이 관리해야 한다.
  ContentX에 응시자 세션 시스템이 구현되었다는 의미가 아니다.

**실행 서버 접근**
새 진단 원본은 현재 소유자 세션을 통해 다운로드해 전달한다.
확인되지 않은 서비스 계정 헤더나 RoleplayX API 키로 진단 전체 응답을 허용하지 않는다.
수신 서버 자동 조회가 필요하면 별도 서버 간 인증·권한·수명 계약을 먼저 확정해야 한다.
과거 비진단 공개 경로 전체를 계정 시스템으로 전환하는 작업은 하지 않았다.

## 내보내기와 수신 측 매핑

기존 **패키지 JSON**은 `AssessmentScenarioPackageV1`; 진단 신규 필드를 끼워 넣지 않는다.
**진단 내보내기**는 다음 envelope이며, 두 파일은 `packageKey/version/scenarioKey`로 연결한다.

```text
schemaVersion: contentx.diagnostic-export.v1
packageKey, version
diagnostic:
  schemaVersion: contentx.diagnostic.v1
  scenarios:
    scenarioKey
    briefing: roleAndAuthority, relationship, reason, goals, preparationSeconds
    materials: id, title, type, displayAt, reopenDuringConversation,
               text, table?, assetId?, altText?, transcript?
    private: hiddenCauses, internalIntent, modelAnswer, instructions
    cues: id, type, intent?, condition?, fact, criterionIds[],
          tone?, intensity?, fallbackCondition?
    criteria: id, dimensionKey, competencyName, observableBehavior
rules: [...]
receiverStatus: mapping_required_not_runtime_verified
runtimeResults: null
```

| ContentX | 수신 엔진이 구현·확인할 동작 |
|---|---|
| `scenarioKey` | 두 내보내기의 동일 시나리오 연결 |
| `briefing` | 시작 전 참가자에게만 공개할 네 영역 및 준비 시간 |
| `materials.id` | 안정적 자료 식별, 표시/재열람 상태 확인 |
| `assetId` | 공개 저장소 URL로 바꾸지 말고 허가된 미디어 접근/보안 이관 계약 필요 |
| `cues[type=discovery].intent` | 특정 문장 일치가 아닌 의미상 질문 의도 탐지 |
| `cues[type=common].condition` | 모든 참가자에게 대응 기회가 생기도록 해당 구간에 제시 |
| `fallbackCondition` | 해당 구간이 오지 않을 때 대체 제시; 미지원이면 오류/진단 반환 |
| `tone/intensity` | 정해진 정서 범위 유지; 미지원이면 명시 |
| `criterionIds` → `criteria.id` → `dimensionKey` | 실제 단서 제시 이벤트와 기존 평가 차원 연결 |
| `private` | 상대역/평가 실행 서버 전용; 참가자 네트워크·상태에 복사 금지 |

진단 패키지의 기존 RoleplayX 발행 요청은 **422**로 차단한다.
미지원 필드를 조용히 버리고 발행 성공으로 표시하지 않는다.
비진단 v1 발행은 기존 경로를 유지한다.

### 기록 및 관찰 기회 규칙

수신 실행 이벤트의 최소 권장 필드:
`scenarioKey, cueId, timestamp, turn, trigger, fallbackUsed`.
노출 사실과 평가를 `cueId` 및 연결된 `criterionIds`로 조인한다.

- 공통 단서를 시스템이 실제로 제시하지 않았음 → 연결된 반응 행동은
  **관찰 기회 없음(`no_observation_opportunity`)**. 참가자의 실패 점수로 치환하지 않는다.
- 발견 단서의 질문 기회가 충분했다는 기록이 있고 참가자가 관련 질문을 하지 않았음 →
  원인 탐색 행동 **미관찰(`not_observed`)**. 단서 자체가 미공개여도 구분한다.
- 질문 기회나 노출의 실행 증거가 없음 → **기회 불명(`opportunity_unknown`)**.
  제시·평가 완료를 추정하지 않는다.

### 수신 엔진 접근 후 해야 할 두 분기 검증

1. 동일 샘플에서 업무 변화/장애물 탐색 질문을 한 실행과 하지 않은 실행을 각각 진행.
   전자에서만 `cue-added-accounts`의 주요 고객 두 곳 추가 담당 사실이 공개되어야 한다.
2. 실적 논의 직후 `cue-defensive-objection`의 “결과만 보고 판단하시는 것 같아요”를
   방어적이되 비공격적으로 제시하고 ID 이벤트를 기록.
   구간 미도달 분기도 실행해 여섯 번째 참가자 발화 직후의 대체 조건 지원을 확인.
3. 공통 단서 미제시와 충분한 질문 기회 후 미질문을 서로 다른 관찰 결과로 확인.
4. 정확한 문구가 다른 탐색 질문, 중복 제시 방지, 재접속 후 ID 기록의 일관성을 확인.

**미검증**: RoleplayBot 실제 의도 판별, 공통/대체 단서 제시, 실행 로그, 채점,
원격 미디어 이관, 실제 참가자 파일럿 및 권장 분량·시간의 타당도.

## 검증 방법

- `pnpm run test:assessment:isolated`
  - 임시 PostgreSQL 클러스터를 새로 시작하고 별도 Unix socket에서만 연결한다.
  - 워크스페이스 `DATABASE_URL`을 사용하지 않는다. 종료 시 테스트 클러스터만 제거한다.
  - 기존 repository DB 회귀와 진단 저장·재열기·복원·동시 버전 할당·권한/참조 롤백을 검사한다.
- `diagnostic.test.ts`: 분량 비차단, 자료 접근성, 중복/참조/공개 조건, 중첩 허용목록, 두 내보내기.
- `diagnosticGeneration.test.ts`: AI 지시, 직접 작성 우선순위, 누락/참조 오류 거절.
- `assessmentDiagnostics.test.ts`: 실제 HTTP 응답 비노출, 소유자 경계/별칭, 미디어 시점, 422 발행.
- 프런트 `diagnostic.test.tsx`: ID 유지, 비차단 권장 분량, 연결 무결성, 단독 참가자 쿼리.

기존 `test:assessment-db:ci`는 ambient DB에 `push-force`를 수행하므로 이 작업에서는
그 명령을 개발/운영 데이터에 실행하지 않았다. 위 격리 runner로 동일 기존 DB 테스트도 실행했다.

## 실제 검증 결과

2026-11-12 개발 환경 기준:

| 검사 | 결과 |
|---|---|
| API 진단·생성·v1 컴파일·수신 클라이언트·템플릿·발행 서비스·기존 경로 | 10개 파일, 총 54개 테스트 통과 |
| 임시 PostgreSQL의 기존 저장소 + 진단 저장소 | 2개 파일, 3개 테스트 통과 |
| 프런트 진단 편집·Assessment 상세·마법사 | 3개 파일, 16개 테스트 통과 |
| OpenAPI 코드 생성 + 공유 라이브러리 타입 검사 | 통과 |
| ContentX 프런트 타입 검사 | 통과 |
| `pnpm run validate:merge` | 충돌 표식 검사 및 API 빌드 통과 |
| `git diff --check` | 통과 |
| `pnpm run typecheck` 전체 검사 | 기존 API 영역의 타입 오류 87개로 실패; 이번 변경 파일의 신규 오류 없음 |
| 서버 health / 익명 샘플 생성 | 200 / 401 |

**실제 브라우저**: Clerk의 정상 테스트 로그인과 쿠키 기반 요청으로 샘플 v1 생성 →
대화 이유를 권장 분량 밖으로 수정하고 준비 시간을 240초로 변경 → v2 저장 →
새로고침·재편집에 성공했다. v1의 원문과 90초는 그대로였으며, 자료·단서·평가 기준 ID 및
단서의 기준 연결이 v1/v2에서 유지되었다. 별도 비로그인 브라우저에서 v2 브리핑과 2행
실적표를 표시하고 실제 참가자 API JSON의 비노출을 확인했다.
전체 패키지/진단 원본은 비로그인 401, 별도 로그인 작성자는 403이었다.

**확인하지 않은 항목**: 브라우저의 실제 이미지/영상 업로드, 실시간 AI 제공자 호출,
RoleplayBot 대화 실행. 미디어 유형·소유권·시점과 대체 텍스트/대본 검증은 자동 테스트로
확인했으며, 브라우저의 실제 파일 전송을 확인했다고 주장하지 않는다.

## 변경 파일 안내

- 서버 원본/검증/샘플/투영/권한/미디어:
  `artifacts/api-server/src/domains/assessment/{diagnostic,diagnosticSample,access,media,repository,scenarioGenerator}.ts`
- HTTP 경계:
  `artifacts/api-server/src/routes/{assessments,assessmentDiagnostics}.ts`,
  `src/app.ts`, `src/middlewares/clerkProxyMiddleware.ts`,
  `src/lib/{objectStorage,objectAcl}.ts`
- 작성·재편집·미리보기:
  `artifacts/contentx/src/pages/assessments/{list,detail,scenario-wizard,diagnostic-editor,diagnostic-section,participant}.tsx`,
  `src/components/diagnostic/material-view.tsx`, `src/lib/diagnostic.ts`, `src/lib/auth-state.tsx`,
  `src/App.tsx`, 로그인 테마·로고·Vite 설정.
- 계약/저장:
  `lib/api-spec/openapi.yaml`, 재생성한 `lib/api-client-react` 및 `lib/api-zod`,
  `lib/api-zod/src/index.ts`,
  `lib/db/src/schema/{assessmentPackages,assessmentPackageVersions,assessmentMedia,index}.ts`
- 검증:
  진단 도메인/DB/생성/HTTP 테스트, 프런트 진단 테스트 및 기존 상세 테스트의 새 쿼리 모의,
  `scripts/test-assessment-isolated.sh`, 루트 `package.json`.
- 인증·저장소 패키지와 React 보안 패치 호환성을 반영한 workspace 설정/lockfile.
