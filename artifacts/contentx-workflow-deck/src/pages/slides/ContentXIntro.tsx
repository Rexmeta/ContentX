const base = import.meta.env.BASE_URL;

export default function ContentXIntro() {
  return (
    <div className="paper-noise relative w-screen h-screen overflow-hidden bg-bg font-body text-text">
      <div className="absolute left-[5vw] top-[6vh] flex items-center gap-[1vw]">
        <div className="h-[1.25vw] w-[1.25vw] rotate-45 bg-primary" />
        <span className="text-[1.8vw] font-bold tracking-[0.18em]">CONTENTX</span>
      </div>
      <div className="absolute left-[5vw] top-[23vh] z-10 w-[50vw]">
        <p className="mb-[2vh] text-[1.75vw] font-bold tracking-[0.16em] text-primary">AI WORKFLOW REVIEW</p>
        <h1 className="font-display text-[7vw] leading-[1.06] tracking-tight text-wrap-balance">
          ContentX
        </h1>
        <p className="mt-[3.5vh] max-w-[42vw] break-keep text-[3.1vw] font-bold leading-[1.35] text-wrap-pretty">
          AI 생성 과정을 함께 확인하는 워크플로
        </p>
        <div className="mt-[7vh] grid max-w-[47vw] grid-cols-2 gap-[1.2vw]">
          <div className="border-t-[0.3vw] border-primary pt-[1.8vh] text-[2vw] leading-[1.55]">
            결과만 기다리는 대신, 단계별 입력·결과·검증을 확인
          </div>
          <div className="border-t-[0.3vw] border-accent pt-[1.8vh] text-[2vw] leading-[1.55]">
            필요한 순간에 승인·수정·재실행
          </div>
        </div>
      </div>
      <div className="absolute right-[4vw] top-[13vh] h-[73vh] w-[43vw] overflow-hidden rounded-[2vw] bg-[#dfe5df]">
        <img
          src={`${base}workflow-hero.jpg`}
          crossOrigin="anonymous"
          alt="단계별 AI 워크플로 추상 일러스트"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-[24vh] bg-gradient-to-t from-[#17312c]/75 to-transparent" />
        <div className="absolute bottom-[4vh] left-[3vw] right-[3vw] border-t border-[#f3f0e9]/50 pt-[2vh] text-[1.7vw] font-bold tracking-[0.12em] text-[#f3f0e9]">
          INPUT → REVIEW → OUTPUT
        </div>
      </div>
      <div className="absolute bottom-[5vh] left-[5vw] text-[1.6vw] font-medium tracking-[0.12em] text-muted">PROJECT OVERVIEW</div>
    </div>
  );
}