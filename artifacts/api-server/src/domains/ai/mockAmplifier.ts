/**
 * Deterministic mock amplifier — turns a raw user idea into a dramatic
 * scenario draft without calling an LLM. Used in tests and as a reference
 * implementation; the real amplifier is llmAmplifier.ts.
 */

import type { DramaticScenario } from "../scenario/model";

const KOREAN_PATTERN = /[가-힣]/;

function launchScenario(idea: string): DramaticScenario {
  return {
    title: "런칭 D-7: 품질과 속도의 전쟁",
    logline:
      "신제품 출시 7일 전, 치명적 결함을 발견한 품질팀 리더와 출시 연기를 절대 용납할 수 없는 마케팅팀 리더가 회사의 운명을 건 정면 승부를 벌인다.",
    synopsis:
      "출시를 일주일 앞둔 회사. 품질팀 리더 서지안은 최종 검수에서 사용자 데이터가 유실될 수 있는 치명적 결함을 발견한다. 하지만 마케팅팀 리더 한도윤은 이미 대규모 런칭 캠페인에 회사 예산의 절반을 쏟아부었고, 연기는 곧 회사의 신뢰 붕괴를 의미한다. 두 사람의 충돌은 단순한 일정 싸움이 아니라, 과거 실패한 프로젝트에서 서로에게 남긴 상처와 얽히며 회사 전체를 둘로 가른다. 출시 판정 회의 전날 밤, 결함의 원인이 과거 한도윤이 밀어붙인 기능에 있었다는 사실이 드러나면서 갈등은 정점으로 치닫는다.",
    theme: "속도와 완성도, 신뢰와 책임 사이의 선택",
    stakes:
      "출시 강행 시 사용자 데이터 유실과 브랜드 붕괴, 연기 시 자금난과 대량 해고 — 어느 쪽도 물러설 수 없다.",
    twist:
      "결함의 근본 원인이 과거 마케팅 주도로 무리하게 추가된 기능이었음이 밝혀지고, 한도윤은 자신의 책임과 마주하게 된다.",
    acts: [
      {
        name: "1막 — 발견",
        summary: "출시 D-7, 품질팀이 치명적 결함을 발견하고 경보를 울린다.",
        beats: [
          "서지안이 최종 회귀 테스트에서 데이터 유실 결함을 발견한다.",
          "한도윤이 런칭 캠페인 티저를 공개하며 되돌릴 수 없는 강을 건넌다.",
          "긴급 대책 회의에서 두 리더가 처음으로 정면 충돌한다.",
        ],
      },
      {
        name: "2막 — 격화",
        summary:
          "각 팀이 세력을 규합하며 회사가 둘로 갈라지고, 과거의 상처가 드러난다.",
        beats: [
          "경영진이 중립을 선언하며 두 사람에게 결정을 떠넘긴다.",
          "과거 실패 프로젝트에서 두 사람 사이에 있었던 일이 회자된다.",
          "서지안의 팀원이 결함 로그를 분석하다 원인 코드의 커밋 기록을 발견한다.",
          "출시 판정 회의 전날 밤, 결함의 뿌리가 한도윤의 과거 결정임이 드러난다.",
        ],
      },
      {
        name: "3막 — 판정",
        summary:
          "출시 판정 회의에서 진실이 공개되고, 두 사람은 승패가 아닌 책임을 선택해야 한다.",
        beats: [
          "한도윤이 회의에서 스스로 진실을 공개할지 갈등한다.",
          "서지안은 상대를 무너뜨릴 증거를 쥐고도 협력을 제안한다.",
          "단계적 출시라는 제3의 길을 두고 최종 표결이 벌어진다.",
        ],
      },
    ],
    characters: [
      {
        name: "서지안",
        role: "품질팀 리더",
        motivation:
          "과거 결함 은폐로 사용자를 잃은 경험 때문에, 무결점 출시를 신념으로 삼는다.",
      },
      {
        name: "한도윤",
        role: "마케팅팀 리더",
        motivation:
          "연기된 프로젝트로 팀 전체가 해체된 과거가 있어, 일정 사수를 생존의 문제로 여긴다.",
      },
      {
        name: "차민규",
        role: "CEO",
        motivation: "회사의 존속을 위해 두 리더의 갈등을 저울질하는 결정권자.",
      },
    ],
    sourceIdea: idea,
    amplifiedBy: "mock/contentx-amplifier-v1",
  };
}

function genericScenario(idea: string): DramaticScenario {
  const trimmed = idea.trim();
  const korean = KOREAN_PATTERN.test(trimmed);
  const topic = trimmed.slice(0, 60);
  return korean
    ? {
        title: `${topic} — 증폭된 시나리오`,
        logline: `${topic}. 평범해 보이던 이 상황은 감춰진 진실이 드러나는 순간, 관련된 모든 인물의 운명을 뒤흔드는 사건으로 발전한다.`,
        synopsis: `${trimmed} 이 아이디어를 중심으로, 주인공은 자신이 원하는 것을 얻기 위해 움직이기 시작하지만 곧 강력한 대립자와 마주친다. 갈등은 단순한 이해관계 충돌을 넘어 각자의 과거와 신념이 얽힌 싸움으로 격화되고, 숨겨져 있던 진실이 드러나는 순간 주인공은 목표 자체를 다시 정의해야 하는 선택의 기로에 선다.`,
        theme: "욕망과 진실, 그리고 선택의 대가",
        stakes: "실패하면 주인공은 가장 소중한 것을 잃는다. 물러설 곳은 없다.",
        twist: "대립자가 사실은 주인공과 같은 상처를 공유한 인물이었음이 드러난다.",
        acts: [
          {
            name: "1막 — 발단",
            summary: "일상이 깨지고 주인공이 목표를 향해 움직이기 시작한다.",
            beats: [
              "아이디어의 핵심 사건이 주인공의 일상을 뒤흔든다.",
              "주인공이 목표를 선언하고 첫 행동에 나선다.",
              "대립자의 존재가 드러난다.",
            ],
          },
          {
            name: "2막 — 격화",
            summary: "갈등이 깊어지고 판돈이 커진다.",
            beats: [
              "주인공의 첫 시도가 실패하고 대가를 치른다.",
              "조력자와 배신자가 갈린다.",
              "숨겨진 진실의 단서가 드러난다.",
            ],
          },
          {
            name: "3막 — 절정과 해소",
            summary: "진실이 공개되고 주인공은 최후의 선택을 내린다.",
            beats: [
              "진실이 모두 앞에 공개된다.",
              "주인공이 목표와 신념 사이에서 최후의 선택을 한다.",
              "선택의 대가와 함께 새로운 균형이 찾아온다.",
            ],
          },
        ],
        characters: [
          {
            name: "주인공",
            role: "protagonist",
            motivation: "아이디어의 중심 욕망을 이루려 한다.",
          },
          {
            name: "대립자",
            role: "antagonist",
            motivation: "주인공과 양립할 수 없는 목표를 추구한다.",
          },
          {
            name: "조력자",
            role: "ally",
            motivation: "주인공을 돕지만 자신만의 비밀을 갖고 있다.",
          },
        ],
        sourceIdea: idea,
        amplifiedBy: "mock/contentx-amplifier-v1",
      }
    : {
        title: `${topic} — Amplified`,
        logline: `${topic}. What begins as an ordinary situation escalates into a fateful confrontation once a hidden truth surfaces.`,
        synopsis: `${trimmed} From this seed, the protagonist sets out to get what they want — and immediately collides with a powerful opposing force. The conflict deepens beyond a clash of interests into a battle of pasts and convictions, and when the hidden truth comes to light, the protagonist must redefine the goal itself.`,
        theme: "Desire, truth, and the price of choice",
        stakes: "Failure means losing what the protagonist holds most dear.",
        twist: "The antagonist turns out to share the very wound that drives the protagonist.",
        acts: [
          {
            name: "Act 1 — Setup",
            summary: "The ordinary world breaks; the protagonist commits to a goal.",
            beats: [
              "The core incident disrupts the protagonist's world.",
              "The protagonist declares a goal and takes the first step.",
              "The antagonist is revealed.",
            ],
          },
          {
            name: "Act 2 — Escalation",
            summary: "The conflict deepens and the stakes rise.",
            beats: [
              "The first attempt fails at a cost.",
              "Allies and traitors reveal themselves.",
              "A clue to the hidden truth emerges.",
            ],
          },
          {
            name: "Act 3 — Climax",
            summary: "The truth is exposed and a final choice is made.",
            beats: [
              "The truth comes out in front of everyone.",
              "The protagonist chooses between goal and conviction.",
              "A new equilibrium settles, at a price.",
            ],
          },
        ],
        characters: [
          { name: "Protagonist", role: "protagonist", motivation: "Pursues the central desire of the idea." },
          { name: "Antagonist", role: "antagonist", motivation: "Pursues a goal incompatible with the protagonist's." },
          { name: "Ally", role: "ally", motivation: "Helps the protagonist while hiding a secret." },
        ],
        sourceIdea: idea,
        amplifiedBy: "mock/contentx-amplifier-v1",
      };
}

const LAUNCH_HINTS: ReadonlyArray<readonly [string, string]> = [
  ["품질", "마케팅"],
  ["quality", "marketing"],
];

export function amplifyIdea(idea: string, title?: string): DramaticScenario {
  const lower = idea.toLowerCase();
  const isLaunchDemo = LAUNCH_HINTS.some(
    ([a, b]) => lower.includes(a) && lower.includes(b),
  );
  const scenario = isLaunchDemo ? launchScenario(idea) : genericScenario(idea);
  if (title?.trim()) scenario.title = title.trim();
  return scenario;
}
