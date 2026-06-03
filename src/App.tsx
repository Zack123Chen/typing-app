import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import * as Tone from "tone";
import { IELTS_ESSAYS } from "./ielts";

const WORDS = "the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were good great small large long short high low old young right left big".split(" ");

const QUOTES: readonly string[] = [
  "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle.",
  "Stay hungry. Stay foolish. Your time is limited, so don't waste it living someone else's life.",
  "Talk is cheap. Show me the code. Given enough eyeballs, all bugs are shallow.",
  "Premature optimization is the root of all evil. We should forget about small efficiencies most of the time.",
  "The best way to predict the future is to invent it. The future is already here, just not very evenly distributed.",
  "Simplicity is the ultimate sophistication. Make everything as simple as possible, but not simpler.",
  "It always seems impossible until it's done. The journey of a thousand miles begins with a single step.",
  "First, solve the problem. Then, write the code. Programs must be written for people to read.",
  "There are only two hard things in computer science: cache invalidation and naming things.",
  "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.",
] as const;

type TestType = "time" | "words" | "quotes" | "ielts" | "custom";
type Status = "waiting" | "running" | "finished";
type View = "home" | "test";

const TIME_OPTS = [15, 30, 60, 120] as const;
const WORD_OPTS = [10, 25, 50, 100] as const;
type TimeOpt = typeof TIME_OPTS[number];
type WordOpt = typeof WORD_OPTS[number];

const KEYBOARD = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const FINGER: Record<string, string> = {
  q: "#c25e4f", a: "#c25e4f", z: "#c25e4f",
  w: "#c8884a", s: "#c8884a", x: "#c8884a",
  e: "#b89a3e", d: "#b89a3e", c: "#b89a3e",
  r: "#7c8a4a", f: "#7c8a4a", v: "#7c8a4a", t: "#7c8a4a", g: "#7c8a4a", b: "#7c8a4a",
  y: "#4a8a86", h: "#4a8a86", n: "#4a8a86", u: "#4a8a86", j: "#4a8a86", m: "#4a8a86",
  i: "#5a6e9c", k: "#5a6e9c",
  o: "#7a5a9c", l: "#7a5a9c",
  p: "#9c5a86",
};

const C = {
  paper: "#f3e8cf", ink: "#2c2417", faded: "#bcab86", red: "#9c2b1b",
  desk: "#211b14", ivory: "#efe3c8", ring: "#6b5a44",
};

const LINE_H = 46;
const MAX_LEN = 2000;
const CPM = 200;
const SENT_END = [".", ".", ".", "?", "!"];

function calcTime(text: string): number {
  return Math.max(30, Math.min(300, Math.ceil((text.length / CPM) * 60)));
}

function rword(): string { return WORDS[Math.floor(Math.random() * WORDS.length)]; }

function genWordList(n: number, punct: boolean, nums: boolean): string[] {
  const arr: string[] = [];
  for (let i = 0; i < n; i++) arr.push(rword());
  if (nums) {
    for (let i = 0; i < arr.length; i++) {
      if (Math.random() < 0.1) {
        const len = 1 + Math.floor(Math.random() * 4);
        let s = "";
        for (let j = 0; j < len; j++) s += Math.floor(Math.random() * 10);
        arr[i] = s;
      }
    }
  }
  if (punct) {
    let start = true;
    for (let i = 0; i < arr.length; i++) {
      let w = arr[i];
      if (start && /^[a-z]/.test(w)) w = w[0].toUpperCase() + w.slice(1);
      start = false;
      const r = Math.random();
      if (i === arr.length - 1) {
        w += SENT_END[Math.floor(Math.random() * SENT_END.length)];
      } else if (r < 0.18) {
        w += SENT_END[Math.floor(Math.random() * SENT_END.length)];
        start = true;
      } else if (r < 0.32) {
        w += ",";
      } else if (r < 0.36) {
        w += ";";
      }
      arr[i] = w;
    }
  }
  return arr;
}

function genQuotes(): string {
  return [...QUOTES].sort(() => Math.random() - 0.5).slice(0, 3).join(" ");
}

const clean = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);

function genTarget(
  testType: TestType, timeOpt: TimeOpt, wordOpt: WordOpt,
  punct: boolean, nums: boolean, source: string | null, ieltsIndex: number,
): string {
  if (testType === "custom") return source ?? rword();
  if (testType === "ielts") return IELTS_ESSAYS[ieltsIndex % IELTS_ESSAYS.length].essay;
  if (source) return source;
  if (testType === "quotes") return genQuotes();
  if (testType === "words") return genWordList(wordOpt, punct, nums).join(" ");
  return genWordList(Math.max(80, timeOpt * 4), punct, nums).join(" ");
}

function durationFor(testType: TestType, timeOpt: TimeOpt, target: string): number {
  if (testType === "time") return timeOpt;
  return calcTime(target);
}

interface Override {
  testType?: TestType;
  timeOpt?: TimeOpt;
  wordOpt?: WordOpt;
  punct?: boolean;
  nums?: boolean;
  source?: string | null;
  ieltsIndex?: number;
}

export default function TypingApp() {
  const [view, setView] = useState<View>("home");
  const [testType, setTestType] = useState<TestType>("words");
  const [timeOpt, setTimeOpt] = useState<TimeOpt>(30);
  const [wordOpt, setWordOpt] = useState<WordOpt>(25);
  const [punct, setPunct] = useState(false);
  const [nums, setNums] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [ieltsIndex, setIeltsIndex] = useState(0);

  const [target, setTarget] = useState(() => genTarget("words", 30, 25, false, false, null, 0));
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState<Status>("waiting");
  const [totalTime, setTotalTime] = useState(() => durationFor("words", 30, target));
  const [timeLeft, setTimeLeft] = useState(() => durationFor("words", 30, target));
  const [wpmHistory, setWpmHistory] = useState<{ t: number; wpm: number; raw: number }[]>([]);
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [showCustom, setShowCustom] = useState(false);
  const [draft, setDraft] = useState("");
  const [fileName, setFileName] = useState("");
  const [offset, setOffset] = useState(0);
  const [soundOn, setSoundOn] = useState(true);

  const typedRef = useRef("");
  const targetRef = useRef(target);
  const totalTimeRef = useRef(totalTime);
  const caretRef = useRef<HTMLSpanElement | null>(null);
  const prevOffsetRef = useRef(0);
  const soundOnRef = useRef(true);
  const audioRef = useRef<{
    started: boolean;
    noise?: Tone.NoiseSynth;
    thock?: Tone.MembraneSynth;
    bell?: Tone.Synth;
  }>({ started: false });

  useEffect(() => {
    typedRef.current = typed;
    targetRef.current = target;
    totalTimeRef.current = totalTime;
    soundOnRef.current = soundOn;
  }, [typed, target, totalTime, soundOn]);

  // ── 音效 ──
  const initAudio = useCallback(async () => {
    const a = audioRef.current;
    if (a.started) return;
    try {
      await Tone.start();
      a.noise = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.025, sustain: 0 } }).toDestination();
      a.noise.volume.value = -22;
      a.thock = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).toDestination();
      a.thock.volume.value = -15;
      a.bell = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 } }).toDestination();
      a.bell.volume.value = -12;
      a.started = true;
    } catch {
      /* Tone is optional; ignore browser audio startup failures. */
    }
  }, []);
  const click = useCallback((wrong: boolean) => {
    if (!soundOnRef.current) return;
    const a = audioRef.current;
    try {
      if (a.noise) a.noise.triggerAttackRelease("32n");
      if (a.thock) a.thock.triggerAttackRelease(wrong ? "G1" : "C2", "32n");
    } catch {
      /* Tone is optional; ignore playback failures. */
    }
  }, []);
  const ding = useCallback(() => {
    if (!soundOnRef.current) return;
    const a = audioRef.current;
    try {
      if (a.bell) a.bell.triggerAttackRelease("C6", "16n");
    } catch {
      /* Tone is optional; ignore playback failures. */
    }
  }, []);

  // 统一 restart：根据 overrides 切换配置并重置
  const restart = useCallback((overrides?: Override) => {
    const tt = overrides?.testType ?? testType;
    const to = overrides?.timeOpt ?? timeOpt;
    const wo = overrides?.wordOpt ?? wordOpt;
    const p = overrides?.punct ?? punct;
    const n = overrides?.nums ?? nums;
    const s = overrides && "source" in overrides ? overrides.source ?? null : source;
    const ii = overrides?.ieltsIndex ?? ieltsIndex;

    if (overrides?.testType !== undefined) setTestType(overrides.testType);
    if (overrides?.timeOpt !== undefined) setTimeOpt(overrides.timeOpt);
    if (overrides?.wordOpt !== undefined) setWordOpt(overrides.wordOpt);
    if (overrides?.punct !== undefined) setPunct(overrides.punct);
    if (overrides?.nums !== undefined) setNums(overrides.nums);
    if (overrides && "source" in overrides) setSource(overrides.source ?? null);
    if (overrides?.ieltsIndex !== undefined) setIeltsIndex(overrides.ieltsIndex);

    const newTarget = genTarget(tt, to, wo, p, n, s, ii);
    const t = durationFor(tt, to, newTarget);
    setTarget(newTarget);
    setTotalTime(t);
    setTyped("");
    setTimeLeft(t);
    setWpmHistory([]);
    setOffset(0);
    prevOffsetRef.current = 0;
    setStatus("waiting");
    setView("test");
  }, [testType, timeOpt, wordOpt, punct, nums, source, ieltsIndex]);

  const gotoHome = useCallback(() => {
    setView("home");
    setStatus("waiting");
  }, []);

  // 键盘输入
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showCustom || view === "home") return;
      if (e.key === "Tab" || (e.key === "Enter" && status === "finished")) {
        e.preventDefault();
        restart();
        return;
      }
      if (status === "finished") return;
      if (e.key === "Backspace") {
        e.preventDefault();
        setTyped((t) => t.slice(0, -1));
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        initAudio();
        if (status === "waiting") setStatus("running");
        const currentTyped = typedRef.current;
        const currentTarget = targetRef.current;
        if (currentTyped.length >= currentTarget.length) return;

        const nextTyped = currentTyped + e.key;
        click(e.key !== currentTarget[currentTyped.length]);
        setTyped(nextTyped);

        if (testType === "time" && currentTarget.length - nextTyped.length < 120) {
          const more = genWordList(40, punct, nums).join(" ");
          setTarget((t) => `${t} ${more}`);
        } else if (testType !== "time" && nextTyped.length >= currentTarget.length) {
          ding();
          setStatus("finished");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, restart, showCustom, initAudio, click, view, testType, punct, nums, ding]);

  // 计时器：每秒采样 WPM / raw WPM
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        const elapsed = totalTimeRef.current - next;
        let correct = 0;
        const t = typedRef.current, tg = targetRef.current;
        for (let i = 0; i < t.length; i++) if (t[i] === tg[i]) correct++;
        const wpm = elapsed > 0 ? Math.round((correct / 5) / (elapsed / 60)) : 0;
        const raw = elapsed > 0 ? Math.round((t.length / 5) / (elapsed / 60)) : 0;
        setWpmHistory((h) => [...h, { t: elapsed, wpm, raw }]);
        if (next <= 0) { clearInterval(id); ding(); setStatus("finished"); return 0; }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [status, ding]);

  // 按行平滑滚动 + 回车铃
  useEffect(() => {
    const el = caretRef.current;
    const newOffset = el ? Math.max(0, el.offsetTop - LINE_H) : 0;
    if (newOffset > prevOffsetRef.current && status === "running") ding();
    prevOffsetRef.current = newOffset;
    setOffset(newOffset);
  }, [typed, target, showKeyboard, status, ding]);

  const stats = useMemo(() => {
    let correct = 0, incorrect = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === target[i]) correct++;
      else incorrect++;
    }
    const acc = typed.length ? Math.round((correct / typed.length) * 100) : 100;
    const elapsed = status === "waiting" ? 0 : totalTime - timeLeft;
    const wpm = elapsed > 0 ? Math.round((correct / 5) / (elapsed / 60)) : 0;
    const raw = elapsed > 0 ? Math.round((typed.length / 5) / (elapsed / 60)) : 0;
    return { correct, incorrect, acc, wpm, raw, elapsed };
  }, [typed, target, timeLeft, totalTime, status]);

  const consistency = useMemo(() => {
    const ws = wpmHistory.map((h) => h.wpm).filter((w) => w > 0);
    if (ws.length < 2) return 0;
    const mean = ws.reduce((a, b) => a + b, 0) / ws.length;
    if (mean === 0) return 0;
    const std = Math.sqrt(ws.reduce((a, b) => a + (b - mean) ** 2, 0) / ws.length);
    return Math.max(0, Math.min(100, Math.round(100 - (std / mean) * 100)));
  }, [wpmHistory]);

  const wordsTyped = useMemo(() => {
    if (testType !== "words") return 0;
    let c = 0;
    const limit = Math.min(typed.length, target.length);
    for (let i = 0; i < limit; i++) {
      if (target[i] === " " && typed[i] === " ") c++;
    }
    if (typed.length >= target.length && target.length > 0) c++;
    return Math.min(wordOpt, c);
  }, [typed, target, testType, wordOpt]);

  const nextChar = typed.length < target.length ? target[typed.length] : null;
  const nextKey = nextChar === " " ? "space" : nextChar ? nextChar.toLowerCase() : null;

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setDraft(clean(String(reader.result || "")));
    reader.readAsText(f);
  };

  const changeType = (tt: TestType) => {
    if (tt === "custom") {
      setDraft(source || "");
      setFileName("");
      setShowCustom(true);
      return;
    }
    if (tt === "ielts") {
      restart({ testType: "ielts", source: null });
      return;
    }
    restart({ testType: tt, source: null });
  };

  const TW_FONT = '"Courier New", Courier, monospace';

  const headerLeft =
    testType === "words" ? <Metric value={`${wordsTyped}/${wordOpt}`} label="WORDS" />
    : <Metric value={timeLeft} label="SEC" />;

  if (view === "home") {
    return (
      <div key="home" className="view-enter">
        <Home
          onPick={(tt, idx) => {
            if (tt === "ielts") restart({ testType: "ielts", source: null, ieltsIndex: idx ?? 0 });
            else if (tt === "custom") { setDraft(source || ""); setFileName(""); setView("test"); setShowCustom(true); }
            else restart({ testType: tt, source: null });
          }}
        />
      </div>
    );
  }

  return (
    <div key="test" className="view-enter min-h-screen flex flex-col items-center px-4 py-8" style={{ background: C.desk, fontFamily: TW_FONT }}>
      <style>{`@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
      <div className="w-full max-w-3xl">
        {/* 顶栏 */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={gotoHome} className="text-xl tracking-widest cursor-pointer" style={{ color: C.paper, background: "transparent", border: "none", padding: 0 }}>
            ░ THE TYPEWRITER ░
          </button>
          <div className="flex items-center gap-6 text-sm">
            {headerLeft}
            <Metric value={stats.wpm} label="WPM" />
            <Metric value={`${stats.acc}%`} label="ACC" />
          </div>
        </div>

        {/* 配置条 (monkeytype 风格) */}
        {status !== "finished" && (
          <div
            className="mb-4 px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs tracking-wide"
            style={{ background: "rgba(243,232,207,0.07)", border: "1px solid rgba(243,232,207,0.18)", borderRadius: 2, color: C.paper }}
          >
            <Pill active={punct} onClick={() => restart({ punct: !punct })}>@ punctuation</Pill>
            <Pill active={nums} onClick={() => restart({ nums: !nums })}># numbers</Pill>
            <Sep />
            <Pill active={testType === "time"} onClick={() => changeType("time")}>⏱ time</Pill>
            <Pill active={testType === "words"} onClick={() => changeType("words")}>A words</Pill>
            <Pill active={testType === "quotes"} onClick={() => changeType("quotes")}>" quotes</Pill>
            <Pill active={testType === "ielts"} onClick={() => changeType("ielts")}>🎓 ielts</Pill>
            <Pill active={testType === "custom"} onClick={() => changeType("custom")}>✎ custom</Pill>
            <Sep />
            {testType === "time" && TIME_OPTS.map((t) => (
              <Pill key={t} active={timeOpt === t} onClick={() => restart({ timeOpt: t })}>{t}</Pill>
            ))}
            {testType === "words" && WORD_OPTS.map((w) => (
              <Pill key={w} active={wordOpt === w} onClick={() => restart({ wordOpt: w })}>{w}</Pill>
            ))}
            {testType === "quotes" && <span style={{ color: C.faded }}>名言随机三段</span>}
            {testType === "ielts" && IELTS_ESSAYS.map((es, i) => (
              <Pill key={es.id} active={ieltsIndex === i} onClick={() => restart({ ieltsIndex: i })}>{es.topic}</Pill>
            ))}
            {testType === "custom" && source && (
              <Pill onClick={() => { setDraft(source); setShowCustom(true); }}>✎ edit ({source.length})</Pill>
            )}
          </div>
        )}

        {/* IELTS 题目卡片 */}
        {status !== "finished" && testType === "ielts" && (
          <div className="mb-3 px-5 py-3" style={{ background: "rgba(243,232,207,0.08)", border: `1px dashed ${C.ring}`, borderRadius: 2, color: C.paper }}>
            <div className="text-xs tracking-widest mb-1" style={{ color: C.faded }}>
              IELTS WRITING TASK 2 · {IELTS_ESSAYS[ieltsIndex].topic.toUpperCase()}
            </div>
            <div className="text-sm leading-relaxed" style={{ color: "#e8dcc0" }}>
              {IELTS_ESSAYS[ieltsIndex].question}
            </div>
          </div>
        )}

        {status !== "finished" ? (
          <>
            {/* 压纸滚筒 */}
            <div className="paper-enter h-3 rounded-t-full mx-2" style={{ background: "linear-gradient(#3a2f22,#1a140d)", boxShadow: "inset 0 2px 3px rgba(255,255,255,0.08)" }} />
            {/* 纸张 + 打字区 */}
            <div
              className="paper-enter relative overflow-hidden px-8 py-6"
              style={{
                animationDelay: "80ms",
                height: LINE_H * 3 + 36,
                background: C.paper,
                boxShadow: "0 10px 30px rgba(0,0,0,0.5), inset 0 0 60px rgba(120,90,40,0.12)",
                borderRadius: "2px",
              }}
            >
              <div
                style={{
                  position: "relative", transform: `translateY(${-offset}px)`, transition: "transform 0.15s ease",
                  whiteSpace: "pre-wrap", wordBreak: "normal", lineHeight: `${LINE_H}px`, fontSize: "1.55rem",
                  fontFamily: TW_FONT, letterSpacing: "0.5px",
                }}
              >
                {target.split("").map((ch, i) => {
                  const done = i < typed.length;
                  const wrong = done && typed[i] !== target[i];
                  const isCurrent = i === typed.length;
                  return (
                    <span
                      key={i}
                      ref={isCurrent ? caretRef : null}
                      style={{
                        color: wrong ? C.red : done ? C.ink : C.faded,
                        textDecoration: wrong ? "underline" : "none",
                        borderBottom: isCurrent ? `3px solid ${C.ink}` : "none",
                        animation: isCurrent ? "blink 1s step-end infinite" : "none",
                        textShadow: done && !wrong ? "0 0.5px 0 rgba(0,0,0,0.25)" : "none",
                      }}
                    >
                      {ch}
                    </span>
                  );
                })}
              </div>
              {status === "waiting" && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(243,232,207,0.65)" }}>
                  <span style={{ color: C.ink }} className="text-base tracking-wide">开始打字即计时 · 按 Tab 重开</span>
                </div>
              )}
            </div>

            {/* 进度条：time 用 timeLeft / total，words 用已打字符 / 总字符 */}
            <div className="mt-3 mx-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#3a2f22" }}>
              <div
                className="h-full transition-all duration-300 ease-linear"
                style={{
                  width: `${
                    testType === "words" || testType === "quotes" || testType === "custom"
                      ? (target.length ? Math.min(100, (typed.length / target.length) * 100) : 0)
                      : ((totalTime - timeLeft) / totalTime) * 100
                  }%`,
                  background: C.red,
                }}
              />
            </div>

            {/* 圆形机械键盘 */}
            {showKeyboard && (
              <div className="mt-8 flex flex-col items-center gap-2">
                {KEYBOARD.map((row, ri) => (
                  <div key={ri} className="flex gap-2" style={{ paddingLeft: ri * 20 }}>
                    {row.map((k) => {
                      const active = nextKey === k;
                      const isHome = k === "f" || k === "j";
                      return (
                        <div
                          key={k}
                          className="relative flex items-center justify-center uppercase transition-all duration-100"
                          style={{
                            width: 42, height: 42, borderRadius: "50%",
                            background: active ? `radial-gradient(circle at 35% 30%, ${C.red}, #6e1d12)` : `radial-gradient(circle at 35% 30%, ${C.ivory}, #d8c9a6)`,
                            border: `2px solid ${active ? "#4a120a" : C.ring}`,
                            color: active ? C.paper : C.ink,
                            fontSize: 14, fontWeight: 700,
                            boxShadow: active ? `0 0 14px ${C.red}, inset 0 1px 2px rgba(255,255,255,0.3)` : "0 2px 3px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.5)",
                            transform: active ? "translateY(2px)" : "none",
                          }}
                          title={`${k.toUpperCase()} 键`}
                        >
                          {k}
                          {isHome && <span className="absolute" style={{ bottom: 7, width: 8, height: 2, borderRadius: 2, background: active ? C.paper : C.ink }} />}
                          <span className="absolute" style={{ inset: -3, borderRadius: "50%", border: `2px solid ${FINGER[k]}`, opacity: active ? 0 : 0.55 }} />
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div
                  className="mt-2 flex items-center justify-center uppercase tracking-widest transition-all duration-100"
                  style={{
                    width: 320, height: 42, borderRadius: 22,
                    background: nextKey === "space" ? `radial-gradient(circle at 50% 30%, ${C.red}, #6e1d12)` : `linear-gradient(${C.ivory}, #d8c9a6)`,
                    border: `2px solid ${nextKey === "space" ? "#4a120a" : C.ring}`,
                    color: nextKey === "space" ? C.paper : "#8a785c",
                    fontSize: 11,
                    boxShadow: nextKey === "space" ? `0 0 14px ${C.red}` : "0 2px 3px rgba(0,0,0,0.4)",
                    transform: nextKey === "space" ? "translateY(2px)" : "none",
                  }}
                >
                  space
                </div>
              </div>
            )}

            {/* 控制栏 */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-sm" style={{ color: C.paper }}>
              <Btn onClick={() => restart()}>重开 (Tab)</Btn>
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: C.faded }}>
                <input type="checkbox" checked={showKeyboard} onChange={(e) => setShowKeyboard(e.target.checked)} /> 键盘
              </label>
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: C.faded }}>
                <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} /> 🔔 音效
              </label>
            </div>
          </>
        ) : (
          /* 成绩单 */
          <div className="results-enter px-8 py-8" style={{ background: C.paper, borderRadius: 2, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
            <div className="text-center tracking-widest mb-2 text-xs" style={{ color: "#8a785c" }}>
              {summaryLine(testType, timeOpt, wordOpt, punct, nums, source, ieltsIndex)}
            </div>
            <div className="text-center tracking-widest mb-6" style={{ color: C.ink, borderBottom: `2px dashed ${C.ring}`, paddingBottom: 12 }}>
              ── 打字报告 ──
            </div>
            <div className="flex items-end justify-center gap-12 mb-7" style={{ color: C.ink }}>
              <div className="text-center">
                <div className="text-6xl font-bold tabular-nums">{stats.wpm}</div>
                <div className="text-sm mt-1 tracking-widest" style={{ color: "#8a785c" }}>WPM</div>
              </div>
              <div className="text-center">
                <div className="text-6xl font-bold tabular-nums" style={{ color: C.red }}>{stats.acc}%</div>
                <div className="text-sm mt-1 tracking-widest" style={{ color: "#8a785c" }}>ACC</div>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-3 mb-6 text-center" style={{ color: C.ink }}>
              <Stat label="raw" value={stats.raw} />
              <Stat label="一致性" value={`${consistency}%`} />
              <Stat label="正确" value={stats.correct} />
              <Stat label="错误" value={stats.incorrect} red />
              <Stat label="用时" value={`${stats.elapsed}s`} />
            </div>
            <div className="h-40 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={wpmHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="t" stroke="#8a785c" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#8a785c" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: C.paper, border: `1px solid ${C.ring}`, borderRadius: 4, fontSize: 12 }} labelStyle={{ color: C.ink }} />
                  <Line type="monotone" dataKey="raw" stroke="#bcab86" strokeWidth={1.5} dot={false} name="raw" />
                  <Line type="monotone" dataKey="wpm" stroke={C.red} strokeWidth={2} dot={false} name="wpm" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <button onClick={() => restart()} className="w-full py-3 tracking-widest font-bold transition" style={{ background: C.ink, color: C.paper, borderRadius: 2 }}>
              再来一次 (Tab / Enter)
            </button>
          </div>
        )}
      </div>

      {/* 自定义文章弹窗 */}
      {showCustom && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowCustom(false)}>
          <div className="p-6 w-full max-w-xl" style={{ background: C.paper, borderRadius: 2, fontFamily: TW_FONT }} onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold mb-1 tracking-wide" style={{ color: C.ink }}>上传或粘贴练习文章</h2>
            <p className="text-sm mb-3" style={{ color: "#8a785c" }}>支持 .txt / .md 文件,或直接粘贴。超长截取前 {MAX_LEN} 字符,空格换行自动整理。</p>

            <label className="inline-flex items-center gap-2 px-4 py-2 mb-3 cursor-pointer text-sm" style={{ border: `2px dashed ${C.ring}`, color: C.ink, borderRadius: 2 }}>
              📄 选择文件
              <input type="file" accept=".txt,.md,text/plain" onChange={onFile} className="hidden" />
              {fileName && <span style={{ color: C.red }}>{fileName}</span>}
            </label>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={7}
              placeholder="Paste your English text here..."
              className="w-full p-3 text-sm focus:outline-none resize-none"
              style={{ background: "#fbf5e6", border: `1px solid ${C.ring}`, color: C.ink, borderRadius: 2, fontFamily: TW_FONT }}
            />
            <div className="flex justify-end gap-3 mt-4 text-sm">
              <Btn onClick={() => setShowCustom(false)} dark>取消</Btn>
              <button
                onClick={() => {
                  const c = clean(draft);
                  if (!c) return;
                  setShowCustom(false);
                  restart({ testType: "custom", source: c });
                }}
                className="px-4 py-2 font-bold"
                style={{ background: C.red, color: C.paper, borderRadius: 2 }}
              >
                用这段练习
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function summaryLine(
  testType: TestType, timeOpt: TimeOpt, wordOpt: WordOpt,
  punct: boolean, nums: boolean, source: string | null, ieltsIndex: number,
): string {
  const mods = [punct && "punctuation", nums && "numbers"].filter(Boolean).join(" / ");
  const suffix = mods ? ` · ${mods}` : "";
  if (testType === "time") return `time ${timeOpt}s${suffix}`;
  if (testType === "words") return `words ${wordOpt}${suffix}`;
  if (testType === "quotes") return "quotes";
  if (testType === "ielts") return `ielts · ${IELTS_ESSAYS[ieltsIndex].topic}`;
  return source ? `custom · ${source.length} chars` : "custom";
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-center" style={{ color: "#e8dcc0" }}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs tracking-widest" style={{ color: "#8a785c" }}>{label}</div>
    </div>
  );
}

function Stat({ label, value, red }: { label: string; value: number | string; red?: boolean }) {
  return (
    <div className="py-3" style={{ border: "1px solid #d8c9a6", borderRadius: 2 }}>
      <div className="text-2xl font-bold tabular-nums" style={{ color: red ? "#9c2b1b" : "#2c2417" }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: "#8a785c" }}>{label}</div>
    </div>
  );
}

function Btn({ children, onClick, dark }: { children: React.ReactNode; onClick: () => void; dark?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-sm transition"
      style={{ background: dark ? "#3a2f22" : "rgba(243,232,207,0.12)", color: "#f3e8cf", border: "1px solid rgba(243,232,207,0.25)", borderRadius: 2 }}
    >
      {children}
    </button>
  );
}

function Pill({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 transition tabular-nums"
      style={{
        background: active ? C.red : "transparent",
        color: active ? C.paper : C.faded,
        border: "none",
        borderRadius: 2,
        fontWeight: active ? 700 : 400,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span style={{ color: C.ring }}>|</span>;
}

function TypewriterLogo({ size = 220 }: { size?: number }) {
  return (
    <svg viewBox="0 0 220 160" width={size} height={size * 160 / 220} aria-label="Typewriter">
      {/* paper */}
      <rect x="65" y="8" width="90" height="58" rx="2" fill={C.paper} stroke={C.ring} strokeWidth="1.5" />
      <line x1="72" y1="20" x2="148" y2="20" stroke={C.ink} strokeWidth="1" />
      <line x1="72" y1="28" x2="135" y2="28" stroke={C.ink} strokeWidth="1" />
      <line x1="72" y1="36" x2="142" y2="36" stroke={C.ink} strokeWidth="1" />
      <line x1="72" y1="44" x2="120" y2="44" stroke={C.ink} strokeWidth="1" />
      <line x1="72" y1="52" x2="115" y2="52" stroke={C.faded} strokeWidth="1" />
      {/* platen */}
      <rect x="30" y="60" width="160" height="14" rx="7" fill="#3a2f22" />
      <circle cx="30" cy="67" r="4" fill="#1a140d" stroke={C.ring} strokeWidth="0.8" />
      <circle cx="190" cy="67" r="4" fill="#1a140d" stroke={C.ring} strokeWidth="0.8" />
      {/* body */}
      <path d="M22 74 L198 74 L192 144 L28 144 Z" fill="#1a140d" stroke={C.ring} strokeWidth="1.5" />
      {/* keys */}
      <g fill={C.ivory} stroke={C.ring} strokeWidth="0.6">
        {Array.from({ length: 11 }).map((_, i) => (
          <circle key={`r1-${i}`} cx={48 + i * 12} cy={92} r="4.5" />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <circle key={`r2-${i}`} cx={54 + i * 12} cy={106} r="4.5" />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <circle key={`r3-${i}`} cx={60 + i * 12} cy={120} r="4.5" />
        ))}
      </g>
      {/* space bar */}
      <rect x="78" y="130" width="64" height="6" rx="3" fill={C.ivory} stroke={C.ring} strokeWidth="0.6" />
      {/* return lever */}
      <line x1="190" y1="60" x2="206" y2="50" stroke={C.ring} strokeWidth="2" strokeLinecap="round" />
      <circle cx="207" cy="49" r="3" fill={C.red} />
      {/* accent type bar */}
      <line x1="110" y1="60" x2="110" y2="48" stroke={C.red} strokeWidth="1.5" />
    </svg>
  );
}

interface HomeProps {
  onPick: (tt: TestType, ieltsIndex?: number) => void;
}

function Home({ onPick }: HomeProps) {
  const TW_FONT = '"Courier New", Courier, monospace';
  return (
    <div
      className="min-h-screen flex flex-col px-6 py-6"
      style={{
        background: C.desk,
        fontFamily: TW_FONT,
        backgroundImage: "radial-gradient(rgba(243,232,207,0.045) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      {/* top ribbon */}
      <div className="text-center text-[10px] md:text-xs tracking-[0.5em] mb-8 select-none" style={{ color: C.ring }}>
        ░░░░░  EST · 1950  ·  KEY · BY · KEY  ·  PAGE · BY · PAGE  ░░░░░
      </div>

      <div className="max-w-6xl mx-auto w-full flex flex-col gap-12 flex-1">
        {/* ── HERO ── */}
        <section className="section-stagger grid grid-cols-1 md:grid-cols-12 gap-8 items-center" style={{ animationDelay: "60ms" }}>
          <div className="md:col-span-5 flex justify-center md:justify-end">
            <TypewriterLogo size={300} />
          </div>
          <div className="md:col-span-7">
            <h1 className="text-5xl md:text-7xl tracking-[0.2em] mb-3 leading-none" style={{ color: C.paper }}>
              THE<br />TYPEWRITER
            </h1>
            <div className="text-xs md:text-sm tracking-[0.4em] mb-5" style={{ color: C.red }}>
              ░ MECHANICAL TYPING PRACTICE ░
            </div>
            <p className="text-sm md:text-base leading-relaxed mb-6 max-w-xl" style={{ color: C.faded }}>
              复古铸铁打字机风格的英文打字训练。<br />
              支持限时测试、随机词、名言、自定义文本，以及 <span style={{ color: C.paper }}>4 篇雅思 Task 2 八分范文</span> 练习。
            </p>
            <div className="flex flex-wrap gap-3 mb-4">
              <CtaBtn onClick={() => onPick("time")} primary>⏱ 开始 30 秒限时</CtaBtn>
              <CtaBtn onClick={() => onPick("ielts", 0)}>🎓 雅思 Task 2 练习</CtaBtn>
            </div>
            <div className="text-[11px] tracking-widest" style={{ color: "#8a785c" }}>
              TAB 重开  ·  ENTER 再来一次  ·  任意键开始计时
            </div>
          </div>
        </section>

        {/* ── MODES ── */}
        <section className="section-stagger" style={{ animationDelay: "180ms" }}>
          <SectionTitle eyebrow="01 · MODES" title="CHOOSE YOUR TEST" sub="按时间 / 词数 / 名言 / 雅思范文 / 自定义文本" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <ModeCard icon="⏱" label="Time" detail="15 · 30 · 60 · 120 秒" hint="按时间限时打字" onClick={() => onPick("time")} />
            <ModeCard icon="A" label="Words" detail="10 · 25 · 50 · 100 词" hint="固定词数练习" onClick={() => onPick("words")} />
            <ModeCard icon={"\u201C"} label="Quotes" detail="随机三段拼接" hint="科技 / 哲学名言" onClick={() => onPick("quotes")} />
            <ModeCard icon="🎓" label="IELTS" detail="Task 2 · 4 篇" hint="8 分参考范文" onClick={() => onPick("ielts", 0)} accent />
            <ModeCard icon="✎" label="Custom" detail=".txt · .md · 粘贴" hint="练习你自己的稿子" onClick={() => onPick("custom")} />
          </div>
        </section>

        {/* ── IELTS LIBRARY ── */}
        <section className="section-stagger" style={{ animationDelay: "300ms" }}>
          <SectionTitle eyebrow="02 · IELTS LIBRARY" title="WRITING TASK 2 · BAND 8" sub="点击任意题目直接进入练习" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {IELTS_ESSAYS.map((essay, i) => {
              const chars = essay.essay.length;
              const seconds = calcTime(essay.essay);
              return (
                <button
                  key={essay.id}
                  onClick={() => onPick("ielts", i)}
                  className="text-left p-5 transition cursor-pointer flex flex-col gap-3 group"
                  style={{
                    background: "rgba(243,232,207,0.06)",
                    border: "1px solid rgba(243,232,207,0.22)",
                    borderRadius: 2,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs tracking-widest">
                      <span style={{ background: C.red, color: C.paper, padding: "2px 8px" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{ color: C.red }}>{essay.topic.toUpperCase()}</span>
                    </div>
                    <span className="text-[10px] tracking-widest" style={{ color: "#8a785c" }}>TASK 2 · BAND 8</span>
                  </div>
                  <div className="text-sm leading-relaxed" style={{ color: C.paper }}>
                    {essay.question}
                  </div>
                  <div className="flex gap-5 mt-1 text-[11px] tracking-wide" style={{ color: C.faded }}>
                    <span>📝 {chars.toLocaleString()} chars</span>
                    <span>⏱ ~{Math.ceil(seconds / 60)} min</span>
                    <span>📊 ~{essay.essay.split(" ").length} words</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="section-stagger" style={{ animationDelay: "420ms" }}>
          <SectionTitle eyebrow="03 · WHAT'S INSIDE" title="DESIGNED FOR DELIBERATE PRACTICE" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FeatureCard icon="📈" title="实时指标" body="WPM · Raw · ACC 一致性曲线" />
            <FeatureCard icon="⌨" title="圆形键盘" body="八指着色 · 下一键高亮 · F/J 定位条" />
            <FeatureCard icon="🔔" title="机械音效" body="白噪声敲击 · 换行回车铃 · 可关闭" />
            <FeatureCard icon="📝" title="多种文本" body="随机词 · 名言 · 雅思范文 · 自定义" />
          </div>
        </section>
      </div>

      {/* bottom ribbon */}
      <div className="text-center mt-12 mb-2 text-[10px] md:text-xs tracking-[0.5em] select-none" style={{ color: "#5a4a36" }}>
        ░░░░░  TYPE WITH INTENTION  ·  PRESS ANY MODE ABOVE TO BEGIN  ░░░░░
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between flex-wrap gap-2 border-b pb-3" style={{ borderColor: "rgba(243,232,207,0.18)" }}>
      <div>
        <div className="text-[10px] tracking-[0.4em] mb-1" style={{ color: C.red }}>{eyebrow}</div>
        <h2 className="text-xl md:text-2xl tracking-[0.25em]" style={{ color: C.paper }}>{title}</h2>
      </div>
      {sub && <div className="text-xs tracking-wide" style={{ color: C.faded }}>{sub}</div>}
    </div>
  );
}

function CtaBtn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-3 text-sm tracking-widest font-bold cursor-pointer transition"
      style={{
        background: primary ? C.red : "transparent",
        color: C.paper,
        border: `2px solid ${primary ? C.red : "rgba(243,232,207,0.5)"}`,
        borderRadius: 2,
      }}
    >
      {children}
    </button>
  );
}

function ModeCard({
  icon, label, detail, hint, onClick, accent,
}: {
  icon: string; label: string; detail: string; hint: string; onClick: () => void; accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start px-4 py-5 transition cursor-pointer text-left"
      style={{
        background: accent ? "rgba(156,43,27,0.18)" : "rgba(243,232,207,0.06)",
        border: `1px solid ${accent ? C.red : "rgba(243,232,207,0.22)"}`,
        borderRadius: 2,
        color: C.paper,
      }}
    >
      <div className="text-3xl mb-2" style={{ color: accent ? C.red : C.paper }}>{icon}</div>
      <div className="text-base tracking-[0.2em] font-bold mb-1">{label}</div>
      <div className="text-[11px] tracking-wide mb-2" style={{ color: C.faded }}>{hint}</div>
      <div className="text-[10px] tracking-widest" style={{ color: "#8a785c" }}>{detail}</div>
    </button>
  );
}

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div
      className="px-4 py-4"
      style={{ background: "rgba(243,232,207,0.04)", border: "1px solid rgba(243,232,207,0.15)", borderRadius: 2 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-sm tracking-widest font-bold" style={{ color: C.paper }}>{title}</span>
      </div>
      <div className="text-xs leading-relaxed" style={{ color: C.faded }}>{body}</div>
    </div>
  );
}
