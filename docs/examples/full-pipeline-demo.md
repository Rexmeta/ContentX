# Full-Pipeline Demo (Phase 13–14)

Recorded 2026-08-13 against the dev API (`/api`). Pipeline: population → deterministic sample → character snapshots → agents → seeded simulation → immutable trace → evaluations → projections from the same canonical/runtime data.

## 1. Simulation (Phases 7–12 recap)

- 2 agents (Sales vs Finance) instantiated from immutable character snapshots of the test population.
- `POST /v1/simulations` `{topic: "budget", seed, maxTurns: 8}` → status `completed`, agreement reached; trace persisted atomically; snapshots marked used (delete → 409); same seed with fresh agents reproduces the identical decision/action/outcome trace.
- `POST /v1/evaluations` → behavior + personaFidelity per agent + one outcome evaluation.

## 2. RoleplayX projection from the simulation

`POST /v1/projections` `{"target":"roleplayx","simulationId":…}` →

```json
{
  "target": "roleplayx",
  "payload": {
    "title": "post-fix check",
    "personas": [
      {
        "name": "Sales",
        "role": "participant 1",
        "traits": [
          "risk_tolerance: low",
          "communication_style: analytical",
          "…"
        ]
      },
      {
        "name": "Finance",
        "role": "participant 2",
        "traits": [
          "risk_tolerance: low",
          "communication_style: analytical",
          "…"
        ]
      }
    ],
    "objectives": [
      "Reach an agreement on \"budget\" within 8 turns."
    ],
    "successCriteria": [
      "Match or beat the reference run: agreement within 4 turn(s)."
    ],
    "environment": {
      "type": "text",
      "topic": "budget",
      "maxTurns": 8
    },
    "evaluationContract": {
      "kinds": [
        "behavior",
        "personaFidelity",
        "outcome"
      ],
      "criteria": [
        "Behavior: stay active every turn; cooperative moves (concede/accept) are scored.",
        "Persona fidelity: concession behavior must match the persona's risk tolerance.",
        "Outcome: agreement reached, turn efficiency, and final position convergence."
      ]
    },
    "recommendedFlow": [
      "Turn 2 — agent_b91aa90ef3d8bde1: \"On budget, I can move somewhat toward your number, but I…",
      "Turn 2 — agent_16cc4071ce2d5664: \"On budget, I can move somewhat toward your number, but I…",
      "Turn 3 — agent_b91aa90ef3d8bde1: \"On budget, I can move somewhat toward your number, but I…",
      "…"
    ]
  },
  "provenance": [
    {
      "layer": "simulation",
      "simulationId": "simulation_4ad0cb6042369c69",
      "seed": 7,
      "snapshotIds": [
        "snapshot_ba4b1d7b1220fe01",
        "snapshot_7b32cb7430cfc15e"
      ],
      "evaluationIds": [
        "evaluation_c5a6b10e493684d4",
        "evaluation_f736725e6ff97d4d",
        "evaluation_bd928d4fa98ab209",
        "evaluation_c5f0a1e4ffed482f",
        "evaluation_552a4062a18de256"
      ]
    },
    {
      "layer": "projection",
      "adapter": "roleplayx",
      "adapterVersion": "2.0.0",
      "modelVersion": null,
      "projectedAt": "2026-08-13T07:37:30.511Z"
    }
  ]
}
```

## 3. Novel projection from the same canonical graph

`POST /v1/projections` `{"target":"novel","contentId":…}` — same canonical world, different runtime; output strictly schema-validated:

```json
{
  "target": "novel",
  "payload": {
    "title": "새벽 네 시의 기준선",
    "logline": "권역 유일의 야간 중증 이송 병원에서 숨진 이식 대기 환아가 신약 연구의 생존 사례로 남아 있음을 발견한 책임간호사 서윤아는, 동료들의 희생과 병원의 생존 논리가 감춘 기록을 공식적인 증거로 바꾸려 한다.",
    "theme": "환자 안전과 연구 윤리는 개인의 헌신으로 유지될 수 없으며, 생존을 위한 침묵은 가장 약한 환자에게 위험을 떠넘긴다.",
    "characters": [
      {
        "name": "서윤아",
        "arc": "개인의 희생을 거부해 온 책임간호사로서, 분노에 찬 폭로 대신 원자료와 노동 기록을 묶어 구조적 책임을 드러내는 길을 선택한다."
      },
      {
        "name": "이도현",
        "arc": "동료를 붙잡기 위해 비공식 근무를 묵인했던 야간 주임에서, 자신의 기록을 제출해 착취의 통계를 무너뜨리는 증언자가 된다."
      },
      {
        "name": "윤태욱",
        "arc": "치료제 접근성을 지킨다는 명분으로 연구기록 수정을 지시했으나, 자신이 지킨 것은 환아가 아니라 왜곡된 기준이었다는 사실과 마주한다."
      },
      {
        "name": "민경자",
        "arc": "병원 존속을 위해 절감을 받아들이려 했지만, 숨겨진 위험이 병원을 살리는 방식이 될 수 없음을 인정한다."
      }
    ],
    "scenes": [
      {
        "heading": "1. 새벽 네 시, 비어 있는 침상",
        "prose": "새벽 네 시가 되자 응급실의 모니터음은 이상하게 또렷해졌다. 서윤아는 소아 구역 끝 침상에서 산소포화도가 떨어지는 아이를 보았다. 이식 대기 중인 일곱 살 민우였…"
      },
      {
        "heading": "2. 지워진 사건",
        "prose": "윤아는 오류 신고를 누르지 않았다. 먼저 원자료를 내려받고, 응급실 배치표와 출입 기록, 도현이 보관한 단체 채팅방의 대기근무 메시지를 나란히 놓았다. 공식 인원…"
      },
      {
        "heading": "3. 기준선을 다시 쓰다",
        "prose": "회의실에는 간호부장 민경자, 노조 사무국장 최성호, 윤 교수와 기획조정실 직원들이 앉아 있었다. 민경자는 보고서 표지를 보며 낮게 말했다. “이대로 나가면 병원이…"
      }
    ]
  },
  "provenance": [
    {
      "layer": "canonical",
      "contentId": "content_dfaad866a6ace315",
      "contentVersion": 1
    },
    {
      "layer": "projection",
      "adapter": "novel",
      "adapterVersion": "1.0.0",
      "modelVersion": "openai/gpt-5.6-terra",
      "projectedAt": "2026-08-13T07:37:57.175Z"
    }
  ]
}
```

## 4. What this proves

- The canonical model carries zero roleplay-specific fields, yet drives both a RoleplayX scenario and a novel draft (projection-independence test in `domains/__tests__/projection.test.ts`).
- Combined sources work: `{target: roleplayx, contentId, simulationId}` yields a provenance chain `canonical → simulation → projection` with contentVersion, seed, snapshotIds and evaluationIds — every projection is reproducible/auditable.
- LLM output never bypasses validation: the novel payload is `z.strictObject`-parsed; invalid output is an explicit 502.
