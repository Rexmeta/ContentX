import {
  Film, BookOpen, MessageSquare, LineChart, Repeat, Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Executable example gallery definitions (P2 example-driven onboarding).
 *
 * Each example maps to a planWorkflow call: { outputType, description }.
 * `supported` mirrors the backend's SUPPORTED_OUTPUT_TYPES — unsupported
 * examples are shown as "준비 중" and cannot be started.
 */
export interface ExampleDefinition {
  id: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  outputType:
    | "movie" | "novel" | "roleplay" | "product-reaction"
    | "game" | "advertisement" | "remix" | "external-transform";
  /** Prefilled description passed to the workflow planner. */
  description: string;
  supported: boolean;
  /** What the resulting workflow will do, in plain user language. */
  stepsPreview: string[];
}

export const EXAMPLES: ExampleDefinition[] = [
  {
    id: "novel-from-idea",
    title: "아이디어 하나로 소설 만들기",
    summary: "한 줄 아이디어를 등장인물·장면이 있는 소설로 완성해요.",
    icon: BookOpen,
    outputType: "novel",
    description:
      "우주 정거장에 고립된 두 연구원이 정체불명의 신호를 발견하고, 그 신호의 정체를 두고 서로 다른 선택을 하게 되는 이야기",
    supported: true,
    stepsPreview: [
      "아이디어 확인",
      "이야기 초안 만들기",
      "이야기 구조 만들기",
      "소설로 만들기",
    ],
  },
  {
    id: "roleplay-from-story",
    title: "이야기를 롤플레이로 바꾸기",
    summary: "이야기 아이디어를 직접 참여할 수 있는 롤플레이 시나리오로 만들어요.",
    icon: MessageSquare,
    outputType: "roleplay",
    description:
      "몰락 직전의 상단(商團)을 물려받은 주인공이 라이벌 상단과의 협상에서 살아남아야 하는 이야기",
    supported: true,
    stepsPreview: [
      "아이디어 확인",
      "이야기 초안 만들기",
      "이야기 구조 만들기",
      "롤플레이로 바꾸기",
    ],
  },
  {
    id: "product-reaction",
    title: "신제품 고객 반응 시뮬레이션",
    summary: "가상 고객들을 만들어 신제품에 대한 반응을 미리 들어봐요.",
    icon: LineChart,
    outputType: "product-reaction",
    description:
      "노이즈 캔슬링과 24시간 배터리를 지원하는 무선 이어폰 신제품. 타겟 고객은 출퇴근 시간이 긴 20-30대 직장인",
    supported: true,
    stepsPreview: [
      "제품 설명 확인",
      "타겟 고객 정의하기",
      "가상 고객 만들기",
      "반응 시뮬레이션 돌리기",
      "결과 분석 보기",
    ],
  },
  {
    id: "movie-from-idea",
    title: "아이디어로 영화 이야기 만들기",
    summary: "아이디어를 영화용 트리트먼트로 발전시켜요.",
    icon: Film,
    outputType: "movie",
    description:
      "기억을 사고파는 도시에서 자신의 기억을 판 형사가 잃어버린 사건을 다시 추적하는 이야기",
    supported: false,
    stepsPreview: ["아이디어 확인", "이야기 초안 만들기", "영화 트리트먼트로 만들기"],
  },
  {
    id: "remix-two-contents",
    title: "두 콘텐츠 조합하기",
    summary: "만들어 둔 이야기 두 개를 합쳐 새로운 버전을 만들어요.",
    icon: Repeat,
    outputType: "remix",
    description: "기존 이야기 두 개를 골라 세계관과 인물을 조합한 새로운 이야기 만들기",
    supported: false,
    stepsPreview: ["조합할 콘텐츠 고르기", "콘텐츠 조합하기", "새 버전 점검하기"],
  },
  {
    id: "external-transform",
    title: "외부 콘텐츠 가져와 변환하기",
    summary: "외부에서 가져온 콘텐츠를 새로운 형태로 재구성해요.",
    icon: Sparkles,
    outputType: "external-transform",
    description: "외부 콘텐츠를 가져와 핵심 내용을 추출하고 다른 형태로 재구성하기",
    supported: false,
    stepsPreview: ["콘텐츠 가져오기", "핵심 내용 가져오기", "다른 형태로 활용하기"],
  },
];
