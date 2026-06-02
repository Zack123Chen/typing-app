import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import * as Tone from "tone";

const WORDS = "the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were good great small large long short high low old young right left big".split(" ");

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
const CPM = 200; // 假设平均打字速度 200 字符/分钟

/** 根据文本长度计算限时（秒），下限 30s，上限 300s */
function calcTime(text: string): number {
  return Math.max(30, Math.min(300, Math.ceil(text.length / CPM * 60)));
}

function genText() {
  const out: string[] = [];
  for (let i = 0; i < 130; i++) out.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  return out.join(" ");
}
const clean = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);

export default function TypingApp() {
  const [source, setSource] = useState<string | null>(null);
  const [target, setTarget] = useState(genText);
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState("waiting");
  const [totalTime, setTotalTime] = useState(() => calcTime(genText()));
  const [timeLeft, setTimeLeft] = useState(() => calcTime(genText()));
  const [wpmHistory, setWpmHistory] = useState<{ t: number; wpm: number }[]>([]);
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
  typedRef.current = typed;
  targetRef.current = target;
  totalTimeRef.current = totalTime;
  soundOnRef.current = soundOn;

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
    } catch (e) {}
  }, []);
  const click = useCallback((wrong: boolean) => {
    if (!soundOnRef.current) return;
    const a = audioRef.current;
    try {
      a.noise && a.noise.triggerAttackRelease("32n");
      a.thock && a.thock.triggerAttackRelease(wrong ? "G1" : "C2", "32n");
    } catch (e) {}
  }, []);
  const ding = useCallback(() => {
    if (!soundOnRef.current) return;
    const a = audioRef.current;
    try { a.bell && a.bell.triggerAttackRelease("C6", "16n"); } catch (e) {}
  }, []);

  const restart = useCallback((src?: string | null) => {
    const s = src !== undefined ? src : source;
    const newTarget = s ? s : genText();
    const t = calcTime(newTarget);
    setTarget(newTarget);
    setTotalTime(t);
    setTyped(""); setTimeLeft(t); setWpmHistory([]);
    setOffset(0); prevOffsetRef.current = 0; setStatus("waiting");
  }, [source]);

  // 键盘输入
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showCustom) return;
      if (e.key === "Tab" || (e.key === "Enter" && status === "finished")) { e.preventDefault(); restart(); return; }
      if (status === "finished") return;
      if (e.key === "Backspace") { e.preventDefault(); setTyped((t) => t.slice(0, -1)); return; }
      if (e.key.length === 1) {
        e.preventDefault();
        initAudio();
        if (status === "waiting") setStatus("running");
        setTyped((t) => {
          if (t.length >= targetRef.current.length) return t;
          click(e.key !== targetRef.current[t.length]);
          return t + e.key;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, restart, showCustom, initAudio, click]);

  // 计时器
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
        setWpmHistory((h) => [...h, { t: elapsed, wpm }]);
        if (next <= 0) { clearInterval(id); ding(); setStatus("finished"); return 0; }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [status, ding]);

  useEffect(() => {
    if (status === "running" && typed.length >= target.length) { ding(); setStatus("finished"); }
  }, [typed, target, status, ding]);

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
    for (let i = 0; i < typed.length; i++) { if (typed[i] === target[i]) correct++; else incorrect++; }
    const acc = typed.length ? Math.round((correct / typed.length) * 100) : 100;
    const elapsed = status === "waiting" ? 0 : totalTime - timeLeft;
    const wpm = elapsed > 0 ? Math.round((correct / 5) / (elapsed / 60)) : 0;
    return { correct, incorrect, acc, wpm };
  }, [typed, target, timeLeft, totalTime, status]);

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

  const TW_FONT = '"Courier New", Courier, monospace';

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8" style={{ background: C.desk, fontFamily: TW_FONT }}>
      <style>{`@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
      <div className="w-full max-w-3xl">
        {/* 顶栏 */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl tracking-widest" style={{ color: C.paper }}>
            ░ THE TYPEWRITER ░
          </h1>
          <div className="flex items-center gap-6 text-sm">
            <Metric value={timeLeft} label="SEC" />
            <Metric value={stats.wpm} label="WPM" />
            <Metric value={`${stats.acc}%`} label="ACC" />
          </div>
        </div>

        {status !== "finished" ? (
          <>
            {/* 压纸滚筒 */}
            <div className="h-3 rounded-t-full mx-2" style={{ background: "linear-gradient(#3a2f22,#1a140d)", boxShadow: "inset 0 2px 3px rgba(255,255,255,0.08)" }} />
            {/* 纸张 + 打字区 */}
            <div
              className="relative overflow-hidden px-8 py-6"
              style={{
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

            {/* 进纸条 */}
            <div className="mt-3 mx-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#3a2f22" }}>
              <div className="h-full transition-all duration-1000 ease-linear" style={{ width: `${((totalTime - timeLeft) / totalTime) * 100}%`, background: C.red }} />
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
              <Btn onClick={() => { setDraft(source || ""); setFileName(""); setShowCustom(true); }}>✎ 上传 / 粘贴文章</Btn>
              {source && <Btn onClick={() => { setSource(null); restart(null); }}>↺ 随机单词</Btn>}
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: C.faded }}>
                <input type="checkbox" checked={showKeyboard} onChange={(e) => setShowKeyboard(e.target.checked)} /> 键盘
              </label>
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: C.faded }}>
                <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} /> 🔔 音效
              </label>
            </div>
          </>
        ) : (
          /* 成绩单(打字机收据风) */
          <div className="px-8 py-8" style={{ background: C.paper, borderRadius: 2, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
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
                <div className="text-sm mt-1 tracking-widest" style={{ color: "#8a785c" }}>准确率</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6 text-center" style={{ color: C.ink }}>
              <Stat label="正确" value={stats.correct} />
              <Stat label="错误" value={stats.incorrect} red />
              <Stat label="总字符" value={typed.length} />
            </div>
            <div className="h-36 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={wpmHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="t" stroke="#8a785c" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#8a785c" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: C.paper, border: `1px solid ${C.ring}`, borderRadius: 4, fontSize: 12 }} labelStyle={{ color: C.ink }} />
                  <Line type="monotone" dataKey="wpm" stroke={C.red} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <button onClick={() => restart()} className="w-full py-3 tracking-widest font-bold transition" style={{ background: C.ink, color: C.paper, borderRadius: 2 }}>
              再来一次 (Tab)
            </button>
          </div>
        )}
      </div>

      {/* 上传 / 粘贴弹窗 */}
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
                onClick={() => { const c = clean(draft); if (!c) return; setSource(c); restart(c); setShowCustom(false); }}
                className="px-4 py-2 font-bold" style={{ background: C.red, color: C.paper, borderRadius: 2 }}
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

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-center" style={{ color: "#e8dcc0" }}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs tracking-widest" style={{ color: "#8a785c" }}>{label}</div>
    </div>
  );
}
function Stat({ label, value, red }: { label: string; value: number; red?: boolean }) {
  return (
    <div className="py-3" style={{ border: "1px solid #d8c9a6", borderRadius: 2 }}>
      <div className="text-2xl font-bold tabular-nums" style={{ color: red ? "#9c2b1b" : "#2c2417" }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: "#8a785c" }}>{label}</div>
    </div>
  );
}
function Btn({ children, onClick, dark }: { children: React.ReactNode; onClick: () => void; dark?: boolean }) {
  return (
    <button onClick={onClick} className="px-4 py-2 text-sm transition" style={{ background: dark ? "#3a2f22" : "rgba(243,232,207,0.12)", color: "#f3e8cf", border: "1px solid rgba(243,232,207,0.25)", borderRadius: 2 }}>
      {children}
    </button>
  );
}
