export default function Validation() {
  return (
    <div className="paper-noise relative w-screen h-screen overflow-hidden bg-bg font-body text-text">
      <div className="absolute left-[5vw] top-[6vh] text-[1.7vw] font-bold tracking-[0.16em] text-primary">05 — VALIDATION</div>
      <h1 className="absolute left-[5vw] top-[14vh] font-display text-[5.2vw] leading-[1.2]">검증된 변화</h1>
      <div className="absolute left-[5vw] top-[31vh] flex w-[90vw] items-end gap-[4vw] border-b border-text/20 pb-[4vh]">
        <div>
          <div className="font-display text-[10vw] leading-none text-primary">240</div>
          <p className="mt-[1.5vh] text-[2vw] font-bold">API 전체 테스트 240개 통과</p>
        </div>
        <div className="mb-[0.3vh] h-[14vh] w-[0.16vw] bg-text/20" />
        <div>
          <div className="font-display text-[10vw] leading-none text-accent">64</div>
          <p className="mt-[1.5vh] text-[2vw] font-bold">ContentX 전체 테스트 64개 통과</p>
        </div>
      </div>
      <div className="absolute bottom-[8vh] left-[5vw] grid w-[90vw] grid-cols-3 gap-[1.5vw]">
        <div className="border-t-[0.35vw] border-primary pt-[2vh]">
          <p className="text-[2vw] font-bold leading-[1.5]">API·ContentX·공용 라이브러리 타입체크 통과</p>
        </div>
        <div className="border-t-[0.35vw] border-accent pt-[2vh]">
          <p className="text-[2vw] font-bold leading-[1.5]">체크포인트 표시·입력 수정·단계 승인·최종 완료 E2E 확인</p>
        </div>
        <div className="border-t-[0.35vw] border-primary pt-[2vh]">
          <p className="text-[2vw] font-bold leading-[1.5]">새로고침 및 두 탭 경쟁 상황에서도 진행 상태와 완료 결과 유지</p>
        </div>
      </div>
    </div>
  );
}