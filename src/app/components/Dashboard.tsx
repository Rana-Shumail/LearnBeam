import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Bell, Plus, X, Lightbulb, BookOpen, ChevronRight,
  GraduationCap, Sparkles, FileUp, User, CheckCircle2, Zap,
  HelpCircle, Brain, BookOpenCheck, ChevronDown, ChevronUp,
} from "lucide-react";
import learnBeamLogo from "../../assets/861bd4bcf410ca26cefb8d6a2c416c8933fab508.png";
import { ThemeSwitcher } from "./ThemeSwitcher";

const F = {
  heading: "'Nunito', 'Trebuchet MS', system-ui, sans-serif",
  body:    "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif",
};

export type Course = {
  id: string; code: string; name: string;
  grade: string; progress: number; nextDue: string; color: string;
};

const COURSE_COLORS = ["#66B539","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#06b6d4"];

export function loadCourses(): Course[] {
  try { return JSON.parse(localStorage.getItem("lb-courses") || "[]"); }
  catch { return []; }
}
export function saveCourses(courses: Course[]) {
  localStorage.setItem("lb-courses", JSON.stringify(courses));
}

/* ─────────────────────────────────────────────────────
   ADD COURSE MODAL
───────────────────────────────────────────────────── */
type ModalStep = "course" | "syllabus" | "done";

function AddCourseModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (c: Omit<Course, "id"|"grade"|"progress"|"nextDue">) => void;
}) {
  const [step, setStep]         = useState<ModalStep>("course");
  const [code, setCode]         = useState("");
  const [name, setName]         = useState("");
  const [file, setFile]         = useState<File|null>(null);
  const [scanning, setScanning] = useState(false);
  const colorIdx                = useRef(Math.floor(Math.random() * COURSE_COLORS.length)).current;

  const finalize = () => {
    onAdd({ code: code.trim(), name: name.trim(), color: COURSE_COLORS[colorIdx] });
    setStep("done");
    setTimeout(onClose, 2400);
  };

  const handleSyllabusSubmit = () => {
    if (!file) { finalize(); return; }
    setScanning(true);
    setTimeout(() => { setScanning(false); finalize(); }, 1800);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    padding: "12px 15px", borderRadius: "11px",
    border: "1.5px solid var(--border)",
    background: "var(--input)", color: "var(--text-primary)",
    fontFamily: F.body, fontSize: "0.9rem", outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };

  return (
    <div
      style={{
        position:"fixed", inset:0, zIndex:200,
        background:"rgba(0,0,0,0.52)", backdropFilter:"blur(9px)",
        display:"flex", alignItems:"center", justifyContent:"center", padding:"20px",
      }}
      onClick={e => e.target===e.currentTarget && onClose()}
    >
      <div style={{
        background:"var(--bg-surface)", border:"1px solid var(--border)",
        borderRadius:"22px", width:"100%", maxWidth:"420px",
        boxShadow:"0 36px 90px rgba(0,0,0,0.24)", overflow:"hidden",
        animation:"modalIn 0.28s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        {/* Header */}
        <div style={{
          padding:"20px 24px 16px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background:"var(--section-bg)",
        }}>
          <div>
            {step !== "done" && (
              <p style={{fontFamily:F.body, fontSize:"0.68rem", textTransform:"uppercase", letterSpacing:"0.09em", color:"var(--text-muted)", margin:"0 0 3px"}}>
                Step {step==="course"?"1":"2"} of 2
              </p>
            )}
            <h3 style={{fontFamily:F.heading, fontWeight:800, fontSize:"1.1rem", color:"var(--text-primary)", margin:0}}>
              {step==="course" ? "Add a Course" : step==="syllabus" ? "Attach a Syllabus" : "Course Added!"}
            </h3>
          </div>
          <button onClick={onClose} style={{background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", padding:"4px", display:"flex", borderRadius:"7px"}}>
            <X size={18}/>
          </button>
        </div>

        <div style={{padding:"24px"}}>

          {/* ── STEP 1: COURSE CODE + NAME ── */}
          {step==="course" && (
            <div style={{display:"flex", flexDirection:"column", gap:"16px"}}>
              <div>
                <label style={{fontFamily:F.body, fontSize:"0.8rem", fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:"7px"}}>
                  Course Code <span style={{color:"var(--accent)"}}>*</span>
                </label>
                <input
                  value={code}
                  onChange={e=>setCode(e.target.value)}
                  placeholder="e.g. CSCE3600"
                  style={inputStyle}
                  onFocus={e=>{(e.target as HTMLInputElement).style.borderColor="var(--accent)";(e.target as HTMLInputElement).style.boxShadow="0 0 0 3px var(--accent-soft)";}}
                  onBlur={e=>{(e.target as HTMLInputElement).style.borderColor="var(--border)";(e.target as HTMLInputElement).style.boxShadow="none";}}
                  autoFocus
                />
              </div>
              <div>
                <label style={{fontFamily:F.body, fontSize:"0.8rem", fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:"7px"}}>
                  Course Name{" "}
                  <span style={{fontFamily:F.body, fontSize:"0.72rem", fontWeight:400, color:"var(--text-muted)"}}>(optional)</span>
                </label>
                <input
                  value={name}
                  onChange={e=>setName(e.target.value)}
                  placeholder="e.g. Systems Programming"
                  style={inputStyle}
                  onFocus={e=>{(e.target as HTMLInputElement).style.borderColor="var(--accent)";(e.target as HTMLInputElement).style.boxShadow="0 0 0 3px var(--accent-soft)";}}
                  onBlur={e=>{(e.target as HTMLInputElement).style.borderColor="var(--border)";(e.target as HTMLInputElement).style.boxShadow="none";}}
                  onKeyDown={e=>{ if(e.key==="Enter" && code.trim()) setStep("syllabus"); }}
                />
              </div>
              <button
                onClick={()=>{ if(code.trim()) setStep("syllabus"); }}
                disabled={!code.trim()}
                style={{
                  background:"var(--accent)", color:"var(--primary-foreground)", border:"none",
                  borderRadius:"11px", padding:"13px", fontFamily:F.heading, fontWeight:700, fontSize:"0.92rem",
                  cursor:code.trim()?"pointer":"not-allowed", opacity:code.trim()?1:0.42,
                  transition:"opacity 0.2s, transform 0.12s, box-shadow 0.2s",
                  boxShadow:code.trim()?"0 4px 16px var(--accent-glow)":"none",
                }}
                onMouseEnter={e=>{ if(code.trim()){ (e.currentTarget as HTMLButtonElement).style.transform="translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow="0 8px 22px var(--accent-glow)"; }}}
                onMouseLeave={e=>{ (e.currentTarget as HTMLButtonElement).style.transform="translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow=code.trim()?"0 4px 16px var(--accent-glow)":"none"; }}
              >
                Next →
              </button>
            </div>
          )}

          {/* ── STEP 2: SYLLABUS (optional, skippable) ── */}
          {step==="syllabus" && (
            <div style={{display:"flex", flexDirection:"column", gap:"16px"}}>
              <p style={{fontFamily:F.body, fontSize:"0.84rem", color:"var(--text-secondary)", margin:0, lineHeight:1.6}}>
                Upload your syllabus — LearnBeam will extract assignments, deadlines and set up reminders automatically.
              </p>
              <label style={{
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                gap:"10px", padding:"28px 20px",
                border:`2px dashed ${file?"var(--accent)":"var(--border)"}`,
                borderRadius:"13px", cursor:"pointer",
                background:file?"var(--accent-soft)":"var(--bg-secondary)",
                transition:"all 0.2s",
              }}>
                <FileUp size={26} style={{color:file?"var(--accent)":"var(--text-muted)"}}/>
                <div style={{textAlign:"center"}}>
                  <div style={{fontFamily:F.body, fontSize:"0.84rem", color:file?"var(--accent)":"var(--text-primary)", fontWeight:600}}>
                    {file ? `✓ ${file.name}` : "Upload Syllabus"}
                  </div>
                  {!file && (
                    <div style={{fontFamily:F.body, fontSize:"0.72rem", color:"var(--text-muted)", marginTop:"3px"}}>PDF, DOCX, TXT — any format</div>
                  )}
                </div>
                <input type="file" accept="*/*" onChange={e=>setFile(e.target.files?.[0]??null)} style={{display:"none"}}/>
              </label>
              <div style={{display:"flex", gap:"9px"}}>
                <button
                  onClick={finalize}
                  style={{
                    flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
                    background:"transparent", color:"var(--text-muted)", border:"1.5px solid var(--border)",
                    borderRadius:"11px", padding:"12px", fontFamily:F.body, fontWeight:600, fontSize:"0.84rem",
                    cursor:"pointer", transition:"all 0.15s",
                  }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="var(--accent)";(e.currentTarget as HTMLButtonElement).style.color="var(--accent)";}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="var(--border)";(e.currentTarget as HTMLButtonElement).style.color="var(--text-muted)";}}
                >
                  Skip for now
                </button>
                <button
                  onClick={handleSyllabusSubmit}
                  disabled={!file||scanning}
                  style={{
                    flex:2, background:"var(--accent)", color:"var(--primary-foreground)", border:"none",
                    borderRadius:"11px", padding:"12px", fontFamily:F.heading, fontWeight:700, fontSize:"0.9rem",
                    cursor:file&&!scanning?"pointer":"not-allowed", opacity:file&&!scanning?1:0.5, transition:"opacity 0.2s",
                  }}
                >
                  {scanning ? "⚡ Scanning…" : "Upload & Continue"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: SUCCESS ── */}
          {step==="done" && (
            <div style={{textAlign:"center", padding:"20px 0 8px"}}>
              <div style={{
                width:"68px", height:"68px", borderRadius:"50%",
                background:"linear-gradient(135deg, var(--accent), var(--accent-hover))",
                display:"flex", alignItems:"center", justifyContent:"center",
                margin:"0 auto 18px",
                boxShadow:"0 8px 24px var(--accent-glow)",
              }}>
                <CheckCircle2 size={32} style={{color:"var(--primary-foreground)"}}/>
              </div>
              <p style={{fontFamily:F.heading, fontWeight:900, fontSize:"1.2rem", color:"var(--text-primary)", margin:"0 0 7px", letterSpacing:"-0.02em"}}>
                {code.trim()} is live!
              </p>
              <p style={{fontFamily:F.body, fontSize:"0.85rem", color:"var(--text-secondary)", margin:"0 0 5px"}}>
                {name.trim() ? `"${name.trim()}" has been added to your dashboard.` : "Your course has been added to your dashboard."}
              </p>
              <p style={{fontFamily:F.body, fontSize:"0.76rem", color:"var(--text-muted)", margin:0, fontStyle:"italic"}}>
                You can add documents, notes and more inside the course.
              </p>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.92) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   REMINDERS PANEL (bell dropdown)
───────────────────────────────────────────────────── */
function RemindersPanel({ courses, onClose }: { courses: Course[]; onClose: () => void }) {
  const reminders = courses.flatMap(c => [
    { course: c.code, label: "Assignment 1", due: "Tomorrow", color: c.color, urgent: true },
    { course: c.code, label: "Quiz 2",       due: "In 3 days", color: c.color, urgent: false },
  ]).slice(0, 7);

  return (
    <div style={{
      position:"absolute", top:"calc(100% + 10px)", right:0, zIndex:200,
      width:"320px", background:"var(--bg-surface)", border:"1px solid var(--border)",
      borderRadius:"16px", boxShadow:"0 24px 60px rgba(0,0,0,0.18)",
      overflow:"hidden", animation:"panelIn 0.2s ease",
    }}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1px solid var(--border)", background:"var(--section-bg)"}}>
        <div style={{display:"flex", alignItems:"center", gap:"8px"}}>
          <Bell size={14} style={{color:"var(--accent)"}}/>
          <span style={{fontFamily:F.heading, fontWeight:800, fontSize:"0.88rem", color:"var(--text-primary)"}}>Upcoming</span>
        </div>
        <button onClick={onClose} style={{background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", padding:0, display:"flex"}}><X size={14}/></button>
      </div>
      {reminders.length === 0 ? (
        <div style={{padding:"32px 20px", textAlign:"center"}}>
          <Bell size={28} style={{color:"var(--text-muted)", marginBottom:"10px"}}/>
          <p style={{fontFamily:F.heading, fontWeight:700, fontSize:"0.88rem", color:"var(--text-primary)", margin:"0 0 4px"}}>All caught up!</p>
          <p style={{fontFamily:F.body, fontSize:"0.78rem", color:"var(--text-muted)", margin:0}}>No upcoming deadlines right now.</p>
        </div>
      ) : (
        <div style={{maxHeight:"340px", overflowY:"auto"}}>
          {reminders.map((r,i)=>(
            <div key={i} style={{display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderTop:i!==0?"1px solid var(--border)":undefined}}>
              <div style={{width:"8px", height:"8px", borderRadius:"50%", background:r.urgent?"#ef4444":r.color, flexShrink:0}}/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontFamily:F.heading, fontWeight:700, fontSize:"0.84rem", color:"var(--text-primary)"}}>{r.label}</div>
                <div style={{fontFamily:F.body, fontSize:"0.72rem", color:"var(--text-muted)"}}>{r.course} · {r.due}</div>
              </div>
              {r.urgent && (
                <span style={{fontFamily:F.body, fontSize:"0.67rem", padding:"2px 8px", borderRadius:"99px", background:"rgba(239,68,68,0.12)", color:"#ef4444", fontWeight:600, flexShrink:0}}>Soon</span>
              )}
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes panelIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   DASHBOARD HELP PANEL
───────────────────────────────────────────────────── */
const DASH_HELP = [
  {
    icon:<Brain size={14}/>,
    title:"What is Spark?",
    body:"Spark is LearnBeam's AI assistant. Upload your course documents and Spark will answer questions, generate quizzes, and summarize material — using only your own files.",
  },
  {
    icon:<GraduationCap size={14}/>,
    title:"Adding Courses",
    body:"Click '+ Add Course' to enrol. Course code is required; name is optional. You can upload a syllabus to auto-generate assignments and reminders.",
  },
  {
    icon:<Sparkles size={14}/>,
    title:"LearnBeam Suggestions",
    body:"AI-powered study tips that update as you learn. Once you connect your course materials, suggestions become personalized to your actual content.",
  },
  {
    icon:<Bell size={14}/>,
    title:"Reminders",
    body:"The bell icon shows upcoming deadlines across all your courses. Individual course reminders live inside each course page.",
  },
  {
    icon:<BookOpenCheck size={14}/>,
    title:"LearnBeam Activities",
    body:"Inside each course you'll find Quiz Me, Smart Notes, and Focus Mode — AI activities built from your uploaded documents to help you study smarter.",
  },
];

function DashHelpPanel({ onClose }: { onClose: ()=>void }) {
  const [open, setOpen] = useState<number|null>(0);
  return (
    <div style={{
      position:"fixed", bottom:"80px", right:"22px", zIndex:100,
      width:"320px", maxHeight:"500px",
      background:"var(--bg-surface)", border:"1px solid var(--border)",
      borderRadius:"18px", boxShadow:"0 24px 60px rgba(0,0,0,0.15)",
      display:"flex", flexDirection:"column", overflow:"hidden",
      animation:"panelIn 0.22s ease",
    }}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1px solid var(--border)", background:"var(--section-bg)", flexShrink:0}}>
        <div style={{display:"flex", alignItems:"center", gap:"8px"}}>
          <div style={{width:"28px", height:"28px", borderRadius:"8px", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center"}}>
            <HelpCircle size={14} style={{color:"var(--primary-foreground)"}}/>
          </div>
          <div>
            <div style={{fontFamily:F.heading, fontSize:"0.88rem", fontWeight:800, color:"var(--text-primary)"}}>How LearnBeam works</div>
            <div style={{fontFamily:F.body, fontSize:"0.63rem", color:"var(--text-muted)"}}>Quick guide</div>
          </div>
        </div>
        <button onClick={onClose} style={{background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", padding:0, display:"flex"}}><X size={14}/></button>
      </div>
      <div style={{overflowY:"auto", flex:1}}>
        {DASH_HELP.map((s,i)=>(
          <div key={i} style={{borderBottom:"1px solid var(--border)"}}>
            <button
              onClick={()=>setOpen(open===i?null:i)}
              style={{width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:"none", border:"none", cursor:"pointer", textAlign:"left", gap:"10px"}}
            >
              <div style={{display:"flex", alignItems:"center", gap:"9px", minWidth:0}}>
                <span style={{color:"var(--accent)", flexShrink:0}}>{s.icon}</span>
                <span style={{fontFamily:F.heading, fontSize:"0.84rem", fontWeight:700, color:"var(--text-primary)"}}>{s.title}</span>
              </div>
              <span style={{color:"var(--text-muted)", flexShrink:0}}>{open===i?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</span>
            </button>
            {open===i && (
              <div style={{padding:"0 16px 14px 39px"}}>
                <p style={{fontFamily:F.body, fontSize:"0.82rem", color:"var(--text-secondary)", margin:0, lineHeight:1.7}}>{s.body}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{padding:"11px 16px", borderTop:"1px solid var(--border)", background:"var(--accent-soft)", flexShrink:0}}>
        <p style={{fontFamily:F.body, fontSize:"0.74rem", color:"var(--accent)", margin:0, fontWeight:600}}>
          💡 Spark gets smarter the more documents you upload.
        </p>
      </div>
      <style>{`@keyframes panelIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────────────── */
export function Dashboard() {
  const [courses, setCourses]   = useState<Course[]>(loadCourses);
  const [showModal, setShowModal] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate                = useNavigate();
  const bellRef                 = useRef<HTMLDivElement>(null);

  // Close bell on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    if (bellOpen) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [bellOpen]);

  const handleAddCourse = (data: Omit<Course,"id"|"grade"|"progress"|"nextDue">) => {
    const updated = [...courses, { ...data, id: Date.now().toString(), grade:"—", progress:0, nextDue:"—" }];
    setCourses(updated);
    saveCourses(updated);
  };

  // Date display
  const now     = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday:"long" });
  const dateStr = now.toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });

  return (
    <div style={{display:"flex", flexDirection:"column", minHeight:"100vh", width:"100%", background:"var(--bg-primary)", color:"var(--foreground)", fontFamily:F.body}}>

      {/* ══ TOP NAV ══ */}
      <header style={{
        height:"82px", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 32px", background:"var(--bg-surface)", borderBottom:"1px solid var(--border)",
        position:"sticky", top:0, zIndex:20, flexShrink:0,
        boxShadow:"0 1px 14px rgba(0,0,0,0.06)",
      }}>
        {/* Left: logo + name */}
        <div style={{display:"flex", alignItems:"center", gap:"11px"}}>
          <img
            src={learnBeamLogo}
            alt="LearnBeam"
            style={{
              height:"64px", width:"64px", objectFit:"contain",
              filter:"drop-shadow(0 4px 14px rgba(0,0,0,0.16))",
            }}
          />
          <span style={{fontFamily:F.heading, fontWeight:800, fontSize:"1.25rem", color:"var(--text-primary)", letterSpacing:"-0.02em"}}>LearnBeam</span>
        </div>

        {/* Right: theme + bell + profile */}
        <div style={{display:"flex", alignItems:"center", gap:"10px"}}>
          <ThemeSwitcher/>

          {/* Bell with dropdown */}
          <div style={{position:"relative"}} ref={bellRef}>
            <button
              onClick={()=>setBellOpen(v=>!v)}
              style={{
                background:bellOpen?"var(--accent-soft)":"var(--bg-secondary)",
                border:`1px solid ${bellOpen?"var(--accent)":"var(--border)"}`,
                borderRadius:"50%", width:"38px", height:"38px",
                display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"pointer", color:bellOpen?"var(--accent)":"var(--text-secondary)",
                transition:"all 0.2s", position:"relative",
              }}
            >
              <Bell size={15}/>
              {courses.length > 0 && !bellOpen && (
                <span style={{
                  position:"absolute", top:"8px", right:"8px",
                  width:"7px", height:"7px", borderRadius:"50%",
                  background:"#ef4444", border:"2px solid var(--bg-surface)",
                }}/>
              )}
            </button>
            {bellOpen && <RemindersPanel courses={courses} onClose={()=>setBellOpen(false)}/>}
          </div>

          {/* Profile avatar → Profile page */}
          <button
            onClick={()=>navigate("/profile")}
            style={{
              width:"38px", height:"38px", borderRadius:"50%",
              background:"var(--accent)", color:"var(--primary-foreground)",
              display:"flex", alignItems:"center", justifyContent:"center",
              border:"none", cursor:"pointer",
              boxShadow:"0 2px 10px var(--accent-glow)",
              transition:"transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform="scale(1.08)";(e.currentTarget as HTMLButtonElement).style.boxShadow="0 4px 16px var(--accent-glow)";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform="scale(1)";(e.currentTarget as HTMLButtonElement).style.boxShadow="0 2px 10px var(--accent-glow)";}}
            title="Profile"
          >
            <User size={16}/>
          </button>
        </div>
      </header>

      {/* ══ MAIN ══ */}
      <main style={{flex:1, padding:"38px 40px 120px", maxWidth:"980px", width:"100%", margin:"0 auto", boxSizing:"border-box"}}>

        {/* ── HERO STRIP ── */}
        <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:"40px", flexWrap:"wrap", gap:"12px"}}>
          <div>
            <p style={{fontFamily:F.body, fontSize:"0.76rem", color:"var(--text-muted)", margin:"0 0 5px", letterSpacing:"0.05em", textTransform:"uppercase"}}>
              {dayName}, {dateStr}
            </p>
            <h1 style={{
              fontFamily:F.heading, fontSize:"2.1rem", fontWeight:900,
              color:"var(--text-primary)", margin:"0 0 7px",
              letterSpacing:"-0.03em", lineHeight:1.1,
            }}>
              Your AI study companion.
            </h1>
            <p style={{fontFamily:F.body, fontSize:"0.88rem", color:"var(--text-muted)", margin:0}}>
              {courses.length === 0
                ? "Add a course and let Spark analyze your materials to accelerate your learning."
                : `${courses.length} course${courses.length>1?"s":""} active · Upload your materials and ask Spark anything.`}
            </p>
          </div>
          {courses.length > 0 && (
            <div style={{
              padding:"14px 22px", background:"var(--bg-surface)",
              border:"1px solid var(--border)", borderRadius:"14px",
              textAlign:"center",
            }}>
              <div style={{fontFamily:F.heading, fontWeight:900, fontSize:"1.7rem", color:"var(--accent)", lineHeight:1}}>{courses.length}</div>
              <div style={{fontFamily:F.body, fontSize:"0.7rem", color:"var(--text-muted)", marginTop:"3px"}}>Course{courses.length>1?"s":""}</div>
            </div>
          )}
        </div>

        {/* ── MY COURSES ── */}
        <section style={{marginBottom:"44px"}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px"}}>
            <div>
              <h2 style={{
                fontFamily:F.heading, fontWeight:900, fontSize:"1.5rem",
                margin:"0 0 3px", letterSpacing:"-0.025em",
                background:"linear-gradient(130deg, var(--text-primary) 30%, var(--accent) 100%)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                backgroundClip:"text",
              }}>
                My Courses
              </h2>
              <p style={{fontFamily:F.body, fontSize:"0.76rem", color:"var(--text-muted)", margin:0}}>
                {courses.length === 0 ? "No courses added yet" : `${courses.length} enrolled`}
              </p>
            </div>
            <button
              onClick={()=>setShowModal(true)}
              style={{
                display:"flex", alignItems:"center", gap:"6px",
                background:"var(--accent)", color:"var(--primary-foreground)",
                border:"none", borderRadius:"10px", padding:"10px 20px",
                fontFamily:F.heading, fontWeight:700, fontSize:"0.83rem",
                cursor:"pointer", boxShadow:"0 4px 14px var(--accent-glow)",
                transition:"transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform="translateY(-1px)";(e.currentTarget as HTMLButtonElement).style.boxShadow="0 7px 22px var(--accent-glow)";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform="translateY(0)";(e.currentTarget as HTMLButtonElement).style.boxShadow="0 4px 14px var(--accent-glow)";}}
            >
              <Plus size={14}/> Add Course
            </button>
          </div>

          {courses.length === 0 ? (
            <div
              onClick={()=>setShowModal(true)}
              style={{
                border:"2px dashed var(--border)", borderRadius:"18px",
                padding:"56px 24px", textAlign:"center", cursor:"pointer",
                transition:"border-color 0.2s, background 0.2s",
              }}
              onMouseEnter={e=>{const el=e.currentTarget as HTMLDivElement;el.style.borderColor="var(--accent)";el.style.background="var(--accent-soft)";}}
              onMouseLeave={e=>{const el=e.currentTarget as HTMLDivElement;el.style.borderColor="var(--border)";el.style.background="transparent";}}
            >
              <GraduationCap size={46} style={{color:"var(--text-muted)", marginBottom:"15px"}}/>
              <p style={{fontFamily:F.heading, fontWeight:700, fontSize:"1rem", color:"var(--text-primary)", margin:"0 0 7px"}}>No courses yet</p>
              <p style={{fontFamily:F.body, fontSize:"0.84rem", color:"var(--text-muted)", margin:0}}>Tap "Add Course" to enrol your first course</p>
            </div>
          ) : (
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(265px,1fr))", gap:"15px"}}>
              {courses.map(c=>(
                <div
                  key={c.id}
                  onClick={()=>navigate(`/course/${c.id}`)}
                  style={{
                    background:"var(--bg-surface)", border:"1px solid var(--border)",
                    borderRadius:"16px", padding:"22px", cursor:"pointer",
                    transition:"box-shadow 0.2s, transform 0.18s", position:"relative", overflow:"hidden",
                  }}
                  onMouseEnter={e=>{const el=e.currentTarget as HTMLDivElement;el.style.boxShadow="0 14px 36px rgba(0,0,0,0.12)";el.style.transform="translateY(-3px)";}}
                  onMouseLeave={e=>{const el=e.currentTarget as HTMLDivElement;el.style.boxShadow="none";el.style.transform="translateY(0)";}}
                >
                  <div style={{position:"absolute", top:0, left:0, right:0, height:"3px", background:c.color, borderRadius:"16px 16px 0 0"}}/>
                  <div style={{display:"flex", alignItems:"center", gap:"12px", marginBottom:"18px"}}>
                    <div style={{width:"44px", height:"44px", borderRadius:"12px", background:`${c.color}1a`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                      <GraduationCap size={20} style={{color:c.color}}/>
                    </div>
                    <div style={{minWidth:0}}>
                      <div style={{fontFamily:F.heading, fontSize:"1rem", fontWeight:800, color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{c.code}</div>
                      {c.name && <div style={{fontFamily:F.body, fontSize:"0.73rem", color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{c.name}</div>}
                    </div>
                  </div>
                  <div style={{height:"4px", borderRadius:"99px", background:"var(--bg-secondary)", overflow:"hidden", marginBottom:"13px"}}>
                    <div style={{height:"100%", width:`${c.progress}%`, background:c.color, borderRadius:"99px", transition:"width 0.4s ease"}}/>
                  </div>
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontFamily:F.heading, fontSize:"1.3rem", fontWeight:800, color:c.color, lineHeight:1}}>{c.grade}</div>
                      <div style={{fontFamily:F.body, fontSize:"0.68rem", color:"var(--text-muted)", marginTop:"1px"}}>Grade</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:F.heading, fontSize:"0.94rem", fontWeight:700, color:"var(--text-primary)"}}>{c.progress}%</div>
                      <div style={{fontFamily:F.body, fontSize:"0.68rem", color:"var(--text-muted)"}}>Progress</div>
                    </div>
                    <ChevronRight size={15} style={{color:"var(--text-muted)"}}/>
                  </div>
                </div>
              ))}

              {/* Inline add card */}
              <div
                onClick={()=>setShowModal(true)}
                style={{
                  border:"2px dashed var(--border)", borderRadius:"16px", padding:"22px",
                  cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", gap:"9px", minHeight:"168px",
                  transition:"border-color 0.2s, background 0.2s",
                }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLDivElement;el.style.borderColor="var(--accent)";el.style.background="var(--accent-soft)";}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLDivElement;el.style.borderColor="var(--border)";el.style.background="transparent";}}
              >
                <div style={{width:"40px", height:"40px", borderRadius:"50%", border:"2px dashed var(--accent)", display:"flex", alignItems:"center", justifyContent:"center"}}>
                  <Plus size={18} style={{color:"var(--accent)"}}/>
                </div>
                <span style={{fontFamily:F.heading, fontSize:"0.84rem", fontWeight:700, color:"var(--accent)"}}>Add Course</span>
              </div>
            </div>
          )}
        </section>

        {/* ── LEARNBEAM SUGGESTIONS ── */}
        <section>
          <div style={{display:"flex", alignItems:"center", gap:"9px", marginBottom:"16px"}}>
            <Sparkles size={16} style={{color:"var(--accent)"}}/>
            <h2 style={{fontFamily:F.heading, fontWeight:800, fontSize:"1rem", color:"var(--text-primary)", margin:0}}>LearnBeam Suggestions</h2>
            <span style={{
              fontFamily:F.body, fontSize:"0.67rem", color:"var(--accent)", fontWeight:600,
              padding:"2px 9px", borderRadius:"99px", background:"var(--accent-soft)",
              border:"1px solid var(--border)",
            }}>AI · updates regularly</span>
          </div>
          <div style={{background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"14px", overflow:"hidden"}}>
            {courses.length === 0 ? (
              <div style={{padding:"24px 22px", display:"flex", alignItems:"center", gap:"14px"}}>
                <div style={{width:"38px", height:"38px", borderRadius:"10px", background:"var(--accent-soft)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                  <Sparkles size={17} style={{color:"var(--accent)"}}/>
                </div>
                <p style={{fontFamily:F.body, fontSize:"0.84rem", color:"var(--text-muted)", margin:0, lineHeight:1.6}}>
                  Suggestions will appear here once you add your courses.
                </p>
              </div>
            ) : (
              [
                { icon:<Lightbulb size={14}/>, text:"Review your most recent material before moving on to new topics." },
                { icon:<BookOpen  size={14}/>, text:"Space out your study sessions — consistent short sessions beat marathon cramming." },
                { icon:<Zap       size={14}/>, text:"Practice active recall: quiz yourself instead of re-reading your notes." },
              ].map((s,i)=>(
                <div key={i} style={{display:"flex", alignItems:"flex-start", gap:"13px", padding:"15px 22px", borderTop:i!==0?"1px solid var(--border)":undefined}}>
                  <div style={{width:"28px", height:"28px", borderRadius:"8px", background:"var(--accent-soft)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:"1px", color:"var(--accent)"}}>{s.icon}</div>
                  <p style={{fontFamily:F.body, fontSize:"0.84rem", color:"var(--text-secondary)", margin:0, lineHeight:1.62}}>{s.text}</p>
                </div>
              ))
            )}
          </div>
        </section>

      </main>

      {/* ══ ADD COURSE MODAL ══ */}
      {showModal && <AddCourseModal onClose={()=>setShowModal(false)} onAdd={handleAddCourse}/>}

      {/* ══ HELP ? BUTTON + PANEL ══ */}
      <div style={{position:"fixed", bottom:"22px", right:"22px", zIndex:100, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"10px"}}>
        {helpOpen && <DashHelpPanel onClose={()=>setHelpOpen(false)}/>}
        <button
          onClick={()=>setHelpOpen(v=>!v)}
          title="How LearnBeam works"
          style={{
            width:"46px", height:"46px", borderRadius:"50%",
            background:helpOpen?"var(--accent)":"var(--bg-surface)",
            border:`1.5px solid ${helpOpen?"var(--accent)":"var(--border)"}`,
            boxShadow:"0 4px 18px rgba(0,0,0,0.13)",
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", transition:"all 0.2s",
            color:helpOpen?"var(--primary-foreground)":"var(--text-secondary)",
          }}
          onMouseEnter={e=>{ if(!helpOpen){const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="var(--accent)";b.style.color="var(--accent)";} }}
          onMouseLeave={e=>{ if(!helpOpen){const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="var(--border)";b.style.color="var(--text-secondary)";} }}
        >
          <HelpCircle size={20}/>
        </button>
      </div>

    </div>
  );
}
