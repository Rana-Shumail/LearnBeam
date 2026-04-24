import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Bell, CalendarDays, Plus, X, Lightbulb, BookOpen, ChevronRight,
  GraduationCap, Sparkles, FileUp, User, CheckCircle2, Zap,
  HelpCircle, Brain, BookOpenCheck, ChevronDown, ChevronUp, LogOut,
} from "lucide-react";
import learnBeamLogo from "../../assets/861bd4bcf410ca26cefb8d6a2c416c8933fab508.png";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useIsMobile } from "./ui/use-mobile";
import { signOut, getUser, SUPABASE_CONFIGURED, getAvatarCache, setAvatarCache, subscribeToAvatar, resolvePreferredAvatarUrl, fetchRemoteAvatarPreference } from "../../lib/supabase";
import { fetchCourses, fetchAssignments, fetchDocuments, fetchReminders, insertCourse, updateDocumentTextContent } from "../../lib/db";
import {
  compareDueStrings,
  computeCourseSummary,
  formatDueForTimeline,
  isReminderUrgent,
  loadDashboardSuggestionState,
  loadStoredCourseData,
  mergeCourseReminders,
  patchStoredCourseData,
  saveDashboardSuggestionState,
} from "../../lib/courseData";
import { generateDashboardSuggestions, type SparkSuggestion } from "../../lib/courseAI";
import { importSyllabusIntoCourse } from "../../lib/courseImport";
import { hasReadableDocumentText, hydrateStoredDocumentText } from "../../lib/documentText";

const F = {
  heading: "'Nunito', 'Trebuchet MS', system-ui, sans-serif",
  body:    "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif",
};

export type Course = {
  id: string; code: string; name: string;
  grade: string; progress: number; nextDue: string; color: string;
};

const COURSE_COLORS = ["#66B539","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#06b6d4"];

/** Legacy localStorage helpers — kept for CoursePage lookups by ID */
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

type AddCourseInput = Omit<Course, "id"|"grade"|"progress"|"nextDue"> & {
  syllabusFile?: File | null;
};

type AddCourseProgress = {
  title: string;
  detail: string;
};

function AddCourseModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (course: AddCourseInput, onProgress?: (progress: AddCourseProgress) => void) => Promise<void>;
}) {
  const [step, setStep]         = useState<ModalStep>("course");
  const [code, setCode]         = useState("");
  const [name, setName]         = useState("");
  const [file, setFile]         = useState<File|null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanTitle, setScanTitle] = useState("Preparing course");
  const [scanDetail, setScanDetail] = useState("Setting up the new course before the syllabus is examined.");
  const [error, setError] = useState<string | null>(null);
  const colorIdx                = useRef(Math.floor(Math.random() * COURSE_COLORS.length)).current;

  const finalize = async (syllabusFile?: File | null) => {
    setError(null);
    await onAdd(
      {
        code: code.trim(),
        name: name.trim(),
        color: COURSE_COLORS[colorIdx],
        syllabusFile,
      },
      (progress) => {
        setScanTitle(progress.title);
        setScanDetail(progress.detail);
      },
    );
    setStep("done");
    setTimeout(onClose, 2400);
  };

  const handleSyllabusSubmit = async () => {
    setScanning(true);
    setScanTitle("Preparing course");
    setScanDetail("Creating the course shell before the syllabus is processed.");
    try {
      await finalize(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The course could not be created.";
      setError(message);
      setScanning(false);
    }
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
              {scanning ? (
                <div style={{display:"flex", flexDirection:"column", gap:"14px", padding:"8px 2px"}}>
                  <div style={{width:"58px", height:"58px", borderRadius:"16px", background:"linear-gradient(135deg, var(--accent), var(--accent-hover))", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 10px 30px var(--accent-glow)"}}>
                    <Sparkles size={26} style={{color:"var(--primary-foreground)"}}/>
                  </div>
                  <div>
                    <p style={{fontFamily:F.heading, fontWeight:800, fontSize:"1rem", color:"var(--text-primary)", margin:"0 0 5px"}}>{scanTitle}</p>
                    <p style={{fontFamily:F.body, fontSize:"0.84rem", color:"var(--text-secondary)", margin:0, lineHeight:1.7}}>{scanDetail}</p>
                  </div>
                  <div style={{height:"8px", borderRadius:"99px", background:"var(--bg-secondary)", overflow:"hidden"}}>
                    <div style={{height:"100%", width:"68%", background:"linear-gradient(90deg, var(--accent), var(--accent-hover))", borderRadius:"99px", animation:"syllabusScan 1.2s ease-in-out infinite"}}/>
                  </div>
                  <p style={{fontFamily:F.body, fontSize:"0.75rem", color:"var(--text-muted)", margin:0}}>
                    Spark is reading the syllabus and filling the course for you.
                  </p>
                  <style>{`@keyframes syllabusScan{0%{transform:translateX(-35%)}50%{transform:translateX(20%)}100%{transform:translateX(70%)}}`}</style>
                </div>
              ) : (
                <>
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
              {error && (
                <div style={{padding:"10px 12px", borderRadius:"10px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.18)"}}>
                  <p style={{fontFamily:F.body, fontSize:"0.78rem", color:"#ef4444", margin:0, lineHeight:1.6}}>{error}</p>
                </div>
              )}
              <div style={{display:"flex", gap:"9px"}}>
                <button
                  onClick={()=>void finalize(null)}
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
                </>
              )}
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
  const isMobile = useIsMobile();
  const reminders = courses
    .flatMap((course) => {
      const stored = loadStoredCourseData(course.id);
      return mergeCourseReminders(stored.assignments, stored.reminders).map((reminder) => ({
        id: `${course.id}-${reminder.id}`,
        course: course.code,
        label: reminder.text,
        due: reminder.due,
        color: course.color,
        urgent: isReminderUrgent(reminder.due),
      }));
    })
    .sort((left, right) => compareDueStrings(left.due, right.due))
    .slice(0, 7);

  return (
    <div style={{
      position:"absolute", top:"calc(100% + 10px)", right:0, zIndex:200,
      width:isMobile ? "min(320px, calc(100vw - 24px))" : "320px",
      maxWidth:"calc(100vw - 24px)",
      background:"var(--bg-surface)", border:"1px solid var(--border)",
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
            <div key={r.id} style={{display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderTop:i!==0?"1px solid var(--border)":undefined}}>
              <div style={{width:"8px", height:"8px", borderRadius:"50%", background:r.urgent?"#ef4444":r.color, flexShrink:0}}/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontFamily:F.heading, fontWeight:700, fontSize:"0.84rem", color:"var(--text-primary)"}}>{r.label}</div>
                <div style={{fontFamily:F.body, fontSize:"0.72rem", color:"var(--text-muted)"}}>{r.course} · {formatDueForTimeline(r.due)}</div>
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
  const isMobile = useIsMobile();
  const [open, setOpen] = useState<number|null>(0);
  return (
    <div style={{
      position:"fixed", bottom:isMobile ? "78px" : "80px", right:isMobile ? "12px" : "22px", zIndex:100,
      width:isMobile ? "min(320px, calc(100vw - 24px))" : "320px", maxHeight:isMobile ? "70vh" : "500px",
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
  const isMobile = useIsMobile();
  const [courses, setCourses]   = useState<Course[]>([]);
  const [loading, setLoading]   = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState<SparkSuggestion[]>(() => loadDashboardSuggestionState()?.suggestions ?? []);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getAvatarCache());
  const [showModal, setShowModal] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate                = useNavigate();
  const bellRef                 = useRef<HTMLDivElement>(null);
  const profileRef              = useRef<HTMLDivElement>(null);
  const hasUpcomingReminders    = courses.some((course) => {
    const stored = loadStoredCourseData(course.id);
    return mergeCourseReminders(stored.assignments, stored.reminders).length > 0;
  });

  // Load courses — from Supabase if configured, else from localStorage
  useEffect(() => {
    async function load() {
      setLoading(true);
      if (SUPABASE_CONFIGURED) {
        const [dbCourses, user] = await Promise.all([fetchCourses(), getUser()]);
        if (user) {
          setUserName(user.user_metadata?.full_name ?? user.email ?? "");
          const fallbackAvatar = resolvePreferredAvatarUrl(
            user.id,
            (user.user_metadata?.avatar_url as string | undefined)
              ?? (user.user_metadata?.picture as string | undefined)
              ?? null,
          );
          setAvatarCache(fallbackAvatar);
          setAvatarUrl(fallbackAvatar);
          void fetchRemoteAvatarPreference(user.id)
            .then((remoteAvatar) => {
              if (!remoteAvatar) return;
              setAvatarCache(remoteAvatar);
              setAvatarUrl(remoteAvatar);
            })
            .catch(() => {});
        }
        const courseData = await Promise.all(
          dbCourses.map(async (course) => ({
            assignments: await fetchAssignments(course.id),
            documents: await fetchDocuments(course.id),
            reminders: await fetchReminders(course.id),
          })),
        );
        const mapped: Course[] = dbCourses.map((course, index) => {
          const stored = loadStoredCourseData(course.id);
          const storedDocsById = new Map(stored.docs.map((doc) => [doc.id, doc]));
          const storedDocsByPath = new Map(stored.docs.map((doc) => [doc.storagePath ?? `name:${doc.name}`, doc]));
          const assignments = courseData[index].assignments.map((assignment) => ({
            id: assignment.id,
            label: assignment.label,
            type: assignment.type,
            due: assignment.due ?? "",
            weight: assignment.weight,
            grade: assignment.grade,
            status: assignment.status,
          }));
          const reminders = courseData[index].reminders.map((reminder) => ({
            id: reminder.id,
            text: reminder.text,
            due: reminder.due ?? "",
            done: reminder.done,
          }));
          const docs = courseData[index].documents.map((document) => ({
            id: document.id,
            name: document.name,
            type: document.type,
            size: document.size ?? "",
            uploadedAt: new Date(document.uploaded_at).toLocaleDateString("en-US", { month:"short", day:"numeric" }),
            used: storedDocsById.get(document.id)?.used
              ?? storedDocsByPath.get(document.storage_path ?? `name:${document.name}`)?.used
              ?? true,
            storagePath: document.storage_path,
            textContent: document.text_content
              ?? storedDocsById.get(document.id)?.textContent
              ?? storedDocsByPath.get(document.storage_path ?? `name:${document.name}`)?.textContent
              ?? null,
          }));
          patchStoredCourseData(course.id, { assignments, reminders, docs });
          const summary = computeCourseSummary(assignments.length > 0 ? assignments : stored.assignments);
          return {
            id: course.id,
            code: course.code,
            name: course.name ?? stored.insights?.courseName ?? "",
            color: course.color,
            grade: summary.grade,
            progress: summary.progress,
            nextDue: summary.nextDue,
          };
        });
        setCourses(mapped);
        saveCourses(mapped);
      } else {
        const mapped = loadCourses().map((course) => {
          const stored = loadStoredCourseData(course.id);
          const summary = computeCourseSummary(stored.assignments);
          return {
            ...course,
            name: course.name || stored.insights?.courseName || "",
            grade: summary.grade,
            progress: summary.progress,
            nextDue: summary.nextDue,
          };
        });
        setCourses(mapped);
        saveCourses(mapped);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (loading) return;
    const cachedSuggestions = loadDashboardSuggestionState();
    if (cachedSuggestions?.suggestions.length) {
      setAiSuggestions(cachedSuggestions.suggestions);
    }
    if (courses.length === 0) {
      setAiSuggestions([]);
      setSuggestionsError(null);
      setSuggestionsLoading(false);
      saveDashboardSuggestionState(null);
      return;
    }

    let cancelled = false;

    async function loadSuggestions() {
      setSuggestionsLoading(true);
      setSuggestionsError(null);

      try {
        let hydrationBudget = 6;
        const contexts: Array<{
          courseCode: string;
          courseName: string;
          nextDue: string | null;
          assignments: Array<{ label: string; due: string; status: string }>;
          documents: Array<{ name: string; textContent: string }>;
        }> = [];

        for (const course of courses) {
          const stored = loadStoredCourseData(course.id);
          let docs = stored.docs;

          if (SUPABASE_CONFIGURED && hydrationBudget > 0) {
            for (const doc of docs) {
              if (hydrationBudget === 0) break;
              if (doc.textContent !== null || !doc.storagePath) continue;
              const textContent = await hydrateStoredDocumentText(doc);
              hydrationBudget -= 1;
              if (textContent && !doc.id.startsWith("temp-")) {
                void updateDocumentTextContent(doc.id, textContent).catch(() => {});
              }
              docs = docs.map((item) => item.id === doc.id ? { ...item, textContent } : item);
            }
          }

          if (docs !== stored.docs) {
            patchStoredCourseData(course.id, { docs });
          }

          const readableDocs = docs
            .filter((doc) => doc.used && hasReadableDocumentText(doc.textContent))
            .slice(0, 3)
            .map((doc) => ({
              name: doc.name,
              textContent: doc.textContent ?? "",
            }));

          if (readableDocs.length === 0) continue;

          contexts.push({
            courseCode: course.code,
            courseName: course.name,
            nextDue: course.nextDue === "—" ? null : course.nextDue,
            assignments: stored.assignments
              .filter((assignment) => assignment.status !== "completed")
              .slice(0, 5)
              .map((assignment) => ({
                label: assignment.label,
                due: assignment.due,
                status: assignment.status,
              })),
            documents: readableDocs,
          });
        }

        if (cancelled) return;

        if (contexts.length === 0) {
          if (!cachedSuggestions?.suggestions.length) {
            setAiSuggestions([]);
          }
          return;
        }

        const sourceSignature = contexts
          .map((context) => [
            context.courseCode,
            context.courseName,
            context.nextDue,
            context.assignments.map((assignment) => `${assignment.label}|${assignment.due}|${assignment.status}`).join("~"),
            context.documents.map((document) => `${document.name}|${document.textContent.length}|${document.textContent.slice(0, 120)}`).join("~"),
          ].join("||"))
          .join("####");

        if (cachedSuggestions?.sourceSignature === sourceSignature && cachedSuggestions.suggestions.length > 0) {
          return;
        }

        const suggestions = await generateDashboardSuggestions(contexts);
        const generatedAt = new Date().toISOString();
        const nextCache = {
          sourceSignature,
          generatedAt,
          suggestions: suggestions.map((suggestion) => ({
            ...suggestion,
            generatedAt,
          })),
        };

        if (!cancelled) {
          saveDashboardSuggestionState(nextCache);
          setAiSuggestions(nextCache.suggestions);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Spark could not generate suggestions yet.";
          setSuggestionsError(message);
        }
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    }

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [courses, loading]);

  // Subscribe to avatar changes (e.g. user updates profile on ProfilePage)
  useEffect(() => subscribeToAvatar(setAvatarUrl), []);

  // Close bell on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    if (bellOpen) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [bellOpen]);

  // Close profile menu on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    if (profileOpen) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [profileOpen]);

  const handleAddCourse = async (
    data: AddCourseInput,
    onProgress?: (progress: AddCourseProgress) => void,
  ) => {
    const baseCourse = { code: data.code, name: data.name, color: data.color };
    let newCourse: Course;
    if (SUPABASE_CONFIGURED) {
      const dbCourse = await insertCourse(data.code, data.name || null, data.color);
      if (!dbCourse) return;
      newCourse = { ...baseCourse, id: dbCourse.id, grade:"—", progress:0, nextDue:"—" };
    } else {
      newCourse = { ...baseCourse, id: Date.now().toString(), grade:"—", progress:0, nextDue:"—" };
    }
    const updated = [...courses, newCourse];
    setCourses(updated);
    saveCourses(updated);

    if (!data.syllabusFile) return;

    try {
      const stored = loadStoredCourseData(newCourse.id);
      const imported = await importSyllabusIntoCourse({
        courseId: newCourse.id,
        courseCode: newCourse.code,
        courseName: newCourse.name,
        file: data.syllabusFile,
        existingAssignments: stored.assignments,
        existingReminders: stored.reminders,
        existingDocs: stored.docs,
        onProgress,
      });

      const summary = computeCourseSummary(imported.assignments);
      const hydratedCourse: Course = {
        ...newCourse,
        name: imported.resolvedCourseName || newCourse.name,
        grade: summary.grade,
        progress: summary.progress,
        nextDue: summary.nextDue,
      };

      setCourses((prev) => {
        const next = prev.map((course) => (
          course.id === newCourse.id
            ? hydratedCourse
            : course
        ));
        saveCourses(next);
        return next;
      });
    } catch (error) {
      console.error("handleAddCourse syllabus import:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Date display
  const now     = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday:"long" });
  const dateStr = now.toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });

  return (
    <div style={{display:"flex", flexDirection:"column", minHeight:"100vh", width:"100%", background:"var(--bg-primary)", color:"var(--foreground)", fontFamily:F.body}}>

      {/* ══ TOP NAV ══ */}
      <header style={{
        minHeight:isMobile ? "72px" : "82px", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:isMobile ? "10px 14px" : "0 32px", background:"var(--bg-surface)", borderBottom:"1px solid var(--border)",
        position:"sticky", top:0, zIndex:20, flexShrink:0,
        boxShadow:"0 1px 14px rgba(0,0,0,0.06)",
        gap:isMobile ? "10px" : "16px",
      }}>
        {/* Left: logo + name */}
        <div style={{display:"flex", alignItems:"center", gap:"11px"}}>
          <img
            src={learnBeamLogo}
            alt="LearnBeam"
            style={{
              height:isMobile ? "46px" : "64px", width:isMobile ? "46px" : "64px", objectFit:"contain",
              filter:"drop-shadow(0 4px 14px rgba(0,0,0,0.16))",
            }}
          />
          <span style={{fontFamily:F.heading, fontWeight:800, fontSize:isMobile ? "1.02rem" : "1.25rem", color:"var(--text-primary)", letterSpacing:"-0.02em"}}>LearnBeam</span>
        </div>

        {/* Right: theme + bell + profile */}
        <div style={{display:"flex", alignItems:"center", gap:isMobile ? "8px" : "10px", flexShrink:0}}>
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
              {hasUpcomingReminders && !bellOpen && (
                <span style={{
                  position:"absolute", top:"8px", right:"8px",
                  width:"7px", height:"7px", borderRadius:"50%",
                  background:"#ef4444", border:"2px solid var(--bg-surface)",
                }}/>
              )}
            </button>
            {bellOpen && <RemindersPanel courses={courses} onClose={()=>setBellOpen(false)}/>}
          </div>

          {/* Profile avatar → dropdown */}
          <div style={{position:"relative"}} ref={profileRef}>
            <button
              onClick={()=>setProfileOpen(v=>!v)}
              style={{
                width:"38px", height:"38px", borderRadius:"50%",
                background: avatarUrl ? "transparent" : "var(--accent)",
                color:"var(--primary-foreground)",
                display:"flex", alignItems:"center", justifyContent:"center",
                border: avatarUrl ? "2px solid var(--border)" : "none",
                cursor:"pointer",
                boxShadow:"0 2px 10px var(--accent-glow)",
                transition:"transform 0.15s, box-shadow 0.15s",
                overflow:"hidden", padding:0,
              }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform="scale(1.08)";(e.currentTarget as HTMLButtonElement).style.boxShadow="0 4px 16px var(--accent-glow)";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform="scale(1)";(e.currentTarget as HTMLButtonElement).style.boxShadow="0 2px 10px var(--accent-glow)";}}
              title="Profile"
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>
                : <User size={16}/>
              }
            </button>
            {profileOpen && (
              <div style={{
                position:"absolute", top:"calc(100% + 10px)", right:0, zIndex:200,
                minWidth:isMobile ? "min(200px, calc(100vw - 24px))" : "200px", maxWidth:"calc(100vw - 24px)", background:"var(--bg-surface)", border:"1px solid var(--border)",
                borderRadius:"14px", boxShadow:"0 20px 50px rgba(0,0,0,0.18)",
                overflow:"hidden", animation:"panelIn 0.18s ease",
              }}>
                {userName && (
                  <div style={{padding:"13px 16px", borderBottom:"1px solid var(--border)", background:"var(--section-bg)"}}>
                    <div style={{fontFamily:F.heading, fontWeight:700, fontSize:"0.85rem", color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{userName}</div>
                    <div style={{fontFamily:F.body, fontSize:"0.7rem", color:"var(--text-muted)"}}>LearnBeam account</div>
                  </div>
                )}
                <button
                  onClick={()=>{setProfileOpen(false);navigate("/profile");}}
                  style={{width:"100%", display:"flex", alignItems:"center", gap:"9px", padding:"11px 16px", background:"none", border:"none", cursor:"pointer", color:"var(--text-secondary)", fontFamily:F.body, fontSize:"0.84rem", textAlign:"left"}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background="var(--bg-secondary)";}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background="none";}}
                >
                  <User size={14}/> My Profile
                </button>
                <div style={{height:"1px", background:"var(--border)", margin:"2px 0"}}/>
                <button
                  onClick={handleSignOut}
                  style={{width:"100%", display:"flex", alignItems:"center", gap:"9px", padding:"11px 16px", background:"none", border:"none", cursor:"pointer", color:"#ef4444", fontFamily:F.body, fontSize:"0.84rem", textAlign:"left"}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background="rgba(239,68,68,0.07)";}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background="none";}}
                >
                  <LogOut size={14}/> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══ MAIN ══ */}
      <main style={{flex:1, padding:isMobile ? "22px 16px 120px" : "38px 40px 120px", maxWidth:"980px", width:"100%", margin:"0 auto", boxSizing:"border-box"}}>

        {/* ── HERO STRIP ── */}
        <div style={{display:"flex", flexDirection:isMobile ? "column" : "row", alignItems:isMobile ? "stretch" : "flex-end", justifyContent:"space-between", marginBottom:isMobile ? "28px" : "40px", flexWrap:"wrap", gap:isMobile ? "16px" : "12px"}}>
          <div>
            <p style={{fontFamily:F.body, fontSize:"0.76rem", color:"var(--text-muted)", margin:"0 0 5px", letterSpacing:"0.05em", textTransform:"uppercase"}}>
              {dayName}, {dateStr}
            </p>
            <h1 style={{
              fontFamily:F.heading, fontSize:isMobile ? "1.6rem" : "2.1rem", fontWeight:900,
              color:"var(--text-primary)", margin:"0 0 7px",
              letterSpacing:"-0.03em", lineHeight:1.1,
            }}>
              Your AI study companion.
            </h1>
            <p style={{fontFamily:F.body, fontSize:isMobile ? "0.82rem" : "0.88rem", color:"var(--text-muted)", margin:0, lineHeight:1.6}}>
              {courses.length === 0
                ? "Add a course and let Spark analyze your materials to accelerate your learning."
                : `${courses.length} course${courses.length>1?"s":""} active · Upload your materials and ask Spark anything.`}
            </p>
          </div>
          {courses.length > 0 && (
            <div style={{
              padding:"14px 22px", background:"var(--bg-surface)",
              border:"1px solid var(--border)", borderRadius:"14px",
              textAlign:"center", alignSelf:isMobile ? "stretch" : "auto",
            }}>
              <div style={{fontFamily:F.heading, fontWeight:900, fontSize:"1.7rem", color:"var(--accent)", lineHeight:1}}>{courses.length}</div>
              <div style={{fontFamily:F.body, fontSize:"0.7rem", color:"var(--text-muted)", marginTop:"3px"}}>Course{courses.length>1?"s":""}</div>
            </div>
          )}
        </div>

        {/* ── MY COURSES ── */}
        <section style={{marginBottom:"44px"}}>
          <div style={{display:"flex", flexDirection:isMobile ? "column" : "row", alignItems:isMobile ? "stretch" : "center", justifyContent:"space-between", marginBottom:"20px", gap:isMobile ? "14px" : "12px"}}>
            <div>
              <h2 style={{
                fontFamily:F.heading, fontWeight:900, fontSize:isMobile ? "1.25rem" : "1.5rem",
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
                justifyContent:"center", width:isMobile ? "100%" : "auto",
              }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform="translateY(-1px)";(e.currentTarget as HTMLButtonElement).style.boxShadow="0 7px 22px var(--accent-glow)";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform="translateY(0)";(e.currentTarget as HTMLButtonElement).style.boxShadow="0 4px 14px var(--accent-glow)";}}
            >
              <Plus size={14}/> Add Course
            </button>
          </div>

          {loading ? (
            <div style={{display:"grid", gridTemplateColumns:isMobile ? "1fr" : "repeat(auto-fill,minmax(265px,1fr))", gap:"15px"}}>
              {[1,2].map(i=>(
                <div key={i} style={{background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"16px", padding:"22px", height:"168px", animation:"pulse 1.5s ease-in-out infinite"}}/>
              ))}
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
            </div>
          ) : courses.length === 0 ? (
            <div
              onClick={()=>setShowModal(true)}
              style={{
                border:"2px dashed var(--border)", borderRadius:"18px",
                padding:isMobile ? "42px 20px" : "56px 24px", textAlign:"center", cursor:"pointer",
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
            <div style={{display:"grid", gridTemplateColumns:isMobile ? "1fr" : "repeat(auto-fill,minmax(265px,1fr))", gap:"15px"}}>
              {courses.map(c=>(
                <div
                  key={c.id}
                  onClick={()=>navigate(`/course/${c.id}`)}
                  style={{
                    background:"var(--bg-surface)", border:"1px solid var(--border)",
                    borderRadius:"16px", padding:isMobile ? "18px" : "22px", cursor:"pointer",
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

        {/* ── THIS WEEK TIMELINE ── */}
        {!loading && (() => {
          // Gather all items due within the next 7 days across all courses
          const weekItems = courses.flatMap((course) => {
            const stored = loadStoredCourseData(course.id);
            return mergeCourseReminders(stored.assignments, stored.reminders)
              .filter((reminder) => {
                if (!reminder.due || reminder.done) return false;
                const parsed = new Date(
                  reminder.due.includes("T") ? reminder.due : `${reminder.due}T00:00:00`,
                );
                if (isNaN(parsed.getTime())) return false;
                const diff = parsed.getTime() - Date.now();
                // Include items from start of today through 7 days out
                return diff > -(24 * 60 * 60 * 1000) && diff <= 7 * 24 * 60 * 60 * 1000;
              })
              .map((reminder) => ({
                id: `${course.id}-${reminder.id}`,
                courseCode: course.code,
                courseColor: course.color,
                label: reminder.text,
                due: reminder.due,
                urgent: isReminderUrgent(reminder.due),
              }));
          }).sort((a, b) => compareDueStrings(a.due, b.due));

          if (weekItems.length === 0) return null;

          return (
            <section style={{ marginBottom: "44px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "16px" }}>
                <CalendarDays size={16} style={{ color: "var(--accent)" }}/>
                <h2 style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "1rem", color: "var(--text-primary)", margin: 0 }}>This Week</h2>
                <span style={{ fontFamily: F.body, fontSize: "0.67rem", color: "var(--text-muted)", padding: "2px 9px", borderRadius: "99px", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  {weekItems.length} item{weekItems.length !== 1 ? "s" : ""} due in 7 days
                </span>
              </div>
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
                {weekItems.map((item, index) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: isMobile ? "12px 16px" : "13px 20px", borderTop: index !== 0 ? "1px solid var(--border)" : undefined }}>
                    {/* Color dot */}
                    <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: item.urgent ? "#ef4444" : item.courseColor, flexShrink: 0 }}/>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.86rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
                      <div style={{ fontFamily: F.body, fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "1px" }}>
                        {item.courseCode} · {formatDueForTimeline(item.due)}
                      </div>
                    </div>
                    {/* Course badge */}
                    <span style={{ fontFamily: F.body, fontSize: "0.66rem", padding: "2px 8px", borderRadius: "99px", background: `${item.courseColor}18`, color: item.courseColor, fontWeight: 700, flexShrink: 0 }}>
                      {item.courseCode}
                    </span>
                    {/* Urgency flag */}
                    {item.urgent && (
                      <span style={{ fontFamily: F.body, fontSize: "0.65rem", padding: "2px 7px", borderRadius: "99px", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 700, flexShrink: 0 }}>Soon</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

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
            ) : suggestionsLoading && aiSuggestions.length === 0 ? (
              <div style={{padding:"24px 22px", display:"flex", alignItems:"center", gap:"14px"}}>
                <div style={{width:"38px", height:"38px", borderRadius:"10px", background:"var(--accent-soft)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                  <Brain size={17} style={{color:"var(--accent)"}}/>
                </div>
                <div>
                  <p style={{fontFamily:F.heading, fontWeight:800, fontSize:"0.9rem", color:"var(--text-primary)", margin:"0 0 4px"}}>Spark is reviewing your materials</p>
                  <p style={{fontFamily:F.body, fontSize:"0.82rem", color:"var(--text-muted)", margin:0, lineHeight:1.6}}>
                    LearnBeam Suggestions are being generated from your uploaded course documents.
                  </p>
                </div>
              </div>
            ) : suggestionsError && aiSuggestions.length === 0 ? (
              <div style={{padding:"24px 22px", display:"flex", alignItems:"flex-start", gap:"14px"}}>
                <div style={{width:"38px", height:"38px", borderRadius:"10px", background:"rgba(239,68,68,0.08)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                  <Zap size={17} style={{color:"#ef4444"}}/>
                </div>
                <div>
                  <p style={{fontFamily:F.heading, fontWeight:800, fontSize:"0.9rem", color:"var(--text-primary)", margin:"0 0 4px"}}>Spark could not refresh suggestions</p>
                  <p style={{fontFamily:F.body, fontSize:"0.82rem", color:"var(--text-muted)", margin:0, lineHeight:1.6}}>
                    {suggestionsError}
                  </p>
                </div>
              </div>
            ) : aiSuggestions.length === 0 ? (
              <div style={{padding:"24px 22px", display:"flex", alignItems:"center", gap:"14px"}}>
                <div style={{width:"38px", height:"38px", borderRadius:"10px", background:"var(--accent-soft)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                  <BookOpenCheck size={17} style={{color:"var(--accent)"}}/>
                </div>
                <p style={{fontFamily:F.body, fontSize:"0.84rem", color:"var(--text-muted)", margin:0, lineHeight:1.6}}>
                  Upload readable course files like PDF, DOCX, or TXT documents and Spark will generate personalized suggestions here.
                </p>
              </div>
            ) : (
              aiSuggestions.map((suggestion, index)=>(
                <div key={suggestion.id} style={{display:"flex", alignItems:"flex-start", gap:"13px", padding:"15px 22px", borderTop:index!==0?"1px solid var(--border)":undefined}}>
                  <div style={{width:"28px", height:"28px", borderRadius:"8px", background:"var(--accent-soft)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:"1px", color:"var(--accent)"}}>
                    {index === 0 ? <Lightbulb size={14}/> : index === 1 ? <BookOpen size={14}/> : <Zap size={14}/>}
                  </div>
                  <div>
                    <div style={{display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap", marginBottom:"4px"}}>
                      <p style={{fontFamily:F.heading, fontSize:"0.86rem", fontWeight:800, color:"var(--text-primary)", margin:0}}>{suggestion.title}</p>
                      {suggestion.courseCode && (
                        <span style={{fontFamily:F.body, fontSize:"0.67rem", color:"var(--accent)", fontWeight:700, padding:"2px 8px", borderRadius:"99px", background:"var(--accent-soft)", border:"1px solid var(--border)"}}>
                          {suggestion.courseCode}
                        </span>
                      )}
                    </div>
                    <p style={{fontFamily:F.body, fontSize:"0.84rem", color:"var(--text-secondary)", margin:"0 0 4px", lineHeight:1.62}}>{suggestion.detail}</p>
                    {suggestion.sourceDoc && (
                      <p style={{fontFamily:F.body, fontSize:"0.72rem", color:"var(--text-muted)", margin:0}}>
                        Based on {suggestion.sourceDoc}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </main>

      {/* ══ ADD COURSE MODAL ══ */}
      {showModal && <AddCourseModal onClose={()=>setShowModal(false)} onAdd={handleAddCourse}/>}

      {/* ══ HELP ? BUTTON + PANEL ══ */}
      <div style={{position:"fixed", bottom:isMobile ? "18px" : "22px", right:isMobile ? "14px" : "22px", zIndex:100, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"10px"}}>
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
