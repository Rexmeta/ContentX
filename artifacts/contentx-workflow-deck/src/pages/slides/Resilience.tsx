export default function Resilience() {
  return (
    <div className="paper-noise relative w-screen h-screen overflow-hidden bg-bg font-body text-text">
      <div className="absolute left-[5vw] top-[6vh] text-[1.7vw] font-bold tracking-[0.16em] text-primary">04 — RESILIENCE</div>
      <h1 className="absolute left-[5vw] top-[14vh] max-w-[82vw] font-display text-[4.4vw] leading-[1.2] text-wrap-balance">
        새로고침과 여러 탭에서도 실행 의도를 지킨다
      </h1>
      <div className="absolute left-[7vw] top-[35vh] h-[48vh] w-[0.22vw] bg-text/20" />
      <div className="absolute left-[5vw] top-[33vh] flex w-[87vw] items-center gap-[2vw]">
        <div className="h-[2.5vw] w-[2.5vw] rotate-45 bg-primary" />
        <p className="text-[2.3vw] font-bold leading-[1.45]">서버가 단계 진행을 직렬화하고 runId로 실행 소유권을 보호</p>
      </div>
      <div className="absolute left-[5vw] top-[44vh] flex w-[87vw] items-center gap-[2vw]">
        <div className="h-[2.5vw] w-[2.5vw] rotate-45 bg-accent" />
        <p className="text-[2.3vw] font-bold leading-[1.45]">AI 요청은 90초 타임아웃과 취소 신호로 실패를 명확히 전환</p>
      </div>
      <div className="absolute left-[5vw] top-[55vh] flex w-[87vw] items-center gap-[2vw]">
        <div className="h-[2.5vw] w-[2.5vw] rotate-45 bg-primary" />
        <p className="text-[2.3vw] font-bold leading-[1.45]">heartbeat·stale recovery로 장시간 실행을 관리</p>
      </div>
      <div className="absolute left-[5vw] top-[66vh] flex w-[87vw] items-center gap-[2vw]">
        <div className="h-[2.5vw] w-[2.5vw] rotate-45 bg-accent" />
        <p className="text-[2.3vw] font-bold leading-[1.45]">새로고침 후 검토 대기 상태를 복원</p>
      </div>
      <div className="absolute left-[5vw] top-[77vh] flex w-[87vw] items-center gap-[2vw]">
        <div className="h-[2.5vw] w-[2.5vw] rotate-45 bg-primary" />
        <p className="text-[2.3vw] font-bold leading-[1.45]">여러 탭에서는 토큰·storage 이벤트·교차 탭 잠금으로 중복 재개를 방지</p>
      </div>
    </div>
  );
}