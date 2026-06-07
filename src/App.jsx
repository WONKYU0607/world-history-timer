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
// 사건 데이터는 events.json에서 로드

const MIN_Y = -4000, MAX_Y = 2030;

const BASE_RATE = 25;          // 1배속 = 25년/초
const FADE_YEARS = 60;         // 사건이 점+박스로 떠 있는 연도 폭
const SPEED_PRESETS = [0.5, 1, 2, 4];   // 배속 프리셋 (±로 미세조정 가능)
const SPEED_MIN = 0.1, SPEED_MAX = 8;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = (v) => Math.round(v * 10) / 10;

function fmtYear(y) {
  const r = Math.round(y);
  return r < 0 ? `기원전 ${-r}년` : `서기 ${r}년`;
}

const MAP_URL =
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson";

// 본토 중심으로도 영토 밖으로 나가는 나라들의 라벨 좌표 보정 [lng, lat]
const LABEL_FIX = {
  "아이티": [-72.147, 18.944],
  "노르웨이": [12.221, 64.637],
  "이스라엘": [34.691, 31.421],
  "베트남": [107.777, 15.994],
  "크로아티아": [15.584, 44.545],
};

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
  const [events, setEvents] = useState([]);
  const [year, setYear] = useState(MIN_Y);
  const [playing, setPlaying] = useState(false);
  const [mult, setMult] = useState(1);
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

  // 사건 데이터 로드 (연도순 정렬되어 있음)
  useEffect(() => {
    let alive = true;
    fetch("/events.json")
      .then((r) => r.json())
      .then((j) => { if (alive) setEvents(j); })
      .catch(() => {});
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
      .scaleExtent([1, 8])
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
  // 멀티폴리곤은 본토(최대 면적) 중심 사용. 그래도 영토 밖인 5개국은 직접 보정
  const labels = useMemo(() => {
    if (!geo) return [];
    return geo.features
      .map((f) => {
        const name = f.properties.NAME_KO || f.properties.NAME;
        let xy;
        if (LABEL_FIX[name]) {
          xy = projection(LABEL_FIX[name]);
        } else if (f.geometry.type === "MultiPolygon") {
          let best = null, bestA = -1;
          for (const poly of f.geometry.coordinates) {
            const pg = { type: "Polygon", coordinates: poly };
            const a = d3.geoArea(pg);
            if (a > bestA) { bestA = a; best = pg; }
          }
          xy = pathGen.centroid(best);
        } else {
          xy = pathGen.centroid(f);
        }
        return { name, x: xy[0], y: xy[1], a: pathGen.area(f) };
      })
      .filter((l) => l.name && !isNaN(l.x) && !isNaN(l.y))
      .sort((p, q) => q.a - p.a);
  }, [geo, pathGen, projection]);

  // 줌 배율에 따라 표시할 라벨 개수 (1배→큰 나라 위주, 8배→전부)
  const visCount = Math.round(16 + (labels.length - 16) * Math.min(1, (zt.k - 1) / 7));

  // 재생 애니메이션 (배속 반영)
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const speed = (BASE_RATE * mult) / 1000;   // 년/ms
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
  }, [playing, mult]);

  // 현재 시점에 "떠 있는" 사건만 (등장 후 FADE_YEARS 동안). 누적하지 않음
  const active = useMemo(
    () => events.filter((e) => year >= e.y && year < e.y + FADE_YEARS),
    [year, events]
  );

  const handlePlay = () => {
    if (year >= MAX_Y) setYear(MIN_Y);
    setPlaying((p) => !p);
  };
  const jump = (d) => { setPlaying(false); setYear((y) => clamp(y + d, MIN_Y, MAX_Y)); };
  const stepMult = (d) => setMult((m) => clamp(round1(m + d), SPEED_MIN, SPEED_MAX));
  const fmtMult = (m) => (Number.isInteger(m) ? m : m.toFixed(1)) + "×";

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

          {/* 사건 마커 — 현재 떠 있는 사건만, 배율로 크기 고정 */}
          {projection && active.map((e, i) => {
            const p = projection([e.lng, e.lat]);
            if (!p) return null;
            const col = CATS[e.c].color;
            const k = zt.k;
            const prog = (year - e.y) / FADE_YEARS;        // 0~1
            const op = prog > 0.8 ? Math.max(0, (1 - prog) / 0.2) : 1;
            return (
              <g key={e.y + "_" + i} transform={`translate(${p[0]},${p[1]})`}
                 opacity={op} style={{ cursor: "pointer" }}
                 onClick={() => setSel(e)}>
                <circle r={8 / k} fill={col} opacity={0.25}>
                  <animate attributeName="r"
                           values={`${4 / k};${13 / k};${4 / k}`}
                           dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.45;0;0.45"
                           dur="1.6s" repeatCount="indefinite" />
                </circle>
                <circle r={4.5 / k} fill={col}
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

      {/* 꼬리박스 — 현재 떠 있는 사건 라벨 (점 위에 떴다 사라짐) */}
      {projection && active.map((e, i) => {
        const p = projection([e.lng, e.lat]);
        if (!p) return null;
        const sx = zt.x + p[0] * zt.k;
        const sy = zt.y + p[1] * zt.k;
        const prog = (year - e.y) / FADE_YEARS;
        const op = prog > 0.8 ? Math.max(0, (1 - prog) / 0.2) : 1;
        return (
          <div key={e.y + "_b" + i}
               style={{ ...styles.toast, left: sx, top: sy, opacity: op }}
               onClick={() => setSel(e)}>
            <span style={styles.toastYear}>{fmtYear(e.y)}</span> {e.t}
            <span style={styles.toastTail} />
          </div>
        );
      })}

      {/* 상단 타이틀 (오버레이) */}
      <header style={styles.header}>
        <span style={styles.title}>CHRONOS</span>
      </header>

      {/* 하단 컨트롤 (오버레이) */}
      <div style={styles.bottom}>
        <div style={styles.yearLine}>
          <span style={styles.yearBig}>{fmtYear(year)}</span>
        </div>
        <div style={styles.timeline}>
          <button onClick={() => jump(-100)} style={styles.skipBtn}>◀◀</button>
          <button onClick={handlePlay} style={styles.playBtn}>
            {playing ? "❚❚" : "▶"}
          </button>
          <button onClick={() => jump(100)} style={styles.skipBtn}>▶▶</button>
          <input
            type="range" min={MIN_Y} max={MAX_Y} step={1}
            value={year}
            onChange={(e) => { setPlaying(false); setYear(+e.target.value); }}
            style={styles.range}
          />
        </div>
        <div style={styles.speedRow}>
          {SPEED_PRESETS.map((m) => (
            <button key={m} onClick={() => setMult(m)}
              style={{ ...styles.speedBtn, ...(mult === m ? styles.speedOn : {}) }}>
              {fmtMult(m)}
            </button>
          ))}
          <span style={styles.speedDiv} />
          <button onClick={() => stepMult(-0.1)} style={styles.stepBtn}>−</button>
          <span style={styles.multVal}>{fmtMult(mult)}</span>
          <button onClick={() => stepMult(0.1)} style={styles.stepBtn}>＋</button>
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
  timeline: { display: "flex", alignItems: "center", gap: 8 },
  skipBtn: {
    flex: "0 0 auto", width: 38, height: 38, borderRadius: "50%",
    border: "none", background: "rgba(255,255,255,.85)", color: "#1b3a52",
    fontSize: 12, cursor: "pointer",
  },
  speedRow: {
    display: "flex", justifyContent: "center", alignItems: "center",
    gap: 6, marginTop: 12, flexWrap: "wrap",
  },
  speedBtn: {
    border: "none", borderRadius: 14, padding: "5px 11px",
    background: "rgba(255,255,255,.18)", color: "#eef3f7",
    fontSize: 12, cursor: "pointer", fontFamily: FB,
  },
  speedOn: { background: "#fff", color: "#1b3a52", fontWeight: 700 },
  speedDiv: { width: 1, height: 18, background: "rgba(255,255,255,.3)", margin: "0 2px" },
  stepBtn: {
    width: 30, height: 30, borderRadius: "50%", border: "none",
    background: "rgba(255,255,255,.18)", color: "#fff",
    fontSize: 16, lineHeight: 1, cursor: "pointer",
  },
  multVal: {
    minWidth: 42, textAlign: "center", color: "#fff",
    fontSize: 13, fontWeight: 700,
  },
  toast: {
    position: "absolute", transform: "translate(-50%, calc(-100% - 12px))",
    background: "rgba(20,30,40,.92)", color: "#fff", fontFamily: FB,
    fontSize: 13, lineHeight: 1.3, padding: "6px 10px", borderRadius: 8,
    whiteSpace: "nowrap", maxWidth: "70vw", overflow: "hidden",
    textOverflow: "ellipsis", boxShadow: "0 2px 8px rgba(0,0,0,.4)",
    cursor: "pointer", pointerEvents: "auto", zIndex: 5,
  },
  toastYear: { color: "#ffd27a", fontWeight: 700 },
  toastTail: {
    position: "absolute", left: "50%", bottom: -5, transform: "translateX(-50%)",
    width: 0, height: 0, borderLeft: "5px solid transparent",
    borderRight: "5px solid transparent", borderTop: "6px solid rgba(20,30,40,.92)",
  },
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
