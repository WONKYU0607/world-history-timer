import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";

// ── 카테고리 (마커 색 구분용. 하단 범례는 제거) ────────────
const CATS = {
  war:     { ko: "전쟁·정치", color: "#c0392b" },
  thought: { ko: "문화·사상", color: "#d68910" },
  science: { ko: "과학·기술", color: "#1e8449" },
  religion:{ ko: "종교",      color: "#6c3483" },
  disaster:{ ko: "재난",      color: "#4d5656" },
};

// ── 샘플 사건 데이터 (year: 음수=기원전) ──────────────────
const EVENTS = [
  { y: -2560, lat: 29.98, lng: 31.13,  c: "thought",  t: "기자 대피라미드 건설", d: "쿠푸왕의 대피라미드가 이집트 기자에 세워지다." },
  { y: -1754, lat: 32.54, lng: 44.42,  c: "thought",  t: "함무라비 법전", d: "바빌론에서 성문법전이 반포되다." },
  { y: -551,  lat: 35.60, lng: 116.99, c: "thought",  t: "공자 탄생", d: "유교의 시조 공자가 노나라 취푸에서 태어나다." },
  { y: -563,  lat: 27.49, lng: 83.28,  c: "religion", t: "석가모니 탄생", d: "룸비니에서 불교의 창시자가 태어나다." },
  { y: -334,  lat: 29.94, lng: 52.89,  c: "war",      t: "알렉산더 동방원정", d: "마케도니아가 페르시아 제국을 정복하다." },
  { y: -221,  lat: 34.27, lng: 108.95, c: "war",      t: "진(秦)의 중국 통일", d: "진시황이 최초로 중국을 통일하다." },
  { y: 79,    lat: 40.75, lng: 14.49,  c: "disaster", t: "베수비오 화산 폭발", d: "폼페이가 화산재에 묻히다." },
  { y: 610,   lat: 21.42, lng: 39.83,  c: "religion", t: "이슬람교 성립", d: "메카에서 무함마드가 계시를 받다." },
  { y: 918,   lat: 37.97, lng: 126.55, c: "war",      t: "고려 건국", d: "왕건이 개성에서 고려를 세우다." },
  { y: 1096,  lat: 31.78, lng: 35.22,  c: "war",      t: "1차 십자군", d: "예루살렘을 향한 십자군 원정이 시작되다." },
  { y: 1206,  lat: 47.92, lng: 106.92, c: "war",      t: "몽골 제국 성립", d: "칭기즈 칸이 몽골 부족을 통일하다." },
  { y: 1443,  lat: 37.58, lng: 126.98, c: "thought",  t: "훈민정음 창제", d: "세종이 한글을 만들다." },
  { y: 1450,  lat: 50.00, lng: 8.27,   c: "science",  t: "활판 인쇄술", d: "구텐베르크가 금속활자 인쇄를 시작하다." },
  { y: 1492,  lat: 24.0,  lng: -74.5,  c: "war",      t: "콜럼버스 신대륙 도착", d: "유럽과 아메리카가 연결되다." },
  { y: 1592,  lat: 35.10, lng: 129.04, c: "war",      t: "임진왜란", d: "일본의 침략으로 조선에서 전쟁이 벌어지다." },
  { y: 1687,  lat: 51.51, lng: -0.13,  c: "science",  t: "프린키피아 출간", d: "뉴턴이 만유인력 법칙을 발표하다." },
  { y: 1776,  lat: 39.95, lng: -75.16, c: "war",      t: "미국 독립선언", d: "필라델피아에서 독립이 선언되다." },
  { y: 1789,  lat: 48.85, lng: 2.35,   c: "war",      t: "프랑스 혁명", d: "파리에서 시민혁명이 일어나다." },
  { y: 1859,  lat: 51.51, lng: -0.13,  c: "science",  t: "종의 기원", d: "다윈이 진화론을 발표하다." },
  { y: 1914,  lat: 43.85, lng: 18.41,  c: "war",      t: "제1차 세계대전", d: "사라예보 사건으로 대전이 발발하다." },
  { y: 1939,  lat: 52.23, lng: 21.01,  c: "war",      t: "제2차 세계대전", d: "독일의 폴란드 침공으로 전쟁이 시작되다." },
  { y: 1969,  lat: 28.57, lng: -80.65, c: "science",  t: "아폴로 11호 달 착륙", d: "인류가 처음으로 달을 밟다." },
  { y: 1989,  lat: 52.52, lng: 13.40,  c: "war",      t: "베를린 장벽 붕괴", d: "냉전의 상징이 무너지다." },
  { y: 1991,  lat: 46.23, lng: 6.05,   c: "science",  t: "월드와이드웹 공개", d: "CERN에서 웹이 세상에 공개되다." },
  { y: 2007,  lat: 37.33, lng: -122.03,c: "science",  t: "스마트폰 시대", d: "쿠퍼티노에서 아이폰이 발표되다." },
];

const MIN_Y = -2600, MAX_Y = 2030;

function fmtYear(y) {
  const r = Math.round(y);
  return r < 0 ? `기원전 ${-r}년` : `서기 ${r}년`;
}

const MAP_URL =
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson";

// ── 위성 지구 텍스처 (equirectangular) ───────────────────
const EARTH_URL =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_atmos_2048.jpg";

// 위성 로드 실패 시 폴백용 벡터 색상
const C_OCEAN  = "#1a3a5c";   // 바다 (위성 톤)
const C_LAND   = "#3c6b4a";   // 육지
const C_BORDER = "#2c4a38";   // 국경선

export default function Chronos() {
  const [geo, setGeo] = useState(null);
  const [mapErr, setMapErr] = useState(false);
  const [year, setYear] = useState(MIN_Y);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [size, setSize] = useState({ w: 360, h: 640 });
  const [zt, setZt] = useState({ k: 1, x: 0, y: 0 });
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const rafRef = useRef(null);

  // 지도 데이터 로드
  useEffect(() => {
    let alive = true;
    fetch(MAP_URL)
      .then((r) => r.json())
      .then((j) => { if (alive) setGeo(j); })
      .catch(() => { if (alive) setMapErr(true); });
    return () => { alive = false; };
  }, []);

  // 화면 전체 크기 추적
  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 투영 — 화면 전체에 맞춤
  const projection = useMemo(() => {
    return d3.geoEquirectangular()
      .fitSize([size.w, size.h], { type: "Sphere" });
  }, [size]);

  const pathGen = useMemo(() => d3.geoPath(projection), [projection]);

  // 줌/팬 (핀치·휠·드래그). 최대 4배, 더블클릭 줌 비활성
  useEffect(() => {
    if (!svgRef.current) return;
    const sel = d3.select(svgRef.current);
    const zoom = d3.zoom()
      .scaleExtent([1, 4])
      .translateExtent([[0, 0], [size.w, size.h]])
      .on("zoom", (e) => setZt({ k: e.transform.k, x: e.transform.x, y: e.transform.y }));
    sel.call(zoom).on("dblclick.zoom", null);
    return () => sel.on(".zoom", null);
  }, [size]);

  // 위성 이미지가 깔릴 영역 (equirectangular 전체 범위)
  const imgRect = useMemo(() => {
    const tl = projection([-180, 90]);
    const br = projection([180, -90]);
    if (!tl || !br) return null;
    return { x: tl[0], y: tl[1], w: br[0] - tl[0], h: br[1] - tl[1] };
  }, [projection]);

  // 국가 라벨 (한글명·중심좌표·면적). 면적 큰 순 정렬
  const labels = useMemo(() => {
    if (!geo) return [];
    return geo.features
      .map((f) => {
        const c = pathGen.centroid(f);
        const a = pathGen.area(f);
        const name = f.properties.NAME_KO || f.properties.NAME;
        return { name, x: c[0], y: c[1], a };
      })
      .filter((l) => l.name && !isNaN(l.x) && !isNaN(l.y))
      .sort((p, q) => q.a - p.a);
  }, [geo, pathGen]);

  // 줌 배율에 따라 표시할 라벨 개수 (1배→큰 나라 위주, 4배→전부)
  const visCount = Math.round(16 + (labels.length - 16) * Math.min(1, (zt.k - 1) / 3));

  // 재생 애니메이션
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const speed = (MAX_Y - MIN_Y) / 18000;
    const tick = (now) => {
      const dt = now - last; last = now;
      setYear((y) => {
        const ny = y + dt * speed;
        if (ny >= MAX_Y) { setPlaying(false); return MAX_Y; }
        return ny;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  const shown = useMemo(() => EVENTS.filter((e) => e.y <= year), [year]);

  const handlePlay = () => {
    if (year >= MAX_Y) setYear(MIN_Y);
    setPlaying((p) => !p);
  };

  return (
    <div ref={wrapRef} style={styles.root}>
      <style>{fontCss}</style>

      {/* 지도 (화면 전체 배경) */}
      <svg ref={svgRef} width={size.w} height={size.h} style={styles.svg}>
        {/* 바다 배경 — 줌 영향 없이 항상 화면 전체 */}
        <rect x={0} y={0} width={size.w} height={size.h} fill={C_OCEAN} />

        {/* 줌/팬 적용 그룹 */}
        <g transform={`translate(${zt.x},${zt.y}) scale(${zt.k})`}>
          {/* 위성 텍스처 (정상) / 벡터 지도 (폴백) */}
          {!imgError && imgRect ? (
            <>
              <image
                href={EARTH_URL} xlinkHref={EARTH_URL}
                x={imgRect.x} y={imgRect.y} width={imgRect.w} height={imgRect.h}
                preserveAspectRatio="none"
                onError={() => setImgError(true)}
              />
              {/* 위성 위 국경선 */}
              {geo && geo.features.map((f, i) => (
                <path key={i} d={pathGen(f)} fill="none"
                      stroke="#ffffff" strokeOpacity={0.55}
                      strokeWidth={0.6 / zt.k} />
              ))}
            </>
          ) : (
            geo && geo.features.map((f, i) => (
              <path key={i} d={pathGen(f)} fill={C_LAND}
                    stroke={C_BORDER} strokeWidth={0.4 / zt.k} />
            ))
          )}

          {/* 사건 마커 — 배율로 나눠 화면상 크기 고정 */}
          {projection && shown.map((e, i) => {
            const p = projection([e.lng, e.lat]);
            if (!p) return null;
            const isLatest = e === shown[shown.length - 1];
            const col = CATS[e.c].color;
            const k = zt.k;
            return (
              <g key={i} transform={`translate(${p[0]},${p[1]})`}
                 style={{ cursor: "pointer" }}
                 onClick={() => setSel(e)}>
                {isLatest && (
                  <circle r={8 / k} fill={col} opacity={0.25}>
                    <animate attributeName="r"
                             values={`${4 / k};${13 / k};${4 / k}`}
                             dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.45;0;0.45"
                             dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle r={(isLatest ? 4.5 : 3.2) / k} fill={col}
                        stroke="#fff" strokeWidth={1.2 / k} />
              </g>
            );
          })}

          {/* 국가명 라벨 — 줌 배율 따라 표시 개수 증가, 글자 크기 고정 */}
          {labels.slice(0, visCount).map((l, i) => (
            <text key={"L" + i} x={l.x} y={l.y}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={11 / zt.k} fontWeight={700}
                  fill="#fff" stroke="rgba(0,0,0,.65)"
                  strokeWidth={2.6 / zt.k} paintOrder="stroke"
                  style={{ pointerEvents: "none" }}>
              {l.name}
            </text>
          ))}
        </g>
      </svg>

      {/* 상단 타이틀 (오버레이) */}
      <header style={styles.header}>
        <span style={styles.title}>CHRONOS</span>
      </header>

      {/* 하단 컨트롤 (오버레이) */}
      <div style={styles.bottom}>
        <div style={styles.yearLine}>
          <span style={styles.yearBig}>{fmtYear(year)}</span>
          <span style={styles.count}>· 누적 {shown.length}건</span>
        </div>
        <div style={styles.timeline}>
          <button onClick={handlePlay} style={styles.playBtn}>
            {playing ? "❚❚" : "▶"}
          </button>
          <input
            type="range" min={MIN_Y} max={MAX_Y} step={1}
            value={year}
            onChange={(e) => { setPlaying(false); setYear(+e.target.value); }}
            style={styles.range}
          />
        </div>
      </div>

      {/* 사건 상세 시트 */}
      {sel && (
        <div style={styles.sheet} onClick={() => setSel(null)}>
          <div style={styles.card} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...styles.cardTag, background: CATS[sel.c].color }}>
              {CATS[sel.c].ko}
            </div>
            <div style={styles.cardYear}>{fmtYear(sel.y)}</div>
            <div style={styles.cardTitle}>{sel.t}</div>
            <div style={styles.cardDesc}>{sel.d}</div>
            <button style={styles.close} onClick={() => setSel(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

const fontCss =
  "@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Gowun+Batang:wght@400;700&display=swap');";

const FB = "'Gowun Batang', serif";
const styles = {
  root: {
    position: "fixed", inset: 0, overflow: "hidden",
    background: C_OCEAN, fontFamily: FB, color: "#2c2c2c",
  },
  svg: { position: "absolute", inset: 0, display: "block", touchAction: "none" },
  header: {
    position: "absolute", top: 0, left: 0, right: 0,
    textAlign: "center", padding: "12px 0 18px",
    background: "linear-gradient(rgba(20,40,60,.35), rgba(20,40,60,0))",
    pointerEvents: "none",
  },
  title: {
    fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 22,
    letterSpacing: 6, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.4)",
  },
  bottom: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: "20px 16px calc(18px + env(safe-area-inset-bottom))",
    background: "linear-gradient(rgba(20,40,60,0), rgba(20,40,60,.55))",
  },
  yearLine: { textAlign: "center", marginBottom: 8 },
  yearBig: {
    fontFamily: "'Cinzel', serif", fontSize: 22, fontWeight: 700,
    color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.5)",
  },
  count: { fontSize: 13, color: "#eef3f7", marginLeft: 6 },
  timeline: { display: "flex", alignItems: "center", gap: 10 },
  playBtn: {
    flex: "0 0 auto", width: 46, height: 46, borderRadius: "50%",
    border: "none", background: "#fff", color: "#1b3a52",
    fontSize: 16, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,.3)",
  },
  range: { flex: 1, accentColor: "#fff", height: 4 },
  sheet: {
    position: "fixed", inset: 0, background: "rgba(20,30,40,.45)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    zIndex: 10,
  },
  card: {
    background: "#fbf9f2", width: "100%", maxWidth: 520,
    borderRadius: "16px 16px 0 0", padding: "22px 22px 30px",
    borderTop: "3px solid #1b3a52",
  },
  cardTag: {
    display: "inline-block", color: "#fff", fontSize: 11,
    padding: "3px 10px", borderRadius: 20, letterSpacing: 1,
  },
  cardYear: {
    fontFamily: "'Cinzel', serif", fontSize: 15, color: "#888",
    marginTop: 12,
  },
  cardTitle: {
    fontSize: 22, fontWeight: 700, color: "#2c2c2c", margin: "4px 0 10px",
  },
  cardDesc: { fontSize: 15, lineHeight: 1.6, color: "#4a4a4a" },
  close: {
    marginTop: 18, width: "100%", padding: "12px", border: "none",
    borderRadius: 10, background: "#1b3a52", color: "#fff",
    fontSize: 15, cursor: "pointer", fontFamily: FB,
  },
};
