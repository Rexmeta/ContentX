export default function InvisibleProcess() {
  return (
    <div className="paper-noise relative w-screen h-screen overflow-hidden bg-bg font-body text-text">
      <div className="absolute left-[5vw] top-[6vh] text-[1.7vw] font-bold tracking-[0.16em] text-primary">01 — PROBLEM</div>
      <h1 className="absolute left-[5vw] top-[14vh] max-w-[78vw] font-display text-[4.6vw] leading-[1.2] text-wrap-balance">
        문제: 생성은 길어지고, 과정은 보이지 않았다
      </h1>
      <div className="absolute left-[5vw] top-[32vh] grid w-[56vw] grid-cols-2 gap-[1.3vw]">
        <div className="min-h-[22vh] bg-[#e7e2d8] p-[2vw]">
          <div className="mb-[2vh] h-[0.45vw] w-[5vw] bg-primary" />
          <p className="text-[2.15vw] font-bold leading-[1.45]">장시간 실행이 ‘실행 중’ 상태로 남으면 무엇을 기다리는지 알기 어려움</p>
        </div>
        <div className="min-h-[22vh] bg-[#e1e7e2] p-[2vw]">
          <div className="mb-[2vh] h-[0.45vw] w-[5vw] bg-accent" />
          <p className="text-[2.15vw] font-bold leading-[1.45]">새로고침·재접속 후 진행 상태를 잃기 쉬움</p>
        </div>
        <div className="min-h-[22vh] bg-[#e1e7e2] p-[2vw]">
          <div className="mb-[2vh] h-[0.45vw] w-[5vw] bg-accent" />
          <p className="text-[2.15vw] font-bold leading-[1.45]">최종 결과가 나오기 전에는 입력 오류를 바로잡기 어려움</p>
        </div>
        <div className="min-h-[22vh] bg-[#e7e2d8] p-[2vw]">
          <div className="mb-[2vh] h-[0.45vw] w-[5vw] bg-primary" />
          <p className="text-[2.15vw] font-bold leading-[1.45]">중간 승인이나 특정 단계부터의 재실행이 어려움</p>
        </div>
      </div>
      <div className="absolute right-[6vw] top-[35vh] flex h-[47vh] w-[25vw] flex-col justify-between border-l-[0.18vw] border-dashed border-muted/50 pl-[2.5vw]">
        <div className="relative">
          <div className="absolute -left-[3.2vw] top-[0.2vh] h-[1.3vw] w-[1.3vw] rounded-full bg-primary" />
          <div className="text-[1.7vw] font-bold tracking-[0.14em] text-muted">START</div>
        </div>
        <div className="relative">
          <div className="absolute -left-[3.2vw] top-[0.2vh] h-[1.3vw] w-[1.3vw] rounded-full bg-primary" />
          <div className="text-[1.7vw] font-bold tracking-[0.14em] text-muted">RUNNING</div>
        </div>
        <div className="relative">
          <div className="absolute -left-[3.2vw] top-[0.2vh] h-[1.3vw] w-[1.3vw] rounded-full bg-primary" />
          <div className="text-[1.7vw] font-bold tracking-[0.14em] text-muted">UNKNOWN</div>
        </div>
      </div>
    </div>
  );
}