import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import {
  ChevronLeft, User, Camera, Check, X, Trash2, Edit2,
  GraduationCap, CreditCard, Bell, Shield, LogOut,
  Settings, ChevronRight,
} from "lucide-react";
import learnBeamLogo from "../../assets/861bd4bcf410ca26cefb8d6a2c416c8933fab508.png";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { loadCourses, saveCourses, type Course } from "./Dashboard";

const F = {
  heading: "'Nunito', 'Trebuchet MS', system-ui, sans-serif",
  body:    "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif",
};

type Section = "profile" | "courses" | "settings";

/* ─────────────────────────────────────────────────────
   EDITABLE FIELD
───────────────────────────────────────────────────── */
function EditableField({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);

  const save = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  return (
    <div style={{marginBottom:"18px"}}>
      <label style={{fontFamily:F.body, fontSize:"0.78rem", fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.05em"}}>
        {label}
      </label>
      {editing ? (
        <div style={{display:"flex", gap:"8px", alignItems:"center"}}>
          <input
            value={draft}
            onChange={e=>setDraft(e.target.value)}
            type={type}
            placeholder={placeholder}
            autoFocus
            onKeyDown={e=>{ if(e.key==="Enter") save(); if(e.key==="Escape") cancel(); }}
            style={{
              flex:1, padding:"11px 14px", borderRadius:"10px",
              border:"1.5px solid var(--accent)", background:"var(--input)",
              color:"var(--text-primary)", fontFamily:F.body, fontSize:"0.9rem",
              outline:"none", boxShadow:"0 0 0 3px var(--accent-soft)",
              boxSizing:"border-box",
            }}
          />
          <button onClick={save} style={{width:"36px", height:"36px", borderRadius:"9px", background:"var(--accent)", color:"var(--primary-foreground)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
            <Check size={15}/>
          </button>
          <button onClick={cancel} style={{width:"36px", height:"36px", borderRadius:"9px", background:"var(--bg-secondary)", color:"var(--text-muted)", border:"1px solid var(--border)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
            <X size={15}/>
          </button>
        </div>
      ) : (
        <div
          onClick={()=>{ setDraft(value); setEditing(true); }}
          style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"11px 14px", borderRadius:"10px",
            border:"1.5px solid var(--border)", background:"var(--input)",
            cursor:"text", transition:"border-color 0.2s",
          }}
          onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor="var(--accent)"}
          onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor="var(--border)"}
        >
          <span style={{fontFamily:F.body, fontSize:"0.9rem", color:value?"var(--text-primary)":"var(--text-muted)"}}>
            {value || placeholder || "—"}
          </span>
          <Edit2 size={13} style={{color:"var(--text-muted)", flexShrink:0}}/>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   CONFIRM DELETE DIALOG
───────────────────────────────────────────────────── */
function ConfirmDelete({ label, onConfirm, onCancel }: { label: string; onConfirm: ()=>void; onCancel: ()=>void }) {
  return (
    <div style={{position:"fixed", inset:0, zIndex:300, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px"}}
      onClick={e=>e.target===e.currentTarget && onCancel()}>
      <div style={{background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"18px", padding:"28px 28px 24px", width:"100%", maxWidth:"380px", boxShadow:"0 28px 70px rgba(0,0,0,0.22)", animation:"modalIn 0.22s ease"}}>
        <div style={{width:"52px", height:"52px", borderRadius:"50%", background:"rgba(239,68,68,0.12)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px"}}>
          <Trash2 size={22} style={{color:"#ef4444"}}/>
        </div>
        <p style={{fontFamily:F.heading, fontWeight:800, fontSize:"1.05rem", color:"var(--text-primary)", textAlign:"center", margin:"0 0 8px"}}>Remove Course?</p>
        <p style={{fontFamily:F.body, fontSize:"0.84rem", color:"var(--text-muted)", textAlign:"center", margin:"0 0 22px", lineHeight:1.55}}>
          <strong style={{color:"var(--text-primary)"}}>{label}</strong> will be permanently removed from your dashboard.
        </p>
        <div style={{display:"flex", gap:"10px"}}>
          <button onClick={onCancel} style={{flex:1, padding:"11px", borderRadius:"10px", border:"1.5px solid var(--border)", background:"var(--bg-secondary)", color:"var(--text-secondary)", fontFamily:F.body, fontWeight:600, fontSize:"0.86rem", cursor:"pointer"}}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{flex:1, padding:"11px", borderRadius:"10px", border:"none", background:"#ef4444", color:"#fff", fontFamily:F.heading, fontWeight:700, fontSize:"0.86rem", cursor:"pointer", boxShadow:"0 4px 12px rgba(239,68,68,0.3)"}}>
            Remove
          </button>
        </div>
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.94) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   MAIN PROFILE PAGE
───────────────────────────────────────────────────── */
export function ProfilePage() {
  const navigate = useNavigate();

  // Profile state
  const [displayName, setDisplayName] = useState("Karan Kumar Sah");
  const [email, setEmail]             = useState("flokithegodz@gmail.com");
  const [username, setUsername]       = useState("karan_k");
  const [avatar, setAvatar]           = useState<string | null>(null);

  // Courses
  const [courses, setCourses]         = useState<Course[]>(loadCourses);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  // Section nav
  const [section, setSection]         = useState<Section>("profile");

  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleDeleteCourse = (id: string) => {
    const updated = courses.filter(c=>c.id!==id);
    setCourses(updated);
    saveCourses(updated);
    setDeleteTarget(null);
  };

  const initials = displayName.trim().split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  const navItems: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id:"profile",  label:"Profile",        icon:<User size={16}/>       },
    { id:"courses",  label:"My Courses",     icon:<GraduationCap size={16}/> },
    { id:"settings", label:"Settings",       icon:<Settings size={16}/>   },
  ];

  return (
    <div style={{display:"flex", flexDirection:"column", minHeight:"100vh", background:"var(--bg-primary)", color:"var(--foreground)", fontFamily:F.body}}>

      {/* ══ TOP NAV ══ */}
      <header style={{
        height:"72px", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 32px", background:"var(--bg-surface)", borderBottom:"1px solid var(--border)",
        position:"sticky", top:0, zIndex:20, flexShrink:0,
        boxShadow:"0 1px 14px rgba(0,0,0,0.06)",
      }}>
        <div style={{display:"flex", alignItems:"center", gap:"14px"}}>
          <button
            onClick={()=>navigate("/dashboard")}
            style={{display:"flex", alignItems:"center", gap:"5px", background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontFamily:F.body, fontSize:"0.84rem", padding:"5px 8px", borderRadius:"8px", transition:"color 0.15s, background 0.15s"}}
            onMouseEnter={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.color="var(--text-primary)";b.style.background="var(--bg-secondary)";}}
            onMouseLeave={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.color="var(--text-muted)";b.style.background="transparent";}}
          >
            <ChevronLeft size={16}/> Dashboard
          </button>
          <span style={{color:"var(--border)"}}>›</span>
          <div style={{display:"flex", alignItems:"center", gap:"10px"}}>
            <img src={learnBeamLogo} alt="LearnBeam" style={{height:"54px", width:"54px", objectFit:"contain", filter:"drop-shadow(0 3px 10px rgba(0,0,0,0.14))"}}/>
            <span style={{fontFamily:F.heading, fontWeight:800, fontSize:"1.2rem", color:"var(--text-primary)", letterSpacing:"-0.02em"}}>LearnBeam</span>
          </div>
        </div>
        <ThemeSwitcher/>
      </header>

      {/* ══ BODY ══ */}
      <div style={{flex:1, display:"flex", maxWidth:"980px", width:"100%", margin:"0 auto", padding:"36px 36px 80px", boxSizing:"border-box", gap:"28px", alignItems:"flex-start"}}>

        {/* ── SIDEBAR NAV ── */}
        <aside style={{width:"220px", flexShrink:0, position:"sticky", top:"96px"}}>
          {/* Avatar */}
          <div style={{display:"flex", flexDirection:"column", alignItems:"center", marginBottom:"28px"}}>
            <div style={{position:"relative", marginBottom:"13px"}}>
              <div style={{
                width:"88px", height:"88px", borderRadius:"50%",
                background:avatar?"transparent":"var(--accent)",
                display:"flex", alignItems:"center", justifyContent:"center",
                overflow:"hidden",
                boxShadow:"0 6px 22px var(--accent-glow)",
                border:"3px solid var(--bg-surface)",
                outline:"2px solid var(--accent)",
              }}>
                {avatar
                  ? <img src={avatar} alt="avatar" style={{width:"100%", height:"100%", objectFit:"cover"}}/>
                  : <span style={{fontFamily:F.heading, fontWeight:900, fontSize:"1.8rem", color:"var(--primary-foreground)"}}>{initials}</span>
                }
              </div>
              <button
                onClick={()=>fileRef.current?.click()}
                style={{
                  position:"absolute", bottom:"2px", right:"2px",
                  width:"28px", height:"28px", borderRadius:"50%",
                  background:"var(--accent)", color:"var(--primary-foreground)",
                  border:"2px solid var(--bg-surface)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  cursor:"pointer",
                }}
                title="Change photo"
              >
                <Camera size={12}/>
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarChange}/>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:F.heading, fontWeight:800, fontSize:"0.96rem", color:"var(--text-primary)"}}>{displayName}</div>
              <div style={{fontFamily:F.body, fontSize:"0.75rem", color:"var(--text-muted)", marginTop:"2px"}}>@{username}</div>
            </div>
          </div>

          {/* Nav items */}
          <nav style={{display:"flex", flexDirection:"column", gap:"3px"}}>
            {navItems.map(item=>(
              <button
                key={item.id}
                onClick={()=>setSection(item.id)}
                style={{
                  display:"flex", alignItems:"center", gap:"10px",
                  padding:"10px 13px", borderRadius:"10px",
                  border:"none", cursor:"pointer", textAlign:"left", width:"100%",
                  fontFamily:F.body, fontSize:"0.85rem", fontWeight:section===item.id?700:500,
                  background:section===item.id?"var(--accent-soft)":"transparent",
                  color:section===item.id?"var(--accent)":"var(--text-secondary)",
                  transition:"all 0.15s",
                }}
                onMouseEnter={e=>{ if(section!==item.id) (e.currentTarget as HTMLButtonElement).style.background="var(--bg-secondary)"; }}
                onMouseLeave={e=>{ if(section!==item.id) (e.currentTarget as HTMLButtonElement).style.background="transparent"; }}
              >
                <span style={{color:section===item.id?"var(--accent)":"var(--text-muted)"}}>{item.icon}</span>
                {item.label}
              </button>
            ))}

            <div style={{height:"1px", background:"var(--border)", margin:"10px 0"}}/>

            <button
              onClick={()=>navigate("/")}
              style={{
                display:"flex", alignItems:"center", gap:"10px",
                padding:"10px 13px", borderRadius:"10px", border:"none",
                cursor:"pointer", textAlign:"left", width:"100%",
                fontFamily:F.body, fontSize:"0.85rem", fontWeight:500,
                background:"transparent", color:"var(--text-muted)",
                transition:"all 0.15s",
              }}
              onMouseEnter={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.background="rgba(239,68,68,0.08)";b.style.color="#ef4444";}}
              onMouseLeave={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.background="transparent";b.style.color="var(--text-muted)";}}
            >
              <LogOut size={16}/>
              Sign Out
            </button>
          </nav>
        </aside>

        {/* ── CONTENT PANEL ── */}
        <div style={{flex:1, minWidth:0}}>

          {/* ── SECTION: PROFILE ── */}
          {section==="profile" && (
            <div>
              <div style={{marginBottom:"28px"}}>
                <h2 style={{fontFamily:F.heading, fontWeight:900, fontSize:"1.35rem", color:"var(--text-primary)", margin:"0 0 4px", letterSpacing:"-0.02em"}}>Profile</h2>
                <p style={{fontFamily:F.body, fontSize:"0.82rem", color:"var(--text-muted)", margin:0}}>Your personal information — all editable.</p>
              </div>

              <div style={{background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"16px", padding:"28px 28px 24px"}}>
                <EditableField label="Display Name"  value={displayName} onChange={setDisplayName} placeholder="Your name"/>
                <EditableField label="Email Address" value={email}       onChange={setEmail}       type="email"   placeholder="you@example.com"/>
                <EditableField label="Username"      value={username}    onChange={setUsername}    placeholder="username"/>

                <div style={{marginTop:"8px", padding:"12px 14px", background:"var(--accent-soft)", borderRadius:"10px", border:"1px solid var(--border)"}}>
                  <p style={{fontFamily:F.body, fontSize:"0.78rem", color:"var(--accent)", margin:0, fontWeight:500}}>
                    💡 Click any field to edit it. Press Enter to save or Esc to cancel.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── SECTION: MY COURSES ── */}
          {section==="courses" && (
            <div>
              <div style={{marginBottom:"28px"}}>
                <h2 style={{fontFamily:F.heading, fontWeight:900, fontSize:"1.35rem", color:"var(--text-primary)", margin:"0 0 4px", letterSpacing:"-0.02em"}}>My Courses</h2>
                <p style={{fontFamily:F.body, fontSize:"0.82rem", color:"var(--text-muted)", margin:0}}>
                  {courses.length} enrolled course{courses.length!==1?"s":""}. Remove courses you no longer need.
                </p>
              </div>

              {courses.length === 0 ? (
                <div style={{background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"16px", padding:"44px 24px", textAlign:"center"}}>
                  <GraduationCap size={38} style={{color:"var(--text-muted)", marginBottom:"12px"}}/>
                  <p style={{fontFamily:F.heading, fontWeight:700, fontSize:"0.95rem", color:"var(--text-primary)", margin:"0 0 6px"}}>No courses yet</p>
                  <p style={{fontFamily:F.body, fontSize:"0.82rem", color:"var(--text-muted)", margin:"0 0 18px"}}>Go to the dashboard and add your first course.</p>
                  <button onClick={()=>navigate("/dashboard")} style={{background:"var(--accent)", color:"var(--primary-foreground)", border:"none", borderRadius:"9px", padding:"10px 20px", fontFamily:F.heading, fontWeight:700, fontSize:"0.84rem", cursor:"pointer"}}>
                    Go to Dashboard
                  </button>
                </div>
              ) : (
                <div style={{display:"flex", flexDirection:"column", gap:"10px"}}>
                  {courses.map(c=>(
                    <div key={c.id} style={{display:"flex", alignItems:"center", gap:"14px", background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"13px", padding:"16px 18px", transition:"box-shadow 0.2s"}}
                      onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.boxShadow="0 6px 20px rgba(0,0,0,0.08)"}
                      onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.boxShadow="none"}
                    >
                      <div style={{width:"42px", height:"42px", borderRadius:"11px", background:`${c.color}1a`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                        <GraduationCap size={19} style={{color:c.color}}/>
                      </div>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontFamily:F.heading, fontWeight:800, fontSize:"0.94rem", color:"var(--text-primary)"}}>{c.code}</div>
                        {c.name && <div style={{fontFamily:F.body, fontSize:"0.74rem", color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{c.name}</div>}
                      </div>
                      <div style={{display:"flex", alignItems:"center", gap:"8px"}}>
                        <button
                          onClick={()=>navigate(`/course/${c.id}`)}
                          style={{display:"flex", alignItems:"center", gap:"4px", background:"var(--bg-secondary)", border:"1px solid var(--border)", borderRadius:"8px", padding:"6px 12px", fontFamily:F.body, fontSize:"0.75rem", fontWeight:600, cursor:"pointer", color:"var(--text-secondary)", transition:"all 0.15s"}}
                          onMouseEnter={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="var(--accent)";b.style.color="var(--accent)";}}
                          onMouseLeave={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="var(--border)";b.style.color="var(--text-secondary)";}}
                        >
                          Open <ChevronRight size={11}/>
                        </button>
                        <button
                          onClick={()=>setDeleteTarget(c)}
                          style={{width:"34px", height:"34px", borderRadius:"8px", background:"transparent", border:"1px solid var(--border)", cursor:"pointer", color:"var(--text-muted)", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s"}}
                          onMouseEnter={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.background="rgba(239,68,68,0.08)";b.style.color="#ef4444";b.style.borderColor="#ef4444";}}
                          onMouseLeave={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.background="transparent";b.style.color="var(--text-muted)";b.style.borderColor="var(--border)";}}
                          title="Remove course"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SECTION: SETTINGS ── */}
          {section==="settings" && (
            <div>
              <div style={{marginBottom:"28px"}}>
                <h2 style={{fontFamily:F.heading, fontWeight:900, fontSize:"1.35rem", color:"var(--text-primary)", margin:"0 0 4px", letterSpacing:"-0.02em"}}>Settings</h2>
                <p style={{fontFamily:F.body, fontSize:"0.82rem", color:"var(--text-muted)", margin:0}}>Manage your account, notifications and subscription.</p>
              </div>

              {/* Plan */}
              <div style={{background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"16px", overflow:"hidden", marginBottom:"16px"}}>
                <div style={{padding:"14px 20px", background:"var(--section-bg)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:"8px"}}>
                  <CreditCard size={15} style={{color:"var(--accent)"}}/>
                  <span style={{fontFamily:F.heading, fontWeight:800, fontSize:"0.9rem", color:"var(--text-primary)"}}>Plan & Subscription</span>
                </div>
                <div style={{padding:"22px 20px"}}>
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"18px"}}>
                    <div>
                      <div style={{fontFamily:F.heading, fontWeight:700, fontSize:"0.94rem", color:"var(--text-primary)", marginBottom:"3px"}}>Free Plan</div>
                      <div style={{fontFamily:F.body, fontSize:"0.78rem", color:"var(--text-muted)"}}>Up to 3 courses · Basic AI suggestions</div>
                    </div>
                    <span style={{fontFamily:F.body, fontSize:"0.72rem", padding:"4px 10px", borderRadius:"99px", background:"var(--accent-soft)", color:"var(--accent)", fontWeight:700, border:"1px solid var(--border)"}}>Active</span>
                  </div>
                  <button style={{width:"100%", padding:"12px", borderRadius:"10px", background:"var(--accent)", color:"var(--primary-foreground)", border:"none", fontFamily:F.heading, fontWeight:700, fontSize:"0.88rem", cursor:"pointer", boxShadow:"0 4px 14px var(--accent-glow)"}}>
                    Upgrade to Pro
                  </button>
                  <p style={{fontFamily:F.body, fontSize:"0.73rem", color:"var(--text-muted)", textAlign:"center", margin:"10px 0 0"}}>
                    Pro unlocks unlimited courses, AI-powered quiz generation, priority support and more.
                  </p>
                </div>
              </div>

              {/* Notifications */}
              <div style={{background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"16px", overflow:"hidden", marginBottom:"16px"}}>
                <div style={{padding:"14px 20px", background:"var(--section-bg)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:"8px"}}>
                  <Bell size={15} style={{color:"var(--accent)"}}/>
                  <span style={{fontFamily:F.heading, fontWeight:800, fontSize:"0.9rem", color:"var(--text-primary)"}}>Notifications</span>
                </div>
                {[
                  { label:"Deadline reminders",   sub:"Notify before assignments are due",    on:true  },
                  { label:"Grade entry prompts",   sub:"Ask when deadlines pass",              on:true  },
                  { label:"AI suggestions",        sub:"Weekly study tips from LearnBeam",     on:true  },
                  { label:"Email digest",          sub:"Weekly summary of your progress",      on:false },
                ].map((item,i)=>(
                  <div key={i} style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderTop:i!==0?"1px solid var(--border)":undefined}}>
                    <div>
                      <div style={{fontFamily:F.body, fontWeight:600, fontSize:"0.86rem", color:"var(--text-primary)"}}>{item.label}</div>
                      <div style={{fontFamily:F.body, fontSize:"0.74rem", color:"var(--text-muted)"}}>{item.sub}</div>
                    </div>
                    <div style={{width:"44px", height:"24px", borderRadius:"99px", background:item.on?"var(--accent)":"var(--bg-secondary)", border:`1px solid ${item.on?"var(--accent)":"var(--border)"}`, cursor:"pointer", position:"relative", transition:"background 0.2s"}}>
                      <div style={{position:"absolute", top:"3px", left:item.on?"22px":"3px", width:"16px", height:"16px", borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
                    </div>
                  </div>
                ))}
              </div>

              {/* Security */}
              <div style={{background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:"16px", overflow:"hidden"}}>
                <div style={{padding:"14px 20px", background:"var(--section-bg)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:"8px"}}>
                  <Shield size={15} style={{color:"var(--accent)"}}/>
                  <span style={{fontFamily:F.heading, fontWeight:800, fontSize:"0.9rem", color:"var(--text-primary)"}}>Security</span>
                </div>
                {[
                  { label:"Change Password",     sub:"Update your login credentials"       },
                  { label:"Two-Factor Auth",      sub:"Add an extra layer of security"      },
                  { label:"Connected Accounts",   sub:"Manage Google sign-in"               },
                  { label:"Delete Account",       sub:"Permanently remove your data", danger:true },
                ].map((item,i)=>(
                  <button key={i}
                    style={{
                      width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"14px 20px", borderTop:i!==0?"1px solid var(--border)":undefined,
                      background:"none", border:"none", cursor:"pointer",
                      transition:"background 0.15s",
                    }}
                    onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background=(item as any).danger?"rgba(239,68,68,0.05)":"var(--row-hover)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background="transparent"}
                  >
                    <div style={{textAlign:"left"}}>
                      <div style={{fontFamily:F.body, fontWeight:600, fontSize:"0.86rem", color:(item as any).danger?"#ef4444":"var(--text-primary)"}}>{item.label}</div>
                      <div style={{fontFamily:F.body, fontSize:"0.74rem", color:"var(--text-muted)"}}>{item.sub}</div>
                    </div>
                    <ChevronRight size={14} style={{color:"var(--text-muted)", flexShrink:0}}/>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── DELETE CONFIRM ── */}
      {deleteTarget && (
        <ConfirmDelete
          label={deleteTarget.code + (deleteTarget.name ? ` — ${deleteTarget.name}` : "")}
          onConfirm={()=>handleDeleteCourse(deleteTarget.id)}
          onCancel={()=>setDeleteTarget(null)}
        />
      )}

    </div>
  );
}
