/**
 * Fixed seed taxonomy for real-world situation clustering.
 * The classifier may propose NEW category names when none of the existing
 * ones fit; those are persisted with origin "auto" (auto-extension).
 */

export type CategoryAxis = "domain" | "conflictType" | "tone";

export const SEED_CATEGORIES: Record<CategoryAxis, string[]> = {
  domain: [
    "직장",
    "가족",
    "연애",
    "법정",
    "의료",
    "학교",
    "정치",
    "범죄",
    "스포츠",
    "예술",
    "과학기술",
    "군대",
    "종교",
    "금융",
    "미디어",
  ],
  conflictType: [
    "이해충돌",
    "배신",
    "경쟁",
    "윤리적 딜레마",
    "세대 갈등",
    "권력 다툼",
    "신념 충돌",
    "생존",
    "복수",
    "정체성",
    "비밀과 폭로",
    "희생",
  ],
  tone: [
    "긴장감",
    "따뜻함",
    "비극적",
    "희극적",
    "냉소적",
    "희망적",
    "서스펜스",
    "잔잔함",
  ],
};

export const CATEGORY_AXES: CategoryAxis[] = [
  "domain",
  "conflictType",
  "tone",
];

/** Classification attached to a scenario. null on a record = unclassified. */
export interface Classification {
  domain: string;
  conflictType: string;
  tone: string;
  tags: string[];
  classifiedBy?: string | null;
}
