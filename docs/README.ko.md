<p align="center">
  <img src="../public/nexus-256.png" alt="Nexus" width="96" />
</p>

<h1 align="center">Nexus Lite</h1>

<p align="center">
  크로스플랫폼 데스크톱 AI 컴패니언 · 라이트 버전
</p>

<p align="center">
  <a href="../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <b>한국어</b>
</p>

---

## 개요

Nexus Lite는 크로스플랫폼 데스크톱 AI 컴패니언 앱입니다. Live2D 캐릭터 렌더링, 연속 음성 대화, 장기 기억, 데스크톱 인식, 자율 행동 기능을 갖추고 있습니다. 핵심 컴패니언 경험에 집중한 라이트 버전입니다.

---

## 주요 기능

- **펫 + 패널** 듀얼 뷰, Live2D 캐릭터 표정/모션/감정 연동
- **음성 대화** — 멀티엔진 STT(Sherpa·SenseVoice·FunASR·텐센트 ASR·Web Speech API) & TTS(Edge TTS·MiniMax·화산엔진·CosyVoice2·로컬 Sherpa TTS), 웨이크워드·VAD·연속 대화·음성 인터럽트
- **이벤트 버스 아키텍처** — VoiceBus가 음성 라이프사이클을 통합 관리, 순수 reducer + effect 패턴으로 상태 전환
- **장기 기억** — 시맨틱 벡터 검색, 데일리 다이어리 자동 생성, 능동적 리콜, 아카이브
- **데스크톱 인식** — 클립보드, 포그라운드 윈도우, 스크린샷 OCR
- **자율 행동** — 컨텍스트 스케줄링, 포커스 인식, 기억 정리, 프로액티브 엔진
- **도구 연동** — 웹 검색, 날씨, 리마인더, MCP 프로토콜
- **다국어** — 간체/번체 중국어 / 영어 / 일본어 / 한국어

---

## 빠른 시작

**시스템 요구사항**: Windows / macOS / Linux · Node.js 20+ · npm 10+

```bash
npm install
npm run electron:dev    # 개발 모드
npm run build           # 빌드
npm run package:win     # Windows 설치 프로그램 패키징
npm run package:mac     # macOS 설치 프로그램 패키징
npm run package:linux   # Linux 설치 프로그램 패키징
```

---

## 라이선스

[MIT](../LICENSE)
