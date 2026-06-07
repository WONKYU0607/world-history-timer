# CHRONOS — 세계사 연대기 지도

평면 세계지도(equirectangular) 위에 기원전부터 현재까지의 역사적 사건을
시간축 슬라이더로 펼쳐 보는 React 앱.

## 개발
```
npm install
npm run dev
```

## 배포 (Vercel)
GitHub 저장소에 push하면 Vercel이 자동 감지 → 빌드 → 배포.
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

## 다음 작업
- [ ] 시간축 구간 가변 스케일 (고대 넓게 / 근현대 좁게)
- [ ] Wikidata 실데이터 자동 수집 (현재는 샘플 25건 하드코딩)
- [ ] 줌/팬 (d3-zoom)
