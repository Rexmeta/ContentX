/**
 * Benchmark phase 1 — group pattern report.
 *
 * Aggregates classifications (domain / conflictType / tone / tags) over a
 * reference set of ≥2 scenarios and emits a group-characteristic profile.
 * The profile is deliberately a statistical *description* of the group, never
 * a reproduction of a single source (architecture-v2.md §I invariant).
 */

import * as repo from "./repository";
import type { Classification } from "./taxonomy";

export const BENCHMARK_MIN_SIZE = 2;

export class BenchmarkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BenchmarkError";
  }
}

export interface CategoryFrequency {
  value: string;
  count: number;
  /** Fraction of classified scenarios that carry this value (0–1). */
  ratio: number;
}

export interface BenchmarkProfile {
  domain: CategoryFrequency[];
  conflictType: CategoryFrequency[];
  tone: CategoryFrequency[];
  /** Tag frequencies are relative to total tag occurrences, not scenario count. */
  tags: CategoryFrequency[];
}

export interface BenchmarkReport {
  scenarioCount: number;
  classifiedCount: number;
  profile: BenchmarkProfile;
  /**
   * Ready-to-inject constraint text for draft_story.
   * Empty string when classifiedCount === 0.
   */
  draftConstraints: string;
  /**
   * Non-fatal advisory, e.g. when some scenarios were unclassified.
   * null when everything is clean.
   */
  warning: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function countFrequencies(
  values: string[],
  denominatorForRatio: number,
): CategoryFrequency[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({
      value,
      count,
      ratio: denominatorForRatio > 0 ? count / denominatorForRatio : 0,
    }));
}

function buildDraftConstraints(
  profile: BenchmarkProfile,
  classifiedCount: number,
): string {
  if (classifiedCount === 0) return "";

  const lines: string[] = [
    `[그룹 패턴 제약 — ${classifiedCount}개 참고 작품 집계 기반]`,
    "이 제약은 단일 원본의 재현이 아닌 그룹 공통 특성을 기술한 것이다.",
  ];

  const top = (list: CategoryFrequency[], n = 3) =>
    list
      .slice(0, n)
      .map((f) => `${f.value}(${Math.round(f.ratio * 100)}%)`)
      .join(", ");

  if (profile.domain.length > 0)
    lines.push(`배경 영역: ${top(profile.domain)}`);
  if (profile.conflictType.length > 0)
    lines.push(`갈등 유형: ${top(profile.conflictType)}`);
  if (profile.tone.length > 0)
    lines.push(`분위기: ${top(profile.tone)}`);
  if (profile.tags.length > 0)
    lines.push(`핵심 태그: ${profile.tags.slice(0, 6).map((t) => t.value).join(", ")}`);

  lines.push(
    "위 특성을 반영하되, 새로운 인물·상황·결말을 가진 독창적 이야기를 써라.",
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a group-pattern benchmark report from a set of scenario IDs.
 *
 * Invariant: scenarioIds.length ≥ BENCHMARK_MIN_SIZE (2).
 * Throws BenchmarkError for N=1, missing IDs, etc.
 */
export async function buildBenchmarkReport(
  scenarioIds: string[],
): Promise<BenchmarkReport> {
  if (scenarioIds.length < BENCHMARK_MIN_SIZE) {
    throw new BenchmarkError(
      `벤치마크는 최소 ${BENCHMARK_MIN_SIZE}개 이상의 참고 작품이 필요합니다 ` +
        `(현재 ${scenarioIds.length}개). ` +
        `단일 원본 재현이 아닌 그룹 특성을 추출하려면 복수의 작품이 필요합니다.`,
    );
  }

  // Deduplicate caller-supplied IDs.
  const uniqueIds = [...new Set(scenarioIds)];
  if (uniqueIds.length < BENCHMARK_MIN_SIZE) {
    throw new BenchmarkError(
      `중복 제거 후 ${uniqueIds.length}개만 남았습니다. 서로 다른 시나리오 ${BENCHMARK_MIN_SIZE}개 이상을 선택해주세요.`,
    );
  }

  const rows = await Promise.all(uniqueIds.map((id) => repo.getScenario(id)));
  const missing = uniqueIds.filter((_, i) => !rows[i]);
  if (missing.length > 0) {
    throw new BenchmarkError(
      `존재하지 않는 시나리오: ${missing.join(", ")}`,
    );
  }

  const scenarioCount = rows.length;
  const classifiedRows = rows.filter((r) => r!.classification != null);
  const classifiedCount = classifiedRows.length;

  if (classifiedCount === 0) {
    return {
      scenarioCount,
      classifiedCount: 0,
      profile: { domain: [], conflictType: [], tone: [], tags: [] },
      draftConstraints: "",
      warning:
        "선택한 시나리오 중 분류된 것이 없어 패턴을 추출할 수 없습니다. " +
        "시나리오를 먼저 분류한 뒤 다시 시도해주세요.",
    };
  }

  const classifications = classifiedRows.map(
    (r) => r!.classification as Classification,
  );

  const domains = classifications.map((c) => c.domain);
  const conflictTypes = classifications.map((c) => c.conflictType);
  const tones = classifications.map((c) => c.tone);
  const allTags = classifications.flatMap((c) => c.tags);

  const profile: BenchmarkProfile = {
    domain: countFrequencies(domains, classifiedCount),
    conflictType: countFrequencies(conflictTypes, classifiedCount),
    tone: countFrequencies(tones, classifiedCount),
    // Tags: ratio relative to total tag occurrences so heavy-tagger bias is avoided.
    tags: countFrequencies(allTags, Math.max(allTags.length, 1)),
  };

  const draftConstraints = buildDraftConstraints(profile, classifiedCount);

  const warning =
    classifiedCount < scenarioCount
      ? `${scenarioCount - classifiedCount}개 시나리오가 미분류 상태여서 패턴에서 제외되었습니다.`
      : null;

  return {
    scenarioCount,
    classifiedCount,
    profile,
    draftConstraints,
    warning,
  };
}
