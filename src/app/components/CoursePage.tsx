import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ChevronLeft, Bell, X, Send, FileText, BarChart2, BellRing,
  Zap, BookOpenCheck, Plus, Sparkles, BookOpen,
  CalendarClock, ClipboardList, HelpCircle, Maximize2, Minimize2,
  ChevronDown, ChevronUp, Paperclip, AlertCircle, CheckCircle2,
  FileUp, Trash2, Link, User, Brain, Timer, Play, Pause,
  RotateCcw, Edit2, Check, Award, StickyNote,
} from "lucide-react";
import { SparkLogo } from "./SparkLogo";
import learnBeamLogo from "../../assets/861bd4bcf410ca26cefb8d6a2c416c8933fab508.png";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { loadCourses, type Course } from "./Dashboard";

const F = {
  heading: "'Nunito', 'Trebuchet MS', system-ui, sans-serif",
  body:    "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif",
  mono:    "'DM Mono', 'Fira Code', monospace",
};

/* ─────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────── */
type TabId = "overview"|"assignments"|"grades"|"docs"|"reminders"|"activities";

type Doc = {
  id: string; name: string;
  type: "syllabus"|"notes"|"reading"|"past-exam"|"other";
  size: string; uploadedAt: string; used: boolean;
};

type Citation = { docName: string; excerpt: string };

type ChatMsg = {
  role: "user"|"ai"|"system";
  text: string;
  citations?: Citation[];
  flagged?: boolean; flagNote?: string;
};

type Assignment = {
  id: string; label: string; type: string;
  due: string; weight: number; grade: number|null;
  status: "upcoming"|"completed"|"overdue";
};


/* ─────────────────────────────────────────────────────
   GRADE CALCULATION
───────────────────────────────────────────────────── */
function computeGrade(assignments: Assignment[]): { display: string; pct: number | null } {
  const graded = assignments.filter(a => a.grade !== null);
  if (graded.length === 0) return { display:"—", pct:null };
  const totalW = graded.reduce((s,a) => s + (a.weight||1), 0);
  const pct    = graded.reduce((s,a) => s + a.grade! * (a.weight||1), 0) / totalW;
  const letter = pct>=93?"A":pct>=90?"A-":pct>=87?"B+":pct>=83?"B":pct>=80?"B-":pct>=77?"C+":pct>=73?"C":pct>=70?"C-":pct>=67?"D+":pct>=60?"D":"F";
  return { display:`${pct.toFixed(0)}%  ${letter}`, pct };
}

/* ─────────────────────────────────────────────────────
   TABS
───────────────────────────────────────────────────── */
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id:"overview",    label:"Overview",    icon:<Sparkles      size={13}/> },
  { id:"assignments", label:"Assignments", icon:<ClipboardList size={13}/> },
  { id:"grades",      label:"Grades",      icon:<BarChart2     size={13}/> },
  { id:"docs",        label:"Documents",   icon:<FileText      size={13}/> },
  { id:"reminders",   label:"Reminders",   icon:<BellRing      size={13}/> },
  { id:"activities",  label:"Activities",  icon:<Brain         size={13}/> },
];

const card: React.CSSProperties = {
  background:"var(--bg-surface)", border:"1px solid var(--border)",
  borderRadius:"13px", overflow:"hidden",
};
const sHead: React.CSSProperties = {
  display:"flex", alignItems:"center", justifyContent:"space-between",
  padding:"11px 18px", background:"var(--section-bg)", borderBottom:"1px solid var(--border)",
};

/* ─────────────────────────────────────────────────────
   HELP PANEL
───────────────────────────────────────────────────── */
const TAB_TIPS: Record<TabId, string> = {
  overview:    "Your course at a glance — stats, grade and Spark suggestions from your documents.",
  assignments: "Track everything with a score. Grades you enter here automatically update your course average.",
  grades:      "Your grade history. Every logged grade feeds the running average shown in Overview.",
  docs:        "Everything Spark knows about this course. Files uploaded here or via Spark chat appear in this list.",
  reminders:   "Deadlines specific to this course. Add custom ones anytime.",
  activities:  "AI-powered study activities built from your uploaded documents — none of these affect your grade.",
};

function HelpPanel({ tab, onClose }: { tab: TabId; onClose: () => void }) {
  return (
    <div style={{ position:"fixed", bottom:"80px", right:"22px", zIndex:110, width:"280px", background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"14px", boxShadow:"0 20px 55px rgba(0,0,0,0.14)", overflow:"hidden", animation:"panelIn 0.2s ease" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 15px", borderBottom:"1px solid var(--border)", background:"var(--section-bg)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ width:"24px", height:"24px", borderRadius:"7px", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <HelpCircle size={13} style={{ color:"var(--primary-foreground)" }}/>
          </div>
          <span style={{ fontFamily:F.heading, fontSize:"0.85rem", fontWeight:800, color:"var(--text-primary)" }}>{TABS.find(t=>t.id===tab)?.label}</span>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", padding:0, display:"flex" }}><X size={13}/></button>
      </div>
      <div style={{ padding:"15px 16px" }}>
        <p style={{ fontFamily:F.body, fontSize:"0.82rem", color:"var(--text-secondary)", margin:0, lineHeight:1.68 }}>{TAB_TIPS[tab]}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   COURSE REMINDERS PANEL (bell dropdown)
───────────────────────────────────────────────────── */
function CourseRemindersPanel({ courseCode, courseColor, onClose }: { courseCode:string; courseColor:string; onClose:()=>void }) {
  const items = [
    { label:"Assignment 1", due:"Tomorrow",  urgent:true  },
    { label:"Midterm Exam", due:"In 5 days", urgent:false },
    { label:"Lab Report 2", due:"In 8 days", urgent:false },
  ];
  return (
    <div style={{ position:"absolute", top:"calc(100% + 10px)", right:0, zIndex:200, width:"300px", background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"15px", boxShadow:"0 22px 58px rgba(0,0,0,0.18)", overflow:"hidden", animation:"panelIn 0.2s ease" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px", borderBottom:"1px solid var(--border)", background:"var(--section-bg)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{width:"8px",height:"8px",borderRadius:"50%",background:courseColor}}/>
          <span style={{ fontFamily:F.heading, fontWeight:800, fontSize:"0.88rem", color:"var(--text-primary)" }}>{courseCode} — Reminders</span>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", padding:0, display:"flex" }}><X size={13}/></button>
      </div>
      {items.map((r,i)=>(
        <div key={i} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderTop:i!==0?"1px solid var(--border)":undefined }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:r.urgent?"#ef4444":courseColor, flexShrink:0 }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:F.heading, fontWeight:700, fontSize:"0.84rem", color:"var(--text-primary)" }}>{r.label}</div>
            <div style={{ fontFamily:F.body, fontSize:"0.72rem", color:"var(--text-muted)" }}>{r.due}</div>
          </div>
          {r.urgent && <span style={{ fontFamily:F.body, fontSize:"0.67rem", padding:"2px 8px", borderRadius:"99px", background:"rgba(239,68,68,0.12)", color:"#ef4444", fontWeight:600 }}>Soon</span>}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   FOCUS MODE OVERLAY
───────────────────────────────────────────────────── */
function FocusMode({ courseCode, courseName, onExit }: { courseCode:string; courseName:string; onExit:()=>void }) {
  const [phase, setPhase]       = useState<"study"|"break">("study");
  const [running, setRunning]   = useState(false);
  const [sessions, setSessions] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25*60);
  const [quoteIdx]              = useState(Math.floor(Math.random()*3));

  const quotes = [
    '"Deep work is the ability to focus without distraction on a cognitively demanding task." — Cal Newport',
    '"The successful warrior is the average person with laser-like focus." — Bruce Lee',
    '"It\'s not that I\'m so smart, it\'s just that I stay with problems longer." — Albert Einstein',
  ];

  useEffect(()=>{
    if(!running) return;
    const id = setInterval(()=>{
      setTimeLeft(t=>{
        if(t<=1){
          setRunning(false);
          if(phase==="study"){setSessions(s=>s+1);setPhase("break");return 5*60;}
          else{setPhase("study");return 25*60;}
        }
        return t-1;
      });
    },1000);
    return ()=>clearInterval(id);
  },[running,phase]);

  const reset = ()=>{ setRunning(false); setTimeLeft(phase==="study"?25*60:5*60); };
  const mins  = Math.floor(timeLeft/60).toString().padStart(2,"0");
  const secs  = (timeLeft%60).toString().padStart(2,"0");
  const prog  = phase==="study"?1-timeLeft/(25*60):1-timeLeft/(5*60);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(5,8,4,0.96)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:F.body }}>
      <button onClick={onExit} style={{ position:"absolute", top:"24px", right:"24px", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.14)", borderRadius:"9px", padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontFamily:F.body, fontSize:"0.82rem", display:"flex", alignItems:"center", gap:"6px" }}
        onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color="rgba(255,255,255,0.9)";(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.13)";}}
        onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color="rgba(255,255,255,0.6)";(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.08)";}}>
        <X size={13}/> Exit Focus Mode
      </button>

      {sessions > 0 && (
        <div style={{ position:"absolute", top:"24px", left:"24px", display:"flex", alignItems:"center", gap:"6px" }}>
          {Array.from({length:sessions}).map((_,i)=>(
            <div key={i} style={{width:"10px",height:"10px",borderRadius:"50%",background:"var(--accent)"}}/>
          ))}
          <span style={{ fontFamily:F.body, fontSize:"0.74rem", color:"rgba(255,255,255,0.35)", marginLeft:"4px" }}>{sessions} session{sessions!==1?"s":""} done</span>
        </div>
      )}

      <div style={{ fontFamily:F.body, fontSize:"0.74rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", color:phase==="study"?"var(--accent)":"#f59e0b", marginBottom:"12px", padding:"4px 14px", borderRadius:"99px", background:phase==="study"?"rgba(102,181,57,0.1)":"rgba(245,158,11,0.1)", border:`1px solid ${phase==="study"?"rgba(102,181,57,0.25)":"rgba(245,158,11,0.25)"}` }}>
        {phase==="study"?"🎯 Deep Focus":"☕ Short Break"}
      </div>

      <div style={{ fontFamily:F.heading, fontWeight:800, fontSize:"1.1rem", color:"rgba(255,255,255,0.5)", marginBottom:"44px" }}>
        {courseCode}{courseName?` · ${courseName}`:""}
      </div>

      {/* Ring + timer */}
      <div style={{ position:"relative", marginBottom:"44px" }}>
        <svg width="220" height="220" style={{ transform:"rotate(-90deg)" }}>
          <circle cx="110" cy="110" r="96" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6"/>
          <circle cx="110" cy="110" r="96" fill="none" stroke={phase==="study"?"#66B539":"#f59e0b"} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${2*Math.PI*96}`} strokeDashoffset={`${2*Math.PI*96*(1-prog)}`} style={{ transition:"stroke-dashoffset 1s linear" }}/>
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ fontFamily:F.heading, fontSize:"5.5rem", fontWeight:900, color:"white", lineHeight:1, letterSpacing:"-0.04em" }}>{mins}:{secs}</div>
          <div style={{ fontFamily:F.body, fontSize:"0.7rem", color:"rgba(255,255,255,0.28)", marginTop:"4px", textTransform:"uppercase", letterSpacing:"0.08em" }}>{phase==="study"?"minutes remaining":"break time"}</div>
        </div>
      </div>

      <div style={{ display:"flex", gap:"13px", marginBottom:"40px" }}>
        <button onClick={reset} style={{ width:"46px",height:"46px",borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.14)",color:"rgba(255,255,255,0.6)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <RotateCcw size={16}/>
        </button>
        <button onClick={()=>setRunning(v=>!v)} style={{ width:"72px",height:"72px",borderRadius:"50%",background:running?"rgba(255,255,255,0.15)":"var(--accent)",border:"none",color:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:running?"none":"0 8px 28px rgba(102,181,57,0.45)",transition:"all 0.2s" }}
          onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.transform="scale(1.06)"}
          onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.transform="scale(1)"}>
          {running?<Pause size={26}/>:<Play size={26} style={{marginLeft:"3px"}}/>}
        </button>
        <button onClick={()=>{setRunning(false);const np=phase==="study"?"break":"study";setPhase(np);setTimeLeft(np==="study"?25*60:5*60);}} style={{ width:"46px",height:"46px",borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.14)",color:"rgba(255,255,255,0.6)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }} title="Switch phase">
          <Timer size={16}/>
        </button>
      </div>

      <div style={{ display:"flex", gap:"28px", marginBottom:"32px" }}>
        {[{label:"25 min",sub:"Focus",active:phase==="study"},{label:"5 min",sub:"Break",active:phase==="break"}].map((item,i)=>(
          <div key={i} style={{ textAlign:"center" }}>
            <div style={{ fontFamily:F.heading, fontWeight:700, fontSize:"0.88rem", color:item.active?"white":"rgba(255,255,255,0.25)" }}>{item.label}</div>
            <div style={{ fontFamily:F.body, fontSize:"0.7rem", color:item.active?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.18)" }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ position:"absolute", bottom:"28px", fontFamily:F.body, fontSize:"0.75rem", color:"rgba(255,255,255,0.2)", fontStyle:"italic", textAlign:"center", maxWidth:"520px", padding:"0 32px", lineHeight:1.65 }}>
        {quotes[quoteIdx]}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────────────── */
function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={{ ...card, padding:"44px 24px", textAlign:"center" }}>
      <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"52px", height:"52px", borderRadius:"14px", background:"var(--accent-soft)", marginBottom:"14px", color:"var(--accent)" }}>{icon}</div>
      <p style={{ fontFamily:F.heading, fontWeight:700, fontSize:"0.95rem", color:"var(--text-primary)", margin:"0 0 6px" }}>{title}</p>
      <p style={{ fontFamily:F.body, fontSize:"0.83rem", color:"var(--text-muted)", margin:0, maxWidth:"300px", lineHeight:1.7 }}>{body}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   TAB: OVERVIEW
───────────────────────────────────────────────────── */
function Overview({
  courseCode, courseColor, docs, assignments, onUploadSyllabus,
}: {
  courseCode:string; courseColor:string; docs:Doc[]; assignments:Assignment[];
  onUploadSyllabus: (f:File)=>void;
}) {
  const { display: gradeDisplay } = computeGrade(assignments);
  const nextDue = assignments.filter(a=>a.status==="upcoming").sort((a,b)=>a.due.localeCompare(b.due))[0];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"13px" }}>
        {[
          { label:"Current Grade",  value:gradeDisplay,                         sub:computeGrade(assignments).pct!==null?"weighted avg":"No grades yet",   icon:<BarChart2     size={15}/> },
          { label:"Assignments",    value:assignments.length>0?String(assignments.length):"—", sub:assignments.length>0?`${assignments.filter(a=>a.grade!==null).length} graded`:"None added yet", icon:<ClipboardList size={15}/> },
          { label:"Next Deadline",  value:nextDue?nextDue.due:"—",              sub:nextDue?nextDue.label:"Nothing upcoming",  icon:<CalendarClock size={15}/> },
        ].map(({ label, value, sub, icon }) => (
          <div key={label} style={{ ...card, padding:"15px 16px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
              <div style={{ width:"28px", height:"28px", borderRadius:"7px", background:"var(--accent-soft)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--accent)", flexShrink:0 }}>{icon}</div>
              <span style={{ fontFamily:F.body, fontSize:"0.66rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", color:"var(--text-muted)" }}>{label}</span>
            </div>
            <div style={{ fontFamily:F.heading, fontSize:"1.25rem", fontWeight:800, color:courseColor, lineHeight:1, marginBottom:"3px" }}>{value}</div>
            <div style={{ fontFamily:F.body, fontSize:"0.68rem", color:"var(--text-muted)" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Spark suggestions */}
      <div style={card}>
        <div style={sHead}>
          <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
            <SparkLogo size={20}/>
            <span style={{ fontFamily:F.heading, fontSize:"0.86rem", fontWeight:800, color:"var(--text-primary)" }}>Spark Suggestions</span>
          </div>
          <span style={{ fontFamily:F.body, fontSize:"0.7rem", color:"var(--text-muted)", fontStyle:"italic" }}>
            {docs.length>0?"from your documents":"upload documents to unlock"}
          </span>
        </div>
        <div style={{ padding:"18px 20px", display:"flex", alignItems:"flex-start", gap:"12px" }}>
          <BookOpen size={16} style={{ color:"var(--text-muted)", flexShrink:0, marginTop:"2px" }}/>
          <p style={{ fontFamily:F.body, fontSize:"0.84rem", color:"var(--text-muted)", margin:0, lineHeight:1.7 }}>
            {docs.length===0
              ? "Upload your course materials and Spark will surface relevant study suggestions, key concept alerts and personalized tips here."
              : "Spark is ready. Ask it anything about this course — answers come only from your uploaded documents."}
          </p>
        </div>
      </div>

      {/* Subtle syllabus option (not prominent) */}
      {!docs.some(d=>d.type==="syllabus") && (
        <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", background:"var(--bg-secondary)", borderRadius:"11px", border:"1px solid var(--border)", opacity:0.85 }}>
          <FileUp size={14} style={{ color:"var(--text-muted)", flexShrink:0 }}/>
          <p style={{ fontFamily:F.body, fontSize:"0.79rem", color:"var(--text-muted)", margin:0, flex:1, lineHeight:1.5 }}>
            Optionally upload a syllabus to auto-fill assignments and deadlines.
          </p>
          <label style={{ display:"flex", alignItems:"center", gap:"5px", background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"8px", padding:"5px 12px", fontFamily:F.body, fontWeight:600, fontSize:"0.75rem", cursor:"pointer", color:"var(--text-secondary)", whiteSpace:"nowrap", transition:"all 0.15s", flexShrink:0 }}
            onMouseEnter={e=>{(e.currentTarget as HTMLLabelElement).style.borderColor="var(--accent)";(e.currentTarget as HTMLLabelElement).style.color="var(--accent)";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLLabelElement).style.borderColor="var(--border)";(e.currentTarget as HTMLLabelElement).style.color="var(--text-secondary)";}}>
            Upload
            <input type="file" accept="*/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f) onUploadSyllabus(f); }}/>
          </label>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   TAB: ASSIGNMENTS (with grade input + calculation)
───────────────────────────────────────────────────── */
function AssignmentsTab({
  assignments, setAssignments, courseColor,
}: {
  assignments: Assignment[]; setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>; courseColor: string;
}) {
  const [addingNew, setAddingNew] = useState(false);
  const [draft, setDraft]         = useState({ label:"", type:"Assignment", due:"", weight:10 });
  const [editingGrade, setEditingGrade] = useState<string|null>(null);
  const [gradeDraft, setGradeDraft]     = useState("");

  const { display: gradeDisplay, pct } = computeGrade(assignments);

  const saveGrade = (id: string) => {
    const val = parseFloat(gradeDraft);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      setAssignments(prev => prev.map(a => a.id===id ? { ...a, grade:val, status:"completed" } : a));
    }
    setEditingGrade(null);
    setGradeDraft("");
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
      {/* Grade summary strip */}
      {assignments.length > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:"14px", padding:"14px 18px", background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"13px", borderLeft:`4px solid ${courseColor}` }}>
          <div>
            <div style={{ fontFamily:F.body, fontSize:"0.68rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", color:"var(--text-muted)", marginBottom:"3px" }}>Running Average</div>
            <div style={{ fontFamily:F.heading, fontSize:"1.6rem", fontWeight:900, color:courseColor, lineHeight:1 }}>{gradeDisplay}</div>
          </div>
          {pct !== null && (
            <div style={{ flex:1 }}>
              <div style={{ height:"6px", borderRadius:"99px", background:"var(--bg-secondary)", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(pct,100)}%`, background:courseColor, borderRadius:"99px", transition:"width 0.5s ease" }}/>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:"4px" }}>
                <span style={{ fontFamily:F.body, fontSize:"0.67rem", color:"var(--text-muted)" }}>{assignments.filter(a=>a.grade!==null).length} graded</span>
                <span style={{ fontFamily:F.body, fontSize:"0.67rem", color:"var(--text-muted)" }}>{assignments.filter(a=>a.grade===null).length} pending</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <div style={sHead}>
          <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
            <ClipboardList size={13} style={{ color:"var(--accent)" }}/>
            <span style={{ fontFamily:F.heading, fontSize:"0.86rem", fontWeight:800, color:"var(--text-primary)" }}>Assignments & Deadlines</span>
          </div>
          <button onClick={()=>setAddingNew(true)} style={{ display:"flex", alignItems:"center", gap:"4px", background:"var(--accent)", color:"var(--primary-foreground)", border:"none", borderRadius:"7px", padding:"5px 10px", fontFamily:F.heading, fontSize:"0.73rem", fontWeight:700, cursor:"pointer" }}>
            <Plus size={11}/> Add
          </button>
        </div>

        {/* New item form */}
        {addingNew && (
          <div style={{ display:"flex", gap:"7px", padding:"12px 16px", borderBottom:"1px solid var(--border)", flexWrap:"wrap", background:"var(--accent-soft)" }}>
            {[
              { key:"label",  placeholder:"Item name (required)", flex:3, type:"text"   },
              { key:"type",   placeholder:"Type",                 flex:1, type:"text"   },
              { key:"due",    placeholder:"Due date",             flex:1, type:"text"   },
              { key:"weight", placeholder:"Weight %",             flex:1, type:"number" },
            ].map(f=>(
              <input key={f.key} placeholder={f.placeholder} value={(draft as any)[f.key]}
                onChange={e=>setDraft(d=>({...d,[f.key]:f.type==="number"?Number(e.target.value):e.target.value}))}
                type={f.type}
                style={{ flex:f.flex, padding:"7px 10px", borderRadius:"7px", border:"1px solid var(--border)", background:"var(--input)", fontFamily:F.body, fontSize:"0.82rem", color:"var(--text-primary)", outline:"none", minWidth:"80px" }}
              />
            ))}
            <button onClick={()=>{
              if(draft.label.trim()) setAssignments(prev=>[...prev,{id:Date.now().toString(),...draft,grade:null,status:"upcoming"}]);
              setAddingNew(false); setDraft({label:"",type:"Assignment",due:"",weight:10});
            }} style={{ background:"var(--accent)", color:"var(--primary-foreground)", border:"none", borderRadius:"7px", padding:"7px 13px", fontFamily:F.heading, fontWeight:700, fontSize:"0.8rem", cursor:"pointer" }}>Save</button>
            <button onClick={()=>setAddingNew(false)} style={{ background:"var(--bg-secondary)", color:"var(--text-muted)", border:"1px solid var(--border)", borderRadius:"7px", padding:"7px 12px", fontFamily:F.body, fontSize:"0.8rem", cursor:"pointer" }}>Cancel</button>
          </div>
        )}

        {assignments.length === 0 && !addingNew && (
          <div style={{ padding:"36px 24px", textAlign:"center" }}>
            <ClipboardList size={30} style={{ color:"var(--text-muted)", marginBottom:"11px" }}/>
            <p style={{ fontFamily:F.heading, fontWeight:700, fontSize:"0.92rem", color:"var(--text-primary)", margin:"0 0 5px" }}>No assignments yet</p>
            <p style={{ fontFamily:F.body, fontSize:"0.82rem", color:"var(--text-muted)", margin:0 }}>Click "Add" to track assignments, quizzes, exams or any scored item.</p>
          </div>
        )}

        {assignments.map((item,i) => (
          <div key={item.id} style={{ display:"flex", alignItems:"center", gap:"11px", padding:"13px 18px", borderTop:i!==0||addingNew?"1px solid var(--border)":undefined }}>
            {/* Status dot */}
            <div style={{ width:"8px", height:"8px", borderRadius:"50%", flexShrink:0, background:item.grade!==null?courseColor:item.status==="overdue"?"#ef4444":"var(--border)" }}/>
            {/* Info */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:F.heading, fontSize:"0.88rem", fontWeight:700, color:"var(--text-primary)" }}>{item.label}</div>
              <div style={{ fontFamily:F.body, fontSize:"0.71rem", color:"var(--text-muted)" }}>{item.type}{item.weight?` · ${item.weight}% weight`:""}{item.due?` · Due ${item.due}`:""}</div>
            </div>
            {/* Grade input / display */}
            <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
              {editingGrade === item.id ? (
                <>
                  <input value={gradeDraft} onChange={e=>setGradeDraft(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") saveGrade(item.id); if(e.key==="Escape"){setEditingGrade(null);setGradeDraft("");} }}
                    placeholder="0-100" type="number" min="0" max="100" autoFocus
                    style={{ width:"72px", padding:"5px 8px", borderRadius:"7px", border:`1.5px solid ${courseColor}`, background:"var(--input)", fontFamily:F.mono, fontSize:"0.82rem", color:"var(--text-primary)", outline:"none", textAlign:"center" }}
                  />
                  <button onClick={()=>saveGrade(item.id)} style={{ width:"28px",height:"28px",borderRadius:"7px",background:courseColor,color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Check size={13}/></button>
                  <button onClick={()=>{setEditingGrade(null);setGradeDraft("");}} style={{ width:"28px",height:"28px",borderRadius:"7px",background:"var(--bg-secondary)",color:"var(--text-muted)",border:"1px solid var(--border)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><X size={13}/></button>
                </>
              ) : (
                <>
                  {item.grade !== null ? (
                    <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                      <span style={{ fontFamily:F.heading, fontWeight:800, fontSize:"1rem", color:courseColor }}>{item.grade}%</span>
                      <button onClick={()=>{setEditingGrade(item.id);setGradeDraft(String(item.grade));}} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:0,display:"flex" }}><Edit2 size={11}/></button>
                    </div>
                  ) : (
                    <button onClick={()=>{setEditingGrade(item.id);setGradeDraft("");}}
                      style={{ fontFamily:F.body, fontSize:"0.74rem", padding:"4px 11px", borderRadius:"99px", border:"1px dashed var(--border)", background:"transparent", color:"var(--text-muted)", cursor:"pointer", fontWeight:500, transition:"all 0.15s" }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=courseColor;(e.currentTarget as HTMLButtonElement).style.color=courseColor;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="var(--border)";(e.currentTarget as HTMLButtonElement).style.color="var(--text-muted)";}}>
                      + Grade
                    </button>
                  )}
                  <button onClick={()=>setAssignments(prev=>prev.filter(x=>x.id!==item.id))} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:0,display:"flex" }}><Trash2 size={12}/></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   TAB: GRADES
───────────────────────────────────────────────────── */
function GradesTab({ assignments, courseColor }: { assignments: Assignment[]; courseColor: string }) {
  const graded = assignments.filter(a=>a.grade!==null);
  const { display } = computeGrade(assignments);

  if (graded.length === 0) {
    return <EmptyState icon={<BarChart2 size={24}/>} title="No grades recorded" body="Enter grades in the Assignments tab — they'll appear here and update your running average automatically."/>;
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
      <div style={{ ...card, padding:"18px 20px", borderLeft:`4px solid ${courseColor}` }}>
        <div style={{ fontFamily:F.body, fontSize:"0.68rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", color:"var(--text-muted)", marginBottom:"4px" }}>Overall Average</div>
        <div style={{ fontFamily:F.heading, fontSize:"2.2rem", fontWeight:900, color:courseColor, lineHeight:1 }}>{display}</div>
      </div>
      <div style={card}>
        <div style={sHead}>
          <span style={{ fontFamily:F.heading, fontSize:"0.84rem", fontWeight:700, color:"var(--text-primary)" }}>Grade Breakdown</span>
          <span style={{ fontFamily:F.body, fontSize:"0.74rem", color:"var(--text-muted)" }}>{graded.length} of {assignments.length} graded</span>
        </div>
        {graded.map((a,i)=>(
          <div key={a.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 18px", borderTop:i!==0?"1px solid var(--border)":undefined }}>
            <div>
              <div style={{ fontFamily:F.heading, fontWeight:700, fontSize:"0.88rem", color:"var(--text-primary)" }}>{a.label}</div>
              <div style={{ fontFamily:F.body, fontSize:"0.72rem", color:"var(--text-muted)" }}>{a.type}{a.weight?` · ${a.weight}% weight`:""}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
              <div style={{ width:"80px", height:"4px", borderRadius:"99px", background:"var(--bg-secondary)", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${a.grade!}%`, background:courseColor, borderRadius:"99px" }}/>
              </div>
              <span style={{ fontFamily:F.heading, fontWeight:800, fontSize:"1rem", color:courseColor, minWidth:"42px", textAlign:"right" }}>{a.grade}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   TAB: DOCUMENTS
───────────────────────────────────────────────────── */
function DocsTab({ docs, onDocsChange }: { docs: Doc[]; onDocsChange: (d: Doc[]) => void }) {
  const typeLabel: Record<Doc["type"], string> = { syllabus:"Syllabus", notes:"Lecture Notes", reading:"Reading", "past-exam":"Past Exam", other:"Other" };
  const typeColor: Record<Doc["type"], string> = { syllabus:"#66B539", notes:"#3b82f6", reading:"#f59e0b", "past-exam":"#8b5cf6", other:"#6b7280" };

  const toggleDoc = (id: string) => onDocsChange(docs.map(d=>d.id===id?{...d,used:!d.used}:d));
  const removeDoc = (id: string) => onDocsChange(docs.filter(d=>d.id!==id));

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const newDoc: Doc = {
      id:Date.now().toString(), name:file.name,
      type:file.name.toLowerCase().includes("syllabus")?"syllabus":"notes",
      size:`${(file.size/1024).toFixed(0)} KB`,
      uploadedAt:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),
      used:true,
    };
    onDocsChange([...docs, newDoc]);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
      <div style={{ ...card, padding:"18px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
          <div>
            <p style={{ fontFamily:F.heading, fontWeight:800, fontSize:"0.92rem", color:"var(--text-primary)", margin:"0 0 2px" }}>Spark Knowledge Base</p>
            <p style={{ fontFamily:F.body, fontSize:"0.76rem", color:"var(--text-muted)", margin:0 }}>Spark only answers from these documents. Files uploaded via Spark chat also appear here.</p>
          </div>
          <label style={{ display:"flex", alignItems:"center", gap:"5px", background:"var(--accent)", color:"var(--primary-foreground)", border:"none", borderRadius:"9px", padding:"9px 15px", fontFamily:F.heading, fontWeight:700, fontSize:"0.79rem", cursor:"pointer", flexShrink:0, whiteSpace:"nowrap" }}>
            <FileUp size={13}/> Upload Document
            <input type="file" accept="*/*" onChange={handleUpload} style={{ display:"none" }}/>
          </label>
        </div>
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
          {["PDF","DOCX","TXT","PPTX","XLS","Any format"].map(f=>(
            <span key={f} style={{ fontFamily:F.mono, fontSize:"0.67rem", padding:"2px 8px", borderRadius:"5px", background:"var(--bg-secondary)", border:"1px solid var(--border)", color:"var(--text-muted)" }}>{f}</span>
          ))}
        </div>
      </div>

      {docs.length===0 ? (
        <EmptyState icon={<FileText size={24}/>} title="No documents yet" body="Upload your syllabus, lecture notes, readings or past exams. Spark will use them to answer your questions with citations."/>
      ) : (
        <div style={card}>
          <div style={sHead}>
            <span style={{ fontFamily:F.heading, fontSize:"0.84rem", fontWeight:700, color:"var(--text-primary)" }}>{docs.length} document{docs.length>1?"s":""}</span>
            <span style={{ fontFamily:F.body, fontSize:"0.74rem", color:"var(--text-muted)" }}>{docs.filter(d=>d.used).length} active in Spark</span>
          </div>
          {docs.map((doc,i)=>(
            <div key={doc.id} style={{ display:"flex", alignItems:"center", gap:"13px", padding:"13px 18px", borderTop:i!==0?"1px solid var(--border)":undefined, opacity:doc.used?1:0.5, transition:"opacity 0.2s" }}>
              <div style={{ width:"36px", height:"36px", borderRadius:"9px", background:`${typeColor[doc.type]}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <FileText size={16} style={{ color:typeColor[doc.type] }}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:F.heading, fontSize:"0.88rem", fontWeight:700, color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{doc.name}</div>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginTop:"2px" }}>
                  <span style={{ fontFamily:F.body, fontSize:"0.69rem", padding:"1px 7px", borderRadius:"99px", background:`${typeColor[doc.type]}18`, color:typeColor[doc.type], fontWeight:600 }}>{typeLabel[doc.type]}</span>
                  <span style={{ fontFamily:F.body, fontSize:"0.69rem", color:"var(--text-muted)" }}>{doc.size} · {doc.uploadedAt}</span>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
                <button onClick={()=>toggleDoc(doc.id)} style={{ fontFamily:F.body, fontSize:"0.71rem", padding:"4px 10px", borderRadius:"99px", border:`1px solid ${doc.used?"var(--accent)":"var(--border)"}`, background:doc.used?"var(--accent-soft)":"transparent", color:doc.used?"var(--accent)":"var(--text-muted)", cursor:"pointer", fontWeight:600, transition:"all 0.15s" }}>
                  {doc.used?"✓ In Spark":"Off"}
                </button>
                <button onClick={()=>removeDoc(doc.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", padding:0, display:"flex" }}><Trash2 size={13}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"flex", alignItems:"flex-start", gap:"10px", padding:"13px 16px", background:"var(--accent-soft)", borderRadius:"11px", border:"1px solid var(--border)" }}>
        <AlertCircle size={15} style={{ color:"var(--accent)", flexShrink:0, marginTop:"1px" }}/>
        <p style={{ fontFamily:F.body, fontSize:"0.8rem", color:"var(--accent)", margin:0, lineHeight:1.65, fontWeight:500 }}>
          Spark only reads documents you upload here. Every answer includes a citation showing exactly which document it came from.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   TAB: REMINDERS (course-specific)
───────────────────────────────────────────────────── */
function Reminders({ courseCode }: { courseCode: string }) {
  const [items, setItems] = useState([
    { id:"1", label:"Assignment 1 due", date:"Mar 7",  time:"11:59 PM", type:"deadline" },
    { id:"2", label:"Midterm Exam",     date:"Mar 14", time:"9:00 AM",  type:"exam"     },
  ]);
  const typeColors: Record<string,string> = { deadline:"#ef4444", exam:"#8b5cf6", custom:"var(--accent)" };

  return (
    <div style={card}>
      <div style={sHead}>
        <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
          <BellRing size={13} style={{ color:"var(--accent)" }}/>
          <span style={{ fontFamily:F.heading, fontSize:"0.86rem", fontWeight:800, color:"var(--text-primary)" }}>{courseCode} — Reminders</span>
        </div>
        <button style={{ display:"flex", alignItems:"center", gap:"4px", background:"var(--accent)", color:"var(--primary-foreground)", border:"none", borderRadius:"7px", padding:"5px 10px", fontFamily:F.heading, fontSize:"0.73rem", fontWeight:700, cursor:"pointer" }}>
          <Plus size={11}/> Add
        </button>
      </div>
      {items.map((r,i)=>(
        <div key={r.id} style={{ display:"flex", alignItems:"center", gap:"13px", padding:"13px 18px", borderTop:i!==0?"1px solid var(--border)":undefined }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:typeColors[r.type]??typeColors.custom, flexShrink:0 }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:F.heading, fontWeight:700, fontSize:"0.88rem", color:"var(--text-primary)" }}>{r.label}</div>
            <div style={{ fontFamily:F.body, fontSize:"0.72rem", color:"var(--text-muted)" }}>{r.date} · {r.time}</div>
          </div>
          <button onClick={()=>setItems(prev=>prev.filter(x=>x.id!==r.id))} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:0,display:"flex" }}><Trash2 size={12}/></button>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   TAB: LEARNBEAM ACTIVITIES
───────────────────────────────────────────────────── */
type ActivityView = "grid"|"quiz"|"notes";

function ActivitiesTab({ courseCode, docs, onFocusMode }: { courseCode:string; docs:Doc[]; onFocusMode:()=>void }) {
  const [view, setView]   = useState<ActivityView>("grid");
  const [quizIdx, setQuizIdx]   = useState(0);
  const [quizScore, setQuizScore] = useState({correct:0,total:0});
  const [answered, setAnswered] = useState<number|null>(null);
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes]       = useState<{id:string;text:string;created:string}[]>([]);

  const hasDocs = docs.length > 0;

  const SAMPLE_QUIZ = [
    { q:"What is the primary purpose of this course?",          options:["Apply theories","Pass exams","Memorize facts","Skip lectures"], correct:0 },
    { q:"Which study technique improves long-term retention?",  options:["Re-reading","Highlighting","Active recall","Passive listening"], correct:2 },
    { q:"What does Spark use to answer questions?",              options:["The internet","Wikipedia","Your documents","Random sources"], correct:2 },
  ];
  const current = SAMPLE_QUIZ[quizIdx % SAMPLE_QUIZ.length];

  const handleAnswer = (idx: number) => {
    if (answered !== null) return;
    setAnswered(idx);
    setQuizScore(s => ({ correct:s.correct+(idx===current.correct?1:0), total:s.total+1 }));
  };
  const nextQuestion = () => { setAnswered(null); setQuizIdx(q=>q+1); };

  const activities = [
    {
      id:"quiz" as const,
      icon:<Zap size={30}/>,
      color:"#f59e0b",
      title:"Quiz Me",
      desc:"AI-generated questions from your uploaded course materials to test your understanding.",
      badge:"Knowledge Check",
      badgeSub:"Not graded — for self-evaluation only",
      requiresDocs:true,
    },
    {
      id:"notes" as const,
      icon:<StickyNote size={30}/>,
      color:"#3b82f6",
      title:"Smart Notes",
      desc:"Write and organize your own notes for this course. Ask Spark to summarize any document into notes.",
      badge:"Your Notes",
      badgeSub:"Personal — not submitted anywhere",
      requiresDocs:false,
    },
    {
      id:"focus" as const,
      icon:<Brain size={30}/>,
      color:"#66B539",
      title:"Focus Mode",
      desc:"Enter deep work with a Pomodoro timer. Block distractions and maximize your study efficiency.",
      badge:"Productivity",
      badgeSub:"Pomodoro · 25 min focus / 5 min break",
      requiresDocs:false,
    },
  ];

  if (view === "quiz") {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"4px" }}>
          <button onClick={()=>setView("grid")} style={{ display:"flex", alignItems:"center", gap:"5px", background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontFamily:F.body, fontSize:"0.82rem", padding:"4px 8px", borderRadius:"7px" }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background="var(--bg-secondary)";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background="none";}}>
            <ChevronLeft size={14}/> Activities
          </button>
          <span style={{ fontFamily:F.body, fontSize:"0.74rem", color:"var(--text-muted)", padding:"2px 8px", borderRadius:"99px", background:"rgba(245,158,11,0.12)", color:"#f59e0b", fontWeight:600 }}>Not graded</span>
          <span style={{ fontFamily:F.heading, fontWeight:700, fontSize:"0.82rem", color:"var(--text-muted)", marginLeft:"auto" }}>{quizScore.correct}/{quizScore.total} correct</span>
        </div>

        {!hasDocs ? (
          <EmptyState icon={<Zap size={24}/>} title="Upload documents first" body={`Upload your ${courseCode} materials and Spark will generate personalized quiz questions from your actual content.`}/>
        ) : (
          <div style={{ ...card, padding:"26px 24px" }}>
            <div style={{ fontFamily:F.body, fontSize:"0.72rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", color:"#f59e0b", marginBottom:"14px" }}>Question {(quizIdx%SAMPLE_QUIZ.length)+1} of {SAMPLE_QUIZ.length}</div>
            <p style={{ fontFamily:F.heading, fontWeight:700, fontSize:"1.05rem", color:"var(--text-primary)", margin:"0 0 22px", lineHeight:1.5 }}>{current.q}</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"9px", marginBottom:"20px" }}>
              {current.options.map((opt,i)=>{
                let bg="var(--bg-secondary)"; let border="var(--border)"; let color="var(--text-secondary)";
                if(answered!==null){
                  if(i===current.correct){bg="rgba(102,181,57,0.15)";border="#66B539";color="#66B539";}
                  else if(i===answered&&answered!==current.correct){bg="rgba(239,68,68,0.1)";border="#ef4444";color="#ef4444";}
                }
                return (
                  <button key={i} onClick={()=>handleAnswer(i)}
                    style={{ padding:"12px 16px", borderRadius:"10px", border:`1.5px solid ${border}`, background:bg, color, fontFamily:F.body, fontSize:"0.86rem", textAlign:"left", cursor:answered!==null?"default":"pointer", fontWeight:500, transition:"all 0.15s" }}
                    disabled={answered!==null}>{opt}</button>
                );
              })}
            </div>
            {answered!==null && (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontFamily:F.body, fontSize:"0.82rem", color:answered===current.correct?"#66B539":"#ef4444", fontWeight:600 }}>
                  {answered===current.correct?"✓ Correct!":"✗ Incorrect"}
                </div>
                <button onClick={nextQuestion} style={{ background:"var(--accent)", color:"var(--primary-foreground)", border:"none", borderRadius:"8px", padding:"8px 18px", fontFamily:F.heading, fontWeight:700, fontSize:"0.84rem", cursor:"pointer" }}>Next →</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (view === "notes") {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"4px" }}>
          <button onClick={()=>setView("grid")} style={{ display:"flex", alignItems:"center", gap:"5px", background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontFamily:F.body, fontSize:"0.82rem", padding:"4px 8px", borderRadius:"7px" }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background="var(--bg-secondary)";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background="none";}}>
            <ChevronLeft size={14}/> Activities
          </button>
          <span style={{ fontFamily:F.heading, fontWeight:700, fontSize:"1rem", color:"var(--text-primary)" }}>Smart Notes</span>
        </div>
        <div style={{ ...card, padding:"0", overflow:"hidden" }}>
          <div style={sHead}>
            <span style={{ fontFamily:F.heading, fontWeight:700, fontSize:"0.86rem", color:"var(--text-primary)" }}>{notes.length} note{notes.length!==1?"s":""}</span>
          </div>
          <div style={{ padding:"16px" }}>
            <textarea value={noteText} onChange={e=>setNoteText(e.target.value)}
              placeholder="Write your notes here… (Shift+Enter for new line, Enter to save)"
              rows={4}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();if(noteText.trim()){setNotes(p=>[...p,{id:Date.now().toString(),text:noteText.trim(),created:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"})}]);setNoteText("");}}} }
              style={{ width:"100%", padding:"11px 14px", borderRadius:"10px", border:"1.5px solid var(--border)", background:"var(--input)", fontFamily:F.body, fontSize:"0.86rem", color:"var(--text-primary)", outline:"none", resize:"vertical", lineHeight:1.6, boxSizing:"border-box" }}
            />
            <button onClick={()=>{if(noteText.trim()){setNotes(p=>[...p,{id:Date.now().toString(),text:noteText.trim(),created:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"})}]);setNoteText("");}}}
              disabled={!noteText.trim()} style={{ marginTop:"8px", background:"#3b82f6", color:"#fff", border:"none", borderRadius:"8px", padding:"8px 18px", fontFamily:F.heading, fontWeight:700, fontSize:"0.82rem", cursor:noteText.trim()?"pointer":"not-allowed", opacity:noteText.trim()?1:0.5 }}>
              Save Note
            </button>
          </div>
          {notes.length>0 && (
            <div style={{ borderTop:"1px solid var(--border)" }}>
              {notes.map((n,i)=>(
                <div key={n.id} style={{ display:"flex", gap:"12px", padding:"13px 18px", borderTop:i!==0?"1px solid var(--border)":undefined }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontFamily:F.body, fontSize:"0.85rem", color:"var(--text-primary)", margin:"0 0 4px", whiteSpace:"pre-wrap", lineHeight:1.65 }}>{n.text}</p>
                    <span style={{ fontFamily:F.body, fontSize:"0.69rem", color:"var(--text-muted)" }}>{n.created}</span>
                  </div>
                  <button onClick={()=>setNotes(p=>p.filter(x=>x.id!==n.id))} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:0,display:"flex",alignItems:"flex-start" }}><Trash2 size={12}/></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
      <div>
        <h3 style={{ fontFamily:F.heading, fontWeight:900, fontSize:"1.25rem", color:"var(--text-primary)", margin:"0 0 5px", letterSpacing:"-0.02em" }}>LearnBeam Activities</h3>
        <p style={{ fontFamily:F.body, fontSize:"0.82rem", color:"var(--text-muted)", margin:0 }}>
          AI-powered tools built from your course documents. These are for your own learning — none of them affect your grade.
        </p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:"14px" }}>
        {activities.map(act=>(
          <div key={act.id} style={{ ...card, padding:"24px 22px", display:"flex", flexDirection:"column", gap:"14px", transition:"box-shadow 0.2s, transform 0.15s", cursor:"pointer", borderTop:`3px solid ${act.color}` }}
            onMouseEnter={e=>{const el=e.currentTarget as HTMLDivElement;el.style.boxShadow="0 12px 32px rgba(0,0,0,0.1)";el.style.transform="translateY(-2px)";}}
            onMouseLeave={e=>{const el=e.currentTarget as HTMLDivElement;el.style.boxShadow="none";el.style.transform="translateY(0)";}}
          >
            <div style={{ width:"52px", height:"52px", borderRadius:"14px", background:`${act.color}18`, display:"flex", alignItems:"center", justifyContent:"center", color:act.color }}>
              {act.icon}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:F.heading, fontWeight:800, fontSize:"1rem", color:"var(--text-primary)", marginBottom:"5px" }}>{act.title}</div>
              <p style={{ fontFamily:F.body, fontSize:"0.8rem", color:"var(--text-muted)", margin:0, lineHeight:1.6 }}>{act.desc}</p>
            </div>
            <div>
              <div style={{ fontFamily:F.body, fontSize:"0.67rem", fontWeight:700, color:act.color, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"2px" }}>{act.badge}</div>
              <div style={{ fontFamily:F.body, fontSize:"0.68rem", color:"var(--text-muted)", marginBottom:"12px" }}>{act.badgeSub}</div>
              {act.requiresDocs && !hasDocs ? (
                <div style={{ fontFamily:F.body, fontSize:"0.75rem", color:"var(--text-muted)", padding:"7px 12px", borderRadius:"8px", background:"var(--bg-secondary)", border:"1px solid var(--border)", textAlign:"center" }}>
                  Upload documents first
                </div>
              ) : (
                <button
                  onClick={()=>{ if(act.id==="focus") onFocusMode(); else setView(act.id as ActivityView); }}
                  style={{ width:"100%", padding:"9px", borderRadius:"9px", background:act.color, color:"#fff", border:"none", fontFamily:F.heading, fontWeight:700, fontSize:"0.82rem", cursor:"pointer", boxShadow:`0 4px 14px ${act.color}44`, transition:"opacity 0.15s" }}
                  onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.opacity="0.88"}
                  onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.opacity="1"}
                >
                  {act.id==="focus"?"Enter Focus Mode":act.id==="quiz"?"Start Quiz":"Open Notes"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   SPARK CHAT MESSAGE
───────────────────────────────────────────────────── */
function SparkMessage({ msg, compact }: { msg: ChatMsg; compact?: boolean }) {
  const [citOpen, setCitOpen] = useState(false);
  const isAI     = msg.role==="ai";
  const isSystem = msg.role==="system";

  if(isSystem) return (
    <div style={{ textAlign:"center", padding:"6px 0" }}>
      <span style={{ fontFamily:F.body, fontSize:"0.69rem", color:"var(--text-muted)", padding:"3px 10px", background:"var(--bg-secondary)", borderRadius:"99px", border:"1px solid var(--border)" }}>{msg.text}</span>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:isAI?"flex-start":"flex-end", gap:"4px" }}>
      <div style={{ display:"flex", alignItems:"flex-end", gap:"7px", flexDirection:isAI?"row":"row-reverse" }}>
        {isAI && (
          <div style={{ width:compact?"22px":"26px", height:compact?"22px":"26px", borderRadius:"50%", background:"var(--accent-soft)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <SparkLogo size={compact?14:17}/>
          </div>
        )}
        <div style={{ maxWidth:compact?"88%":"78%", padding:compact?"8px 11px":"11px 14px", borderRadius:"14px", fontFamily:F.body, fontSize:compact?"0.78rem":"0.86rem", lineHeight:1.65, borderBottomRightRadius:!isAI?3:14, borderBottomLeftRadius:isAI?3:14, background:!isAI?"var(--accent)":"var(--bg-secondary)", color:!isAI?"var(--primary-foreground)":"var(--text-primary)", border:isAI?"1px solid var(--border)":"none" }}>
          {msg.text}
        </div>
      </div>
      {isAI&&msg.flagged&&(
        <div style={{ display:"flex", alignItems:"flex-start", gap:"6px", marginLeft:compact?"29px":"33px", padding:"7px 11px", background:"#fff8e1", border:"1px solid #f59e0b", borderRadius:"9px", maxWidth:compact?"88%":"78%" }}>
          <AlertCircle size={13} style={{ color:"#f59e0b", flexShrink:0, marginTop:"1px" }}/>
          <p style={{ fontFamily:F.body, fontSize:"0.74rem", color:"#92400e", margin:0, lineHeight:1.6 }}>{msg.flagNote}</p>
        </div>
      )}
      {isAI&&msg.citations&&msg.citations.length>0&&(
        <div style={{ marginLeft:compact?"29px":"33px", maxWidth:compact?"88%":"78%" }}>
          <button onClick={()=>setCitOpen(v=>!v)} style={{ display:"flex", alignItems:"center", gap:"5px", background:"none", border:"none", cursor:"pointer", color:"var(--accent)", fontFamily:F.body, fontSize:"0.72rem", fontWeight:600, padding:"3px 0" }}>
            <Link size={11}/>{msg.citations.length} source{msg.citations.length>1?"s":""}{citOpen?<ChevronUp size={10}/>:<ChevronDown size={10}/>}
          </button>
          {citOpen&&(
            <div style={{ display:"flex", flexDirection:"column", gap:"6px", marginTop:"4px" }}>
              {msg.citations.map((c,i)=>(
                <div key={i} style={{ padding:"8px 11px", background:"var(--bg-secondary)", border:"1px solid var(--border)", borderRadius:"9px", borderLeft:"3px solid var(--accent)" }}>
                  <p style={{ fontFamily:F.heading, fontSize:"0.73rem", fontWeight:700, color:"var(--accent)", margin:"0 0 3px" }}>{c.docName}</p>
                  <p style={{ fontFamily:F.body, fontSize:"0.75rem", color:"var(--text-secondary)", margin:0, lineHeight:1.6, fontStyle:"italic" }}>"{c.excerpt}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   SPARK CHAT INTERFACE
───────────────────────────────────────────────────── */
function SparkChat({
  courseCode, docs, messages, aiInput, onInputChange, onSend, compact, onFileUpload,
}: {
  courseCode:string; docs:Doc[]; messages:ChatMsg[]; aiInput:string;
  onInputChange:(v:string)=>void; onSend:(t?:string)=>void;
  compact?:boolean; onFileUpload:(f:File)=>void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight; },[messages]);
  const activeDocs = docs.filter(d=>d.used);
  const quickPrompts = [`Summarise ${courseCode}`,"Explain key concepts","What topics will be tested?","Make a study plan"];

  return (
    <>
      {activeDocs.length===0?(
        <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:compact?"7px 12px":"9px 16px", background:"#fff8e1", borderBottom:"1px solid #f59e0b" }}>
          <AlertCircle size={13} style={{ color:"#f59e0b", flexShrink:0 }}/>
          <p style={{ fontFamily:F.body, fontSize:"0.75rem", color:"#92400e", margin:0 }}>No documents yet — Spark answers only from your course files.</p>
        </div>
      ):(
        <div style={{ display:"flex", alignItems:"center", gap:"7px", padding:compact?"5px 12px":"7px 16px", borderBottom:"1px solid var(--border)", background:"var(--accent-soft)", flexWrap:"wrap" }}>
          <CheckCircle2 size={12} style={{ color:"var(--accent)", flexShrink:0 }}/>
          <span style={{ fontFamily:F.body, fontSize:"0.71rem", color:"var(--accent)", fontWeight:600 }}>Reading from:</span>
          {activeDocs.slice(0,compact?2:4).map(d=>(
            <span key={d.id} style={{ fontFamily:F.body, fontSize:"0.69rem", padding:"1px 7px", borderRadius:"99px", background:"var(--bg-surface)", border:"1px solid var(--border)", color:"var(--text-secondary)" }}>{d.name.replace(/\.[^.]+$/,"")}</span>
          ))}
          {activeDocs.length>(compact?2:4)&&<span style={{ fontFamily:F.body, fontSize:"0.69rem", color:"var(--text-muted)" }}>+{activeDocs.length-(compact?2:4)} more</span>}
        </div>
      )}
      <div ref={scrollRef} style={{ flex:1, overflowY:"auto", padding:compact?"12px":"16px 20px", display:"flex", flexDirection:"column", gap:compact?"10px":"14px" }}>
        {messages.map((m,i)=><SparkMessage key={i} msg={m} compact={compact}/>)}
      </div>
      {messages.filter(m=>m.role==="user").length===0&&(
        <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", padding:compact?"7px 11px":"10px 18px", borderTop:"1px solid var(--border)" }}>
          {quickPrompts.map(s=>(
            <button key={s} onClick={()=>onSend(s)} style={{ fontFamily:F.body, fontSize:compact?"0.68rem":"0.74rem", padding:compact?"4px 9px":"5px 12px", borderRadius:"99px", border:"1px solid var(--border)", background:"var(--bg-secondary)", color:"var(--text-secondary)", cursor:"pointer", transition:"all 0.15s" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="var(--accent)";(e.currentTarget as HTMLButtonElement).style.color="var(--accent)";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="var(--border)";(e.currentTarget as HTMLButtonElement).style.color="var(--text-secondary)";}}
            >{s}</button>
          ))}
        </div>
      )}
      <div style={{ display:"flex", gap:"7px", padding:compact?"8px 11px":"12px 18px", borderTop:"1px solid var(--border)", flexShrink:0, alignItems:"flex-end" }}>
        {/* File attach — uploads to docs */}
        <label title="Attach file to knowledge base" style={{ width:compact?"30px":"36px", height:compact?"30px":"36px", borderRadius:"9px", background:"var(--bg-secondary)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, color:"var(--text-muted)", transition:"all 0.15s" }}
          onMouseEnter={e=>{(e.currentTarget as HTMLLabelElement).style.borderColor="var(--accent)";(e.currentTarget as HTMLLabelElement).style.color="var(--accent)";}}
          onMouseLeave={e=>{(e.currentTarget as HTMLLabelElement).style.borderColor="var(--border)";(e.currentTarget as HTMLLabelElement).style.color="var(--text-muted)";}}>
          <Paperclip size={compact?12:14}/>
          <input type="file" accept="*/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f) onFileUpload(f); }}/>
        </label>
        <textarea value={aiInput} onChange={e=>onInputChange(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();onSend();} }}
          placeholder={activeDocs.length===0?"Upload documents first…":`Ask Spark about ${courseCode}…`}
          rows={compact?1:2}
          style={{ fontFamily:F.body, flex:1, borderRadius:"9px", border:"1px solid var(--border)", background:"var(--input)", padding:compact?"7px 10px":"9px 12px", fontSize:compact?"0.78rem":"0.86rem", outline:"none", color:"var(--text-primary)", resize:"none", lineHeight:1.5 }}
        />
        <button onClick={()=>onSend()} disabled={!aiInput.trim()} style={{ width:compact?"30px":"38px", height:compact?"30px":"38px", borderRadius:"9px", background:"var(--accent)", border:"none", color:"var(--primary-foreground)", display:"flex", alignItems:"center", justifyContent:"center", cursor:aiInput.trim()?"pointer":"not-allowed", flexShrink:0, opacity:aiInput.trim()?1:0.4, transition:"opacity 0.2s" }}>
          <Send size={compact?12:15}/>
        </button>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────
   MAIN COURSE PAGE
───────────────────────────────────────────────────── */
export function CoursePage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Load real course data from localStorage
  const allCourses: Course[] = loadCourses();
  const course               = allCourses.find(c=>c.id===id);
  const courseColor          = course?.color ?? "#66B539";
  const courseCode           = course?.code  ?? `Course ${id}`;
  const courseName           = course?.name  ?? "";

  const [activeTab, setActiveTab]           = useState<TabId>("overview");
  const [helpOpen, setHelpOpen]             = useState(false);
  const [chatOpen, setChatOpen]             = useState(false);
  const [chatMaximized, setChatMaximized]   = useState(false);
  const [sparkAnim, setSparkAnim]           = useState<"idle"|"activating"|"active"|"deactivating">("idle");
  const [expandingToMax, setExpandingToMax] = useState(false);
  const [aiInput, setAiInput]               = useState("");
  const [docs, setDocs]                     = useState<Doc[]>([]);
  const [assignments, setAssignments]       = useState<Assignment[]>([]);
  const [focusMode, setFocusMode]           = useState(false);
  const [bellOpen, setBellOpen]             = useState(false);
  const bellRef                             = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role:"system", text:"Spark — document-grounded AI assistant" },
    { role:"ai",     text:"Hi! I'm Spark. Upload your course documents and I'll help you understand the material, answer questions and prepare for exams — with citations from your own files." },
  ]);

  // Close bell on outside click
  useEffect(()=>{
    function handle(e: MouseEvent) {
      if(bellRef.current&&!bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    if(bellOpen) document.addEventListener("mousedown",handle);
    return ()=>document.removeEventListener("mousedown",handle);
  },[bellOpen]);

  // Spark toggle with animation
  const toggleSpark = () => {
    if(!chatOpen){
      setSparkAnim("activating");
      setTimeout(()=>setSparkAnim("active"),420);
      setChatOpen(true);
      if(chatMaximized) setChatMaximized(false);
    } else {
      setSparkAnim("deactivating");
      setTimeout(()=>setSparkAnim("idle"),300);
      setChatOpen(false);
      setChatMaximized(false);
    }
  };

  // Mini → max with animation
  const handleExpand = () => {
    setExpandingToMax(true);
    setTimeout(()=>{
      setExpandingToMax(false);
      setChatMaximized(true);
    },240);
  };

  const sendAI = (text?: string) => {
    const msg = text ?? aiInput.trim();
    if(!msg) return;
    setAiInput("");
    setMessages(prev=>[...prev,{role:"user",text:msg}]);
    const activeDocs = docs.filter(d=>d.used);
    setTimeout(()=>{
      let reply: ChatMsg;
      if(activeDocs.length===0){
        reply = { role:"ai", text:"I don't have any documents to reference yet. Upload your course materials and I'll give you accurate, cited answers." };
      } else {
        reply = {
          role:"ai",
          text:`Based on your uploaded documents, here's what I found about "${msg}": The course covers this topic in your materials. See the citation below.`,
          citations:[{ docName:activeDocs[0].name, excerpt:`This section relates to your question about "${msg.slice(0,40)}…"` }],
        };
        if(msg.toLowerCase().includes("wikipedia")||msg.toLowerCase().includes("internet")){
          reply.flagged=true;
          reply.flagNote="⚠️ Spark only uses your uploaded documents, not the internet.";
        }
      }
      setMessages(prev=>[...prev,reply]);
    },900);
  };

  // File upload handler (Spark chat or elsewhere) → adds to docs
  const handleFileUpload = (file: File) => {
    const newDoc: Doc = {
      id:Date.now().toString(), name:file.name,
      type:file.name.toLowerCase().includes("syllabus")?"syllabus":"notes",
      size:`${(file.size/1024).toFixed(0)} KB`,
      uploadedAt:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),
      used:true,
    };
    setDocs(prev=>[...prev, newDoc]);
  };

  // Spark button animation style
  const sparkButtonStyle = (): React.CSSProperties => {
    if(sparkAnim==="activating") return { animation:"sparkActivate 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards" };
    if(sparkAnim==="active")     return { filter:"drop-shadow(0 0 16px rgba(246,212,0,0.7))" };
    if(sparkAnim==="deactivating") return { animation:"sparkDeactivate 0.28s ease-out forwards" };
    return { animation:"sparkIdle 3.5s ease-in-out infinite" };
  };

  const renderTab = () => {
    switch(activeTab){
      case "overview":    return <Overview courseCode={courseCode} courseColor={courseColor} docs={docs} assignments={assignments} onUploadSyllabus={handleFileUpload}/>;
      case "assignments": return <AssignmentsTab assignments={assignments} setAssignments={setAssignments} courseColor={courseColor}/>;
      case "grades":      return <GradesTab assignments={assignments} courseColor={courseColor}/>;
      case "docs":        return <DocsTab docs={docs} onDocsChange={setDocs}/>;
      case "reminders":   return <Reminders courseCode={courseCode}/>;
      case "activities":  return <ActivitiesTab courseCode={courseCode} docs={docs} onFocusMode={()=>setFocusMode(true)}/>;
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", width:"100%", background:"var(--bg-primary)", color:"var(--foreground)", fontFamily:F.body, overflow:"hidden" }}>

      {/* ══ TOP NAV ══ */}
      <header style={{ height:"82px", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 28px", background:"var(--bg-surface)", borderBottom:"1px solid var(--border)", flexShrink:0, boxShadow:"0 1px 14px rgba(0,0,0,0.06)", zIndex:20 }}>
        {/* Left: logo + name + breadcrumb */}
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <img src={learnBeamLogo} alt="LearnBeam" style={{ height:"64px", width:"64px", objectFit:"contain", filter:"drop-shadow(0 4px 14px rgba(0,0,0,0.16))", cursor:"pointer" }} onClick={()=>navigate("/dashboard")}/>
          <span style={{ fontFamily:F.heading, fontWeight:800, fontSize:"1.25rem", color:"var(--text-primary)", letterSpacing:"-0.02em" }}>LearnBeam</span>
          <span style={{ color:"var(--border)", fontSize:"1.1rem" }}>›</span>
          <button onClick={()=>navigate("/dashboard")} style={{ display:"flex", alignItems:"center", gap:"4px", background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontFamily:F.body, fontSize:"0.82rem", padding:"4px 7px", borderRadius:"7px", transition:"all 0.15s" }}
            onMouseEnter={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.color="var(--text-primary)";b.style.background="var(--bg-secondary)";}}
            onMouseLeave={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.color="var(--text-muted)";b.style.background="transparent";}}>
            <ChevronLeft size={13}/> Dashboard
          </button>
          <span style={{ color:"var(--border)" }}>›</span>
          <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
            <div style={{ width:"9px", height:"9px", borderRadius:"50%", background:courseColor, flexShrink:0 }}/>
            <span style={{ fontFamily:F.heading, fontWeight:800, fontSize:"0.96rem", color:"var(--text-primary)", letterSpacing:"-0.01em" }}>{courseCode}</span>
            {courseName&&<span style={{ fontFamily:F.body, fontSize:"0.8rem", color:"var(--text-muted)" }}>— {courseName}</span>}
          </div>
        </div>

        {/* Right: focus + theme + bell + profile */}
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <button onClick={()=>setFocusMode(true)} style={{ display:"flex", alignItems:"center", gap:"6px", background:"transparent", border:"1px solid var(--border)", borderRadius:"8px", padding:"7px 13px", fontFamily:F.body, fontSize:"0.78rem", fontWeight:600, cursor:"pointer", color:"var(--text-secondary)", transition:"all 0.15s" }}
            onMouseEnter={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="var(--accent)";b.style.color="var(--accent)";b.style.background="var(--accent-soft)";}}
            onMouseLeave={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="var(--border)";b.style.color="var(--text-secondary)";b.style.background="transparent";}}>
            <Brain size={13}/> Focus Mode
          </button>
          <ThemeSwitcher/>
          {/* Bell */}
          <div style={{ position:"relative" }} ref={bellRef}>
            <button onClick={()=>setBellOpen(v=>!v)} style={{ background:bellOpen?"var(--accent-soft)":"var(--bg-secondary)", border:`1px solid ${bellOpen?"var(--accent)":"var(--border)"}`, borderRadius:"50%", width:"38px", height:"38px", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:bellOpen?"var(--accent)":"var(--text-secondary)", transition:"all 0.2s", position:"relative" }}>
              <Bell size={15}/>
              <span style={{ position:"absolute", top:"8px", right:"8px", width:"7px", height:"7px", borderRadius:"50%", background:"#ef4444", border:"2px solid var(--bg-surface)" }}/>
            </button>
            {bellOpen&&<CourseRemindersPanel courseCode={courseCode} courseColor={courseColor} onClose={()=>setBellOpen(false)}/>}
          </div>
          <button onClick={()=>navigate("/profile")} style={{ width:"36px", height:"36px", borderRadius:"50%", background:"var(--accent)", color:"var(--primary-foreground)", display:"flex", alignItems:"center", justifyContent:"center", border:"none", cursor:"pointer", boxShadow:"0 2px 8px var(--accent-glow)", transition:"transform 0.15s" }}
            onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.transform="scale(1.08)"}
            onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.transform="scale(1)"}>
            <User size={14}/>
          </button>
        </div>
      </header>

      {/* ══ TAB BAR ══ */}
      <div style={{ display:"flex", alignItems:"stretch", padding:"0 28px", background:"var(--bg-surface)", borderBottom:"1px solid var(--border)", overflowX:"auto", flexShrink:0, zIndex:10 }}>
        {TABS.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"12px 14px", background:"none", border:"none", borderBottom:activeTab===tab.id?`2.5px solid ${courseColor}`:"2.5px solid transparent", color:activeTab===tab.id?"var(--text-primary)":"var(--text-muted)", fontFamily:F.heading, fontWeight:activeTab===tab.id?700:500, fontSize:"0.81rem", cursor:"pointer", whiteSpace:"nowrap", transition:"color 0.15s", marginBottom:"-1px" }}>
            <span style={{ color:activeTab===tab.id?courseColor:"var(--text-muted)", display:"flex", alignItems:"center" }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ BODY: content + spark side by side ══ */}
      <div style={{ display:"flex", flex:1, overflow:"hidden", minHeight:0 }}>
        <main style={{ flex:1, overflowY:"auto", padding:"26px 30px 200px", minWidth:0 }}>
          <div style={{ maxWidth:"860px", margin:"0 auto" }}>
            {renderTab()}
          </div>
        </main>

        {/* Maximized Spark panel as flex sibling */}
        {chatOpen && chatMaximized && (
          <aside style={{ width:"50%", flexShrink:0, borderLeft:"1px solid var(--border)", display:"flex", flexDirection:"column", background:"var(--bg-surface)", animation:"maxPanelIn 0.3s cubic-bezier(0.22,1,0.36,1)", overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderBottom:"1px solid var(--border)", background:"var(--section-bg)", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <SparkLogo size={34}/>
                <div>
                  <div style={{ fontFamily:F.heading, fontSize:"1rem", fontWeight:800, color:"var(--text-primary)" }}>Spark</div>
                  <div style={{ fontFamily:F.body, fontSize:"0.7rem", color:"var(--text-muted)" }}>Answers from your {courseCode} documents only</div>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <button onClick={()=>setChatMaximized(false)} style={{ display:"flex", alignItems:"center", gap:"5px", background:"var(--bg-secondary)", border:"1px solid var(--border)", borderRadius:"8px", padding:"5px 10px", cursor:"pointer", color:"var(--text-muted)", fontFamily:F.body, fontSize:"0.76rem" }}>
                  <Minimize2 size={13}/> Minimise
                </button>
                <button onClick={()=>{setChatOpen(false);setChatMaximized(false);setSparkAnim("idle");}} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", padding:0, display:"flex" }}><X size={16}/></button>
              </div>
            </div>
            <SparkChat courseCode={courseCode} docs={docs} messages={messages} aiInput={aiInput} onInputChange={setAiInput} onSend={sendAI} onFileUpload={handleFileUpload}/>
          </aside>
        )}
      </div>

      {/* ══ MINI CHAT ══ */}
      {chatOpen && !chatMaximized && (
        <div style={{ position:"fixed", bottom:"166px", left:"50%", transform:"translateX(-50%)", zIndex:100, width:"360px", background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"18px", boxShadow:"0 20px 55px rgba(0,0,0,0.16)", display:"flex", flexDirection:"column", overflow:"hidden", maxHeight:"420px", animation:expandingToMax?"miniToMax 0.24s ease-in forwards":"miniChatIn 0.28s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 15px", borderBottom:"1px solid var(--border)", background:"var(--section-bg)", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <SparkLogo size={22}/>
              <div>
                <div style={{ fontFamily:F.heading, fontSize:"0.86rem", fontWeight:800, color:"var(--text-primary)" }}>Spark</div>
                <div style={{ fontFamily:F.body, fontSize:"0.63rem", color:"var(--text-muted)" }}>Document-grounded · {courseCode}</div>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <button onClick={handleExpand} style={{ display:"flex", alignItems:"center", gap:"4px", background:"var(--bg-secondary)", border:"1px solid var(--border)", borderRadius:"7px", padding:"4px 9px", cursor:"pointer", color:"var(--text-muted)", fontFamily:F.body, fontSize:"0.71rem", transition:"all 0.15s" }}
                onMouseEnter={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="var(--accent)";b.style.color="var(--accent)";}}
                onMouseLeave={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="var(--border)";b.style.color="var(--text-muted)";}}>
                <Maximize2 size={12}/> Expand
              </button>
              <button onClick={()=>{setChatOpen(false);setSparkAnim("deactivating");setTimeout(()=>setSparkAnim("idle"),300);}} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", padding:0, display:"flex" }}><X size={13}/></button>
            </div>
          </div>
          <SparkChat courseCode={courseCode} docs={docs} messages={messages} aiInput={aiInput} onInputChange={setAiInput} onSend={sendAI} compact onFileUpload={handleFileUpload}/>
        </div>
      )}

      {/* ══ SPARK LOGO BUTTON ══ */}
      <div style={{ position:"fixed", bottom:"18px", left:"50%", transform:"translateX(-50%)", zIndex:100 }}>
        <button
          onClick={toggleSpark}
          title="Ask Spark"
          style={{
            background:"none", border:"none", cursor:"pointer", padding:0,
            display:"flex", alignItems:"center", justifyContent:"center",
            ...sparkButtonStyle(),
          }}
          onMouseEnter={e=>{ if(sparkAnim==="idle"||sparkAnim==="active")(e.currentTarget as HTMLButtonElement).style.transform="scale(1.07)"; }}
          onMouseLeave={e=>{ if(sparkAnim!=="activating"&&sparkAnim!=="deactivating")(e.currentTarget as HTMLButtonElement).style.transform="scale(1)"; }}
        >
          <SparkLogo size={148}/>
        </button>
      </div>

      {/* ══ HELP ? ══ */}
      <div style={{ position:"fixed", bottom:"22px", right:"22px", zIndex:110, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"10px" }}>
        {helpOpen&&<HelpPanel tab={activeTab} onClose={()=>setHelpOpen(false)}/>}
        <button onClick={()=>setHelpOpen(v=>!v)} style={{ width:"44px", height:"44px", borderRadius:"50%", background:helpOpen?"var(--accent)":"var(--bg-surface)", border:`1.5px solid ${helpOpen?"var(--accent)":"var(--border)"}`, boxShadow:"0 4px 18px rgba(0,0,0,0.12)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.2s", color:helpOpen?"var(--primary-foreground)":"var(--text-secondary)" }}
          onMouseEnter={e=>{ if(!helpOpen){const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="var(--accent)";b.style.color="var(--accent)";}}}
          onMouseLeave={e=>{ if(!helpOpen){const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="var(--border)";b.style.color="var(--text-secondary)";}}}
        >
          <HelpCircle size={19}/>
        </button>
      </div>

      {/* ══ FOCUS MODE ══ */}
      {focusMode&&<FocusMode courseCode={courseCode} courseName={courseName} onExit={()=>setFocusMode(false)}/>}

      <style>{`
        @keyframes sparkIdle {
          0%,100% { filter:drop-shadow(0 4px 14px rgba(0,0,0,0.18)) drop-shadow(0 0 0px rgba(246,212,0,0)); transform:translateY(0) scale(1); }
          50%      { filter:drop-shadow(0 6px 20px rgba(0,0,0,0.14)) drop-shadow(0 0 18px rgba(246,212,0,0.22)); transform:translateY(-5px) scale(1.02); }
        }
        @keyframes sparkActivate {
          0%   { transform:scale(1); filter:drop-shadow(0 4px 14px rgba(0,0,0,0.2)); }
          28%  { transform:scale(1.22) translateY(-4px); filter:drop-shadow(0 0 34px rgba(246,212,0,0.95)) drop-shadow(0 0 12px rgba(246,212,0,0.6)); }
          58%  { transform:scale(0.94); filter:drop-shadow(0 0 18px rgba(246,212,0,0.55)); }
          80%  { transform:scale(1.06); filter:drop-shadow(0 0 20px rgba(246,212,0,0.65)); }
          100% { transform:scale(1); filter:drop-shadow(0 0 16px rgba(246,212,0,0.65)); }
        }
        @keyframes sparkDeactivate {
          0%   { transform:scale(1); filter:drop-shadow(0 0 16px rgba(246,212,0,0.65)); }
          35%  { transform:scale(0.87); filter:drop-shadow(0 0 6px rgba(246,212,0,0.2)); }
          70%  { transform:scale(1.04); filter:drop-shadow(0 4px 14px rgba(0,0,0,0.18)); }
          100% { transform:scale(1); filter:drop-shadow(0 4px 14px rgba(0,0,0,0.18)); }
        }
        @keyframes miniChatIn  { from{opacity:0;transform:translateX(-50%) translateY(18px) scale(0.95)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
        @keyframes miniToMax   { 0%{opacity:1;transform:translateX(-50%) scale(1) translateY(0)} 50%{opacity:0.5;transform:translateX(20%) scale(1.06) translateY(-12px)} 100%{opacity:0;transform:translateX(80%) scale(0.7) translateY(-24px)} }
        @keyframes maxPanelIn  { from{opacity:0;transform:translateX(50px)} to{opacity:1;transform:translateX(0)} }
        @keyframes panelIn     { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
