import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";

// ── 카테고리 정의 (전 분야) ──────────────────────────────
const CATS = {
  war:     { ko: "전쟁·정치", color: "#b3402e" },
  thought: { ko: "문화·사상", color: "#c98a2b" },
  science: { ko: "과학·기술", color: "#2f6b5e" },
  religion:{ ko: "종교",      color: "#7a5ba6" },
  disaster:{ ko: "재난",      color: "#555049" },
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

// 연도 표기
function fmtYear(y) {
  const r = Math.round(y);
  return r < 0 ? `기원전 ${-r}년` : `서기 ${r}년`;
}

const MAP_URL =
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson";

export default function Chronos() {
  const [geo, setGeo] = useState(null);
  const [mapErr, setMapErr] = useState(false);
  const [year, setYear] = useState(MIN_Y);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState(null);
  const [size, setSize] = useState({ w: 360, h: 180 });
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

  // 반응형 크기
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setSize({ w, h: w / 2 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 투영
  const projection = useMemo(() => {
    return d3.geoEquirectangular()
      .fitSize([size.w, size.h], { type: "Sphere" });
  }, [size]);

  const pathGen = useMemo(() => d3.geoPath(projection), [projection]);

  // 재생 애니메이션
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const speed = (MAX_Y - MIN_Y) / 18000; // 18초에 전체 주파
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

  // 현재 시점까지 등장한 사건
  const shown = useMemo(() => EVENTS.filter((e) => e.y <= year), [year]);

  const handlePlay = () => {
    if (year >= MAX_Y) setYear(MIN_Y);
    setPlaying((p) => !p);
  };

  return (
    <div style={styles.root}>
      <style>{fontCss}</style>

      {/* 헤더 */}
      <header style={styles.header}>
        <div style={styles.title}>CHRONOS</div>
        <div style={styles.subtitle}>세계사 연대기 지도</div>
      </header>

      {/* 지도 */}
      <div ref={wrapRef} style={styles.mapWrap}>
        <svg width={size.w} height={size.h} style={styles.svg}>
          {/* 바다 */}
          <rect x={0} y={0} width={size.w} height={size.h} fill="#dcd0b4" />
          {/* 경위선 */}
          <path d={pathGen(d3.geoGraticule10())} fill="none"
                stroke="#c4b48f" strokeWidth={0.5} />
          {/* 육지 */}
          {geo && geo.features.map((f, i) => (
            <path key={i} d={pathGen(f)} fill="#bfa873"
                  stroke="#a8895a" strokeWidth={0.4} />
          ))}
          {mapErr && (
            <text x={size.w / 2} y={size.h / 2} textAnchor="middle"
                  fill="#7a6a48" fontSize={11}>
              지도 데이터를 불러오지 못했습니다
            </text>
          )}
          {/* 사건 마커 */}
          {projection && shown.map((e, i) => {
            const p = projection([e.lng, e.lat]);
            if (!p) return null;
            const isLatest = e === shown[shown.length - 1];
            const col = CATS[e.c].color;
            return (
              <g key={i} transform={`translate(${p[0]},${p[1]})`}
                 style={{ cursor: "pointer" }}
                 onClick={() => setSel(e)}>
                {isLatest && (
                  <circle r={8} fill={col} opacity={0.25}>
                    <animate attributeName="r" values="4;12;4"
                             dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0;0.4"
                             dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle r={isLatest ? 4 : 3} fill={col}
                        stroke="#f5edd6" strokeWidth={1} />
              </g>
            );
          })}
        </svg>
      </div>

      {/* 현재 연도 */}
      <div style={styles.yearLine}>
        <span style={styles.yearBig}>{fmtYear(year)}</span>
        <span style={styles.count}>· 누적 사건 {shown.length}건</span>
      </div>

      {/* 타임라인 */}
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
      <div style={styles.scaleRow}>
        <span>기원전 2600</span><span>0</span><span>현재</span>
      </div>

      {/* 범례 */}
      <div style={styles.legend}>
        {Object.values(CATS).map((c) => (
          <span key={c.ko} style={styles.legendItem}>
            <i style={{ ...styles.dot, background: c.color }} />{c.ko}
          </span>
        ))}
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
    fontFamily: FB, background: "#f5edd6", color: "#3a3024",
    minHeight: "100vh", padding: "16px 14px 28px",
    boxSizing: "border-box", maxWidth: 520, margin: "0 auto",
  },
  header: { textAlign: "center", marginBottom: 12 },
  title: {
    fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 30,
    letterSpacing: 6, color: "#5c4326",
  },
  subtitle: { fontSize: 13, color: "#8a7350", letterSpacing: 2, marginTop: 2 },
  mapWrap: {
    width: "100%", borderRadius: 4, overflow: "hidden",
    border: "2px solid #b09a6a", boxShadow: "0 4px 14px rgba(90,67,38,.25)",
  },
  svg: { display: "block" },
  yearLine: { textAlign: "center", margin: "14px 0 6px" },
  yearBig: {
    fontFamily: "'Cinzel', serif", fontSize: 22, fontWeight: 700,
    color: "#5c4326",
  },
  count: { fontSize: 13, color: "#8a7350", marginLeft: 6 },
  timeline: { display: "flex", alignItems: "center", gap: 10 },
  playBtn: {
    flex: "0 0 auto", width: 42, height: 42, borderRadius: "50%",
    border: "none", background: "#5c4326", color: "#f5edd6",
    fontSize: 15, cursor: "pointer",
  },
  range: { flex: 1, accentColor: "#b3402e", height: 4 },
  scaleRow: {
    display: "flex", justifyContent: "space-between",
    fontSize: 10, color: "#a08c66", marginTop: 4, padding: "0 2px",
  },
  legend: {
    display: "flex", flexWrap: "wrap", gap: "6px 14px",
    justifyContent: "center", marginTop: 16, fontSize: 12, color: "#6b5a3e",
  },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 5 },
  dot: { width: 9, height: 9, borderRadius: "50%", display: "inline-block" },
  sheet: {
    position: "fixed", inset: 0, background: "rgba(40,30,15,.45)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    zIndex: 10,
  },
  card: {
    background: "#f5edd6", width: "100%", maxWidth: 520,
    borderRadius: "16px 16px 0 0", padding: "22px 22px 30px",
    borderTop: "3px solid #b3402e",
  },
  cardTag: {
    display: "inline-block", color: "#f5edd6", fontSize: 11,
    padding: "3px 10px", borderRadius: 20, letterSpacing: 1,
  },
  cardYear: {
    fontFamily: "'Cinzel', serif", fontSize: 15, color: "#8a7350",
    marginTop: 12,
  },
  cardTitle: {
    fontSize: 22, fontWeight: 700, color: "#4a3a22", margin: "4px 0 10px",
  },
  cardDesc: { fontSize: 15, lineHeight: 1.6, color: "#5a4a32" },
  close: {
    marginTop: 18, width: "100%", padding: "12px", border: "none",
    borderRadius: 10, background: "#5c4326", color: "#f5edd6",
    fontSize: 15, cursor: "pointer", fontFamily: FB,
  },
};
