export default function Checkpoints() {
  return (
    <div className="paper-noise relative w-screen h-screen overflow-hidden bg-bg font-body text-text">
      <div className="absolute left-[5vw] top-[6vh] text-[1.7vw] font-bold tracking-[0.16em] text-primary">02 — VISIBILITY</div>
      <h1 className="absolute left-[5vw] top-[14vh] max-w-[72vw] font-display text-[4.6vw] leading-[1.2] text-wrap-balance">
        해결: 결과를 단계별 체크포인트로 공개
      </h1>
      <div className="absolute left-[5vw] top-[35vh] flex w-[90vw] items-stretch gap-[1vw]">
        <div className="w-[21vw] bg-[#e7e2d8] p-[2vw]">
          <div className="mb-[5vh] text-[1.65vw] font-bold tracking-[0.13em] text-primary">01 INPUT</div>
          <p className="text-[2.2vw] font-bold leading-[1.42]">사용한 입력: 이번 단계에 실제로 전달된 내용</p>
        </div>
        <div className="w-[21vw] bg-[#e1e7e2] p-[2vw]">
          <div className="mb-[5vh] text-[1.65vw] font-bold tracking-[0.13em] text-accent">02 PREVIEW</div>
          <p className="text-[2.2vw] font-bold leading-[1.42]">중간 결과: 현재까지 만들어진 결과 요약</p>
        </div>
        <div className="w-[21vw] bg-[#e7e2d8] p-[2vw]">
          <div className="mb-[5vh] text-[1.65vw] font-bold tracking-[0.13em] text-primary">03 CHECK</div>
          <p className="text-[2.2vw] font-bold leading-[1.42]">검증 결과: 누락·불일치·실패 여부</p>
        </div>
        <div className="w-[21vw] bg-[#e1e7e2] p-[2vw]">
          <div className="mb-[5vh] text-[1.65vw] font-bold tracking-[0.13em] text-accent">04 HANDOFF</div>
          <p className="text-[2.2vw] font-bold leading-[1.42]">다음 단계 전달: 다음 단계가 이어받을 내용</p>
        </div>
      </div>
      <div className="absolute bottom-[7vh] left-[5vw] right-[5vw] flex items-center gap-[2vw] border-y border-text/15 py-[2.4vh]">
        <div className="h-[1vw] w-[1vw] rotate-45 bg-primary" />
        <p className="text-[2vw] font-bold leading-[1.4]">내부 추론·숨은 프롬프트·provider trace는 저장·표시하지 않음</p>
      </div>
    </div>
  );
}