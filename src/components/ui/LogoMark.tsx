/**
 * 브랜드 마크. 사이드바·로그인·랜딩 헤더/푸터 네 곳이 같은 도안을 쓰므로 한 곳에 모은다.
 *
 * 파란 원 로고는 어두운 바탕에 묻히므로 흰 원 테두리(2px)를 둘러 쓴다(DESIGN.md 5장).
 */
function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-white p-[2px]"
      style={{ width: size, height: size }}
    />
  )
}

export default LogoMark
