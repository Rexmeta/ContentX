import type { DiagnosticMaterial } from "@workspace/api-client-react";
import { DISPLAY_AT_LABEL, MATERIAL_TYPE_LABEL } from "@/lib/diagnostic";

/** Accessible participant-safe material rendering. `src` must be the authenticated API media URL. */
export function MaterialView({ material, src, showMeta = true }: { material: DiagnosticMaterial; src?: string; showMeta?: boolean }) {
  const transcriptId = `transcript-${material.id}`;
  return (
    <figure data-testid={`material-${material.id}`} className="rounded-lg border bg-background p-4 space-y-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{material.title || "제목 없음"}</span>
        {showMeta && <span className="tech-label text-muted-foreground">{MATERIAL_TYPE_LABEL[material.type]} · {DISPLAY_AT_LABEL[material.displayAt]}{material.reopenDuringConversation ? " · 대화 중 다시 열기" : ""}</span>}
      </figcaption>
      {material.type === "text" && <p className="text-sm leading-relaxed whitespace-pre-line">{material.text}</p>}
      {material.type === "table" && material.table && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">{material.title}</caption>
            <thead><tr>{material.table.columns.map((column, i) => <th key={i} scope="col" className="border-b-2 border-foreground/80 px-2 py-1.5 text-left font-semibold">{column}</th>)}</tr></thead>
            <tbody>{material.table.rows.map((row, r) => <tr key={r} className="border-b">{row.map((cell, c) => c === 0 ? <th key={c} scope="row" className="px-2 py-1.5 text-left font-medium">{cell}</th> : <td key={c} className="px-2 py-1.5">{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {material.type === "image" && (src ? <img src={src} alt={material.altText ?? ""} className="max-h-80 rounded border" /> : <div role="img" aria-label={material.altText ?? ""} className="rounded border border-dashed bg-muted/40 p-4 text-xs text-muted-foreground">이미지 미리보기 없음 · 대체 텍스트: {material.altText || "없음"}</div>)}
      {material.type === "video" && (
        <>
          {src ? <video controls src={src} aria-describedby={transcriptId} className="w-full max-h-80 rounded border" /> : <div className="rounded border border-dashed bg-muted/40 p-4 text-xs text-muted-foreground">영상 미리보기 없음</div>}
          <details className="text-xs"><summary className="cursor-pointer font-medium">영상 스크립트</summary><p id={transcriptId} className="mt-2 whitespace-pre-line leading-relaxed">{material.transcript}</p></details>
        </>
      )}
      {material.type !== "text" && material.text && <details className="text-xs"><summary className="cursor-pointer font-medium">텍스트 대체</summary><p className="mt-2 whitespace-pre-line leading-relaxed">{material.text}</p></details>}
    </figure>
  );
}
