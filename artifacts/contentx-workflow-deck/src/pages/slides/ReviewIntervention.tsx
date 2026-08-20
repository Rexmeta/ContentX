export default function ReviewIntervention() {
  return (
    <div className="paper-noise relative w-screen h-screen overflow-hidden bg-bg font-body text-text">
      <div className="absolute left-[5vw] top-[6vh] text-[1.7vw] font-bold tracking-[0.16em] text-primary">03 — INTERVENTION</div>
      <h1 className="absolute left-[5vw] top-[14vh] max-w-[72vw] font-display text-[4.6vw] leading-[1.2] text-wrap-balance">
        검토자는 흐름을 멈추고 개입할 수 있다
      </h1>
      <div className="absolute left-[5vw] top-[34vh] flex w-[88vw] items-center">
        <div className="w-[26vw] border-t-[0.55vw] border-primary pt-[2.2vh]">
          <div className="mb-[3vh] text-[1.7vw] font-bold tracking-[0.15em] text-primary">REVIEW</div>
          <p className="text-[2.35vw] font-bold leading-[1.45]">‘단계마다 검토’ 모드에서 각 완료 단계가 승인 대기로 전환</p>
        </div>
        <div className="mx-[2vw] h-[0.2vw] flex-1 bg-text/25" />
        <div className="h-[2.2vw] w-[2.2vw] rotate-45 bg-primary" />
        <div className="mx-[2vw] h-[0.2vw] flex-1 bg-text/25" />
        <div className="w-[26vw] border-t-[0.55vw] border-accent pt-[2.2vh]">
          <div className="mb-[3vh] text-[1.7vw] font-bold tracking-[0.15em] text-accent">CONTINUE</div>
          <p className="text-[2.35vw] font-bold leading-[1.45]">승인하면 의존 단계만 다음 순서로 진행</p>
        </div>
      </div>
      <div className="absolute bottom-[8vh] left-[5vw] grid w-[90vw] grid-cols-3 gap-[1.5vw]">
        <div className="bg-[#e1e7e2] p-[2vw]">
          <p className="text-[2.05vw] font-bold leading-[1.48]">입력을 수정하고 해당 단계부터 재실행</p>
        </div>
        <div className="bg-[#e7e2d8] p-[2vw]">
          <p className="text-[2.05vw] font-bold leading-[1.48]">완료 단계 재실행 시 하위 결과와 관련 산출물을 무효화</p>
        </div>
        <div className="bg-[#e1e7e2] p-[2vw]">
          <p className="text-[2.05vw] font-bold leading-[1.48]">마지막 단계까지 승인해야 최종 완료</p>
        </div>
      </div>
    </div>
  );
}