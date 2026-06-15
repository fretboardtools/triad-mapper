import { useState } from "react";

/* ─── Music theory ─────────────────────────────────────────────────────────── */
const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLAT  = {"C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb"};
const noteLabel = n => FLAT[n] ? `${n}/${FLAT[n]}` : n;

const OPEN_MIDI    = [40,45,50,55,59,64];          // low E → high e, standard tuning
const STRING_NAMES = ["E","A","D","G","B","e"];

const ROOTS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

const QUALITIES = [
  { id:"maj", label:"Major",      sym:"",  intervals:[0,4,7], blurb:"Bright and settled — root, major third, perfect fifth." },
  { id:"min", label:"Minor",      sym:"m", intervals:[0,3,7], blurb:"Darker — the third is lowered a semitone to a flat third." },
  { id:"dim", label:"Diminished", sym:"°", intervals:[0,3,6], blurb:"Tense and unstable — both the third and the fifth are flattened." },
  { id:"aug", label:"Augmented",  sym:"+", intervals:[0,4,8], blurb:"Restless and symmetrical — the fifth is raised a semitone." },
];

const STRING_SETS = [
  { id:"EAD", label:"E–A–D", strings:[0,1,2] },
  { id:"ADG", label:"A–D–G", strings:[1,2,3] },
  { id:"DGB", label:"D–G–B", strings:[2,3,4] },
  { id:"GBe", label:"G–B–e", strings:[3,4,5] },
];

const VOICE = {
  R: { label:"R", name:"Root",  color:"#6366f1" },
  T: { label:"3", name:"Third", color:"#e8a33d" },
  F: { label:"5", name:"Fifth", color:"#2e8b8b" },
};
const INV_LABEL = { R:"Root position", T:"1st inversion", F:"2nd inversion" };
const INV_ORDER = { R:["R","T","F"], T:["T","F","R"], F:["F","R","T"] }; // low → high

/* ─── Shape computation ────────────────────────────────────────────────────── */
// Ascending voice offsets (semitones above the root pitch) for each inversion.
function voicingOffsets(inv, i1, i2) {
  if (inv === "R") return [{ voice:"R", off:0 },  { voice:"T", off:i1 }, { voice:"F", off:i2 }];
  if (inv === "T") return [{ voice:"T", off:i1 }, { voice:"F", off:i2 }, { voice:"R", off:12 }];
  return                  [{ voice:"F", off:i2 }, { voice:"R", off:12 }, { voice:"T", off:12 + i1 }];
}

// Place one closed triad inversion at its lowest fretted position (all frets 1..16, no open strings).
function placeTriad(strings, inv, rootPC, intervals) {
  const vo = voicingOffsets(inv, intervals[1], intervals[2]);
  const Pbase = 36 + rootPC; // a root pitch carrying the right pitch class (C2-based)
  for (let oct = 0; oct <= 5; oct++) {
    const P = Pbase + 12 * oct;
    const frets = vo.map((x, k) => P + x.off - OPEN_MIDI[strings[k]]);
    if (frets.every(f => f >= 1 && f <= 16)) {
      return vo.map((x, k) => ({
        string: strings[k], fret: frets[k], midi: P + x.off,
        voice: x.voice, note: NOTES[(P + x.off) % 12],
      }));
    }
  }
  return null;
}

function computeShapes(setStrings, rootPC, intervals) {
  return ["R", "T", "F"]
    .map(inv => ({ inversion: inv, dots: placeTriad(setStrings, inv, rootPC, intervals) }))
    .filter(s => s.dots)
    .sort((a, b) => Math.min(...a.dots.map(d => d.fret)) - Math.min(...b.dots.map(d => d.fret)));
}

/* ─── Theme ────────────────────────────────────────────────────────────────── */
const THEMES = {
  light: {
    bg:"#f3f5f8", surface:"#ffffff", surface2:"#eef1f5",
    border:"#dde1eb", borderHi:"#c5ccd8",
    text:"#1a2030", textHi:"#0a0c12", textMid:"#2d3748", textLo:"#4a5568", textMute:"#6b7280",
    fretStr:"#c0c8d8", fretBar:"#d0d8e8", fretMark:"#c8d0e0", fretNum:"#8899aa", nut:"#5a6880",
  },
  dark: {
    bg:"#0e1118", surface:"#161b26", surface2:"#1c2230",
    border:"#1f2735", borderHi:"#2a3447",
    text:"#dde3ed", textHi:"#f0f4ff", textMid:"#b0bcc8", textLo:"#7c8aa0", textMute:"#5a6880",
    fretStr:"#28324a", fretBar:"#222b3d", fretMark:"#222b3d", fretNum:"#52627e", nut:"#7a8fa8",
  },
};

/* ─── Component ────────────────────────────────────────────────────────────── */
export default function TriadMapper() {
  const [root, setRoot]         = useState("C");
  const [qualityId, setQuality] = useState("maj");
  const [setId, setSetId]       = useState("DGB");
  const [filter, setFilter]     = useState("all"); // all | R | T | F
  const [isDark, setIsDark]     = useState(false);

  const T = isDark ? THEMES.dark : THEMES.light;
  const quality   = QUALITIES.find(q => q.id === qualityId);
  const stringSet = STRING_SETS.find(s => s.id === setId);
  const rootPC    = NOTES.indexOf(root);
  const shapes    = computeShapes(stringSet.strings, rootPC, quality.intervals);
  const allDots   = shapes.flatMap(s => s.dots.map(d => ({ ...d, inversion: s.inversion })));

  const maxF = Math.max(...allDots.map(d => d.fret));
  const startF = 1;
  const endF = Math.max(12, maxF);
  const frets = [];
  for (let f = startF; f <= endF; f++) frets.push(f);

  const chordName = `${root}${quality.sym}`;
  const CELL = 40, ROWH = 34, NAMEW = 26;

  const dotAt = (di, f) => allDots.find(d => d.string === di && d.fret === f);
  const isGhost = inv => filter !== "all" && filter !== inv;

  const selectedShape = filter !== "all" ? shapes.find(s => s.inversion === filter) : null;
  const bottomNote = selectedShape ? selectedShape.dots[0].note : null;

  const btn = (active) => ({
    padding:"7px 13px", borderRadius:"8px", fontSize:"12.5px", fontWeight:600, cursor:"pointer",
    border:`1.5px solid ${active ? T.borderHi : T.border}`,
    background: active ? T.surface2 : T.surface, color: active ? T.textHi : T.textMute,
    transition:"all .12s", fontFamily:"inherit",
  });

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'DM Sans',system-ui,sans-serif", padding:"20px 16px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing:border-box; }
      `}</style>

      <div style={{ maxWidth:760, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"18px" }}>
          <div>
            <h1 style={{ margin:0, fontSize:"24px", fontWeight:700, color:T.textHi, letterSpacing:"-0.5px" }}>Triad Mapper</h1>
            <p style={{ margin:"3px 0 0", fontSize:"13px", color:T.textMute }}>One little three-note shape — three inversions — the whole neck.</p>
          </div>
          <button onClick={() => setIsDark(!isDark)} style={{ ...btn(false), padding:"7px 11px" }} title={isDark ? "Light mode" : "Dark mode"}>
            {isDark ? "☀" : "☾"}
          </button>
        </div>

        {/* Controls */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:"14px", padding:"16px", marginBottom:"12px" }}>
          <Label T={T}>ROOT</Label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"4px", marginBottom:"14px" }}>
            {ROOTS.map(r => (
              <button key={r} onClick={() => setRoot(r)} style={{ ...btn(root===r), minWidth:"38px", padding:"7px 8px", fontFamily:"'JetBrains Mono',monospace" }}>{r}</button>
            ))}
          </div>

          <Label T={T}>QUALITY</Label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"14px" }}>
            {QUALITIES.map(q => (
              <button key={q.id} onClick={() => setQuality(q.id)} style={btn(qualityId===q.id)}>{q.label}</button>
            ))}
          </div>

          <Label T={T}>STRING SET</Label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
            {STRING_SETS.map(s => (
              <button key={s.id} onClick={() => setSetId(s.id)} style={{ ...btn(setId===s.id), fontFamily:"'JetBrains Mono',monospace" }}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Inversion stepper */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"12px" }}>
          {["R","T","F"].map(inv => (
            <button key={inv} onClick={() => setFilter(inv)} style={btn(filter===inv)}>
              <span style={{ display:"inline-block", width:"9px", height:"9px", borderRadius:"50%", background:VOICE[inv==="R"?"R":inv==="T"?"T":"F"].color, marginRight:"7px", verticalAlign:"middle", opacity:0.9 }}/>
              {INV_LABEL[inv]}
            </button>
          ))}
          <button onClick={() => setFilter("all")} style={btn(filter==="all")}>All — the leapfrog</button>
        </div>

        {/* Fretboard */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:"14px", padding:"18px 14px 12px", marginBottom:"12px", overflowX:"auto" }}>
          <div style={{ display:"inline-block", minWidth:"100%" }}>
            {[5,4,3,2,1,0].map(di => {
              const inSet = stringSet.strings.includes(di);
              return (
                <div key={di} style={{ display:"flex", alignItems:"center", height:`${ROWH}px`, opacity: inSet ? 1 : 0.28 }}>
                  <div style={{ width:`${NAMEW}px`, textAlign:"right", paddingRight:"7px", fontSize:"10px", color:T.fretNum, fontFamily:"'JetBrains Mono',monospace", flexShrink:0 }}>{STRING_NAMES[di]}</div>
                  {frets.map(f => {
                    const d = inSet ? dotAt(di, f) : null;
                    return (
                      <div key={f} style={{ width:`${CELL}px`, height:`${ROWH}px`, position:"relative", flexShrink:0 }}>
                        {/* string line */}
                        <div style={{ position:"absolute", top:"50%", left:0, right:0, height: di<=1?"2px":di<=3?"1.5px":"1px", background:T.fretStr, transform:"translateY(-50%)" }}/>
                        {/* fret wire (right edge) / nut */}
                        <div style={{ position:"absolute", top:0, bottom:0, right:0, width: f===startF && startF===0 ? "0" : "1.5px", background:T.fretBar }}/>
                        {f===startF && startF===0 && <div style={{ position:"absolute", top:0, bottom:0, left:0, width:"3px", background:T.nut }}/>}
                        {/* dot */}
                        {d && (
                          <div style={{
                            position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
                            width:"26px", height:"26px", borderRadius:"50%", zIndex:2,
                            background:VOICE[d.voice].color, opacity:isGhost(d.inversion)?0.16:1,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            color:"#fff", fontSize:"11px", fontWeight:700, fontFamily:"'JetBrains Mono',monospace",
                            boxShadow:isGhost(d.inversion)?"none":"0 1px 3px rgba(0,0,0,.25)",
                            transition:"opacity .12s",
                          }}>{VOICE[d.voice].label}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {/* fret numbers + inlays */}
            <div style={{ display:"flex", marginTop:"4px" }}>
              <div style={{ width:`${NAMEW}px`, flexShrink:0 }}/>
              {frets.map(f => (
                <div key={f} style={{ width:`${CELL}px`, textAlign:"center", flexShrink:0 }}>
                  <div style={{ height:"7px" }}>
                    {[3,5,7,9,15,17,21].includes(f) && <div style={{ width:"6px",height:"6px",borderRadius:"50%",background:T.fretMark,margin:"0 auto" }}/>}
                    {[12,24].includes(f) && <div style={{ display:"flex", gap:"3px", justifyContent:"center" }}><span style={{ width:"6px",height:"6px",borderRadius:"50%",background:T.fretMark }}/><span style={{ width:"6px",height:"6px",borderRadius:"50%",background:T.fretMark }}/></div>}
                  </div>
                  <div style={{ fontSize:"9.5px", color:T.fretNum, fontFamily:"'JetBrains Mono',monospace", marginTop:"2px" }}>{f}</div>
                </div>
              ))}
            </div>
          </div>

          {/* legend */}
          <div style={{ display:"flex", gap:"16px", justifyContent:"center", marginTop:"14px", flexWrap:"wrap" }}>
            {["R","T","F"].map(v => (
              <div key={v} style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"11.5px", color:T.textLo }}>
                <span style={{ width:"13px", height:"13px", borderRadius:"50%", background:VOICE[v].color }}/>
                {VOICE[v].name} <span style={{ fontFamily:"'JetBrains Mono',monospace", color:T.textMute }}>({VOICE[v].label})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Teaching panel */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:"14px", padding:"18px", animation:"fadeUp .15s ease" }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:"10px", flexWrap:"wrap", marginBottom:"8px" }}>
            <span style={{ fontSize:"26px", fontWeight:700, color:T.textHi, fontFamily:"'JetBrains Mono',monospace" }}>{chordName}</span>
            <span style={{ fontSize:"14px", color:T.textMute }}>{quality.label} triad · {stringSet.label} strings</span>
          </div>
          <p style={{ margin:"0 0 12px", fontSize:"14px", lineHeight:1.6, color:T.textMid }}>{quality.blurb}</p>

          <div style={{ background:T.surface2, borderRadius:"10px", padding:"13px 15px", fontSize:"13.5px", lineHeight:1.65, color:T.textMid }}>
            {filter === "all" ? (
              <span><strong style={{ color:T.textHi }}>All three inversions.</strong> Same three notes every time — only which one sits on the bottom changes. Watch them leapfrog up the neck: that's one small shape covering the whole fretboard, not three chords to memorise.</span>
            ) : (
              <span><strong style={{ color:T.textHi }}>{INV_LABEL[filter]}.</strong> The <strong>{VOICE[filter==="R"?"R":filter==="T"?"T":"F"].name.toLowerCase()}</strong> ({noteLabel(bottomNote)}) is on the bottom. Stack the other two notes above it and you have {chordName} — restacked, but the same three notes.</span>
            )}
          </div>

          <p style={{ margin:"14px 0 0", fontSize:"12.5px", lineHeight:1.6, color:T.textMute }}>
            A triad is just three notes — root, third, fifth. An inversion isn't a new chord; it's the same three notes with a different one on the bottom. Learn the three shapes on one string set and you can play that chord anywhere — and target any chord tone in a solo.
          </p>
        </div>

      </div>
    </div>
  );
}

function Label({ children, T }) {
  return <div style={{ fontSize:"10px", fontWeight:700, letterSpacing:"1.2px", color:T.textMute, marginBottom:"7px", fontFamily:"'JetBrains Mono',monospace" }}>{children}</div>;
}
