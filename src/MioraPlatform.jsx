import { useState, useEffect, useRef, useCallback } from "react";
import emailjs from "@emailjs/browser";
import { auth, db, ADMIN_EMAIL, ensureAuth } from "./firebase";
import {
  collection, addDoc, query, where, onSnapshot, doc, updateDoc, orderBy,
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ─── EmailJS Config (instant heads-up notifications to Layal) ───────────────
const EMAILJS_SERVICE_ID  = "service_c3r6j0e";
const EMAILJS_TEMPLATE_ID = "template_4ebiexb";
const EMAILJS_PUBLIC_KEY  = "waLfs1rIpsn4oaQVR";

// ─── WhatsApp number (shown in footer as a direct contact option) ───────────
const LAYAL_WHATSAPP_NUMBER = "962788882168";

// ─── Constants ───────────────────────────────────────────────────────────────
const PASTEL_PURPLE = "#D8C0FF";
const DEEP_PURPLE   = "#7B5EA7";
const DARK_PURPLE   = "#4A3068";
const WARM_WHITE    = "#FFFEF9";
const SOFT_PINK     = "#F5E6FF";
const GOLD_ACCENT   = "#D4A853";

const STORAGE_KEYS = {
  LANG: "miora_lang",
  REVIEWS: "miora_reviews",
  PROJECTS: "miora_projects",
};

const PRICING = [
  { pages: "30–40",   price: "22–25 JOD" },
  { pages: "41–55",   price: "26–29 JOD" },
  { pages: "56–70",   price: "34–37 JOD" },
  { pages: "71–85",   price: "34–37 JOD" },
  { pages: "86–100",  price: "38–41 JOD" },
  { pages: "101–115", price: "42–46 JOD" },
  { pages: "116–130", price: "47–50 JOD" },
  { pages: "131–146", price: "51–55 JOD" },
  { pages: "147–162", price: "56–60 JOD" },
  { pages: "163–178", price: "61–65 JOD" },
];

// ─── Auto-detect pricing tier from page count ─────────────────────────────────
function getPackageFromPageCount(pageCount) {
  if (pageCount <= 40)  return PRICING[0];   // 30–40
  if (pageCount <= 55)  return PRICING[1];   // 41–55
  if (pageCount <= 70)  return PRICING[2];   // 56–70
  if (pageCount <= 85)  return PRICING[3];   // 71–85
  if (pageCount <= 100) return PRICING[4];   // 86–100
  if (pageCount <= 115) return PRICING[5];   // 101–115
  if (pageCount <= 130) return PRICING[6];   // 116–130
  if (pageCount <= 146) return PRICING[7];   // 131–146
  if (pageCount <= 162) return PRICING[8];   // 147–162
  return PRICING[9];                         // 163–178
}
const OCCASIONS = [
  { name: "Wedding",     nameAr: "زفاف",           emoji: "💍" },
  { name: "Baby Shower", nameAr: "استقبال مولود",   emoji: "🍼" },
  { name: "Birthday",    nameAr: "عيد ميلاد",       emoji: "🎂" },
  { name: "Graduation",  nameAr: "تخرج",            emoji: "🎓" },
  { name: "Engagement",  nameAr: "خطوبة",           emoji: "💐" },
  { name: "Travel",      nameAr: "سفر",             emoji: "✈️" },
  { name: "Family",      nameAr: "عائلة",           emoji: "👨‍👩‍👧‍👦" },
  { name: "Anniversary", nameAr: "ذكرى سنوية",      emoji: "❤️" },
];

const DEFAULT_REVIEWS = [
  { id:"r1", name:"Sara A.",  rating:5, text:"The album for my wedding was absolutely stunning! Every page was beautifully designed.", nameAr:"سارة أ.",  textAr:"ألبوم زفافي كان رائعاً! كل صفحة كانت مصممة بشكل جميل.", date:"2026-04-12" },
  { id:"r2", name:"Rania K.", rating:5, text:"I used the AI option and was blown away. It arranged 80 photos perfectly!", nameAr:"رانيا ك.", textAr:"استخدمت خيار الذكاء الاصطناعي وكانت النتيجة مذهلة!", date:"2026-03-28" },
  { id:"r3", name:"Ahmad M.", rating:4, text:"Great quality and fast service. The preset templates saved me so much time.", nameAr:"أحمد م.", textAr:"جودة ممتازة وخدمة سريعة. القوالب الجاهزة وفرت لي الكثير من الوقت.", date:"2026-03-15" },
  { id:"r4", name:"Lina T.",  rating:5, text:"My baby shower album is something I'll treasure forever. Thank you Miora!", nameAr:"لينا ت.",  textAr:"ألبوم استقبال المولود سأحتفظ به للأبد. شكراً ميورا!", date:"2026-02-20" },
];

// Sticker packs — pure emoji so no external assets needed
const STICKER_PACKS = {
  hearts:   { label:"Hearts 💜",    items:["💜","❤️","🧡","💛","💚","💙","🤍","🖤","💗","💕","💞","💓","💝","💖","💘","❣️"] },
  flowers:  { label:"Flowers 🌸",   items:["🌸","🌺","🌻","🌹","🌷","💐","🌼","🍀","🌿","🍃","🌱","🪷","🌾","🍂","🍁","🌴"] },
  stars:    { label:"Stars ⭐",     items:["⭐","🌟","✨","💫","🌙","☀️","🌈","⚡","🔥","❄️","🌊","🎇","🎆","🌠","💥","🪄"] },
  celebrate:{ label:"Celebrate 🎉", items:["🎉","🎊","🎈","🎁","🎀","🥳","🍰","🎂","🥂","🍾","🎵","🎶","🎸","🪗","🎺","🎻"] },
  nature:   { label:"Nature 🦋",    items:["🦋","🌸","🐝","🦚","🦜","🌙","⭐","🌊","🏔️","🌅","🌄","🦩","🕊️","🌺","🍓","🫧"] },
  travel:   { label:"Travel ✈️",    items:["✈️","🗺️","🏖️","🏝️","⛰️","🗼","🗽","🏰","🌍","🧭","📸","🎒","🛳️","🚂","🚀","🌅"] },
  baby:     { label:"Baby 🍼",      items:["🍼","👶","🧸","🎠","🌈","⭐","💕","🐣","🦆","🐰","🐻","🌸","🍭","🎀","🎈","🌙"] },
  wedding:  { label:"Wedding 💍",   items:["💍","💒","👰","🤵","💐","🥂","🕊️","💌","🎂","💜","❤️","🌹","✨","🎊","💫","🫶"] },
};

const FONTS = [
  { name:"Quicksand",        label:"Quicksand",        preview:"Beautiful Moments" },
  { name:"Playfair Display", label:"Playfair Display",  preview:"Beautiful Moments" },
  { name:"Londrina Solid",   label:"Londrina Solid",    preview:"Beautiful Moments" },
  { name:"Dancing Script",   label:"Dancing Script",    preview:"Beautiful Moments" },
  { name:"Pacifico",         label:"Pacifico",          preview:"Beautiful Moments" },
  { name:"Amatic SC",        label:"Amatic SC",         preview:"Beautiful Moments" },
  { name:"Caveat",           label:"Caveat",            preview:"Beautiful Moments" },
  { name:"Lobster",          label:"Lobster",           preview:"Beautiful Moments" },
  { name:"Comfortaa",        label:"Comfortaa",         preview:"Beautiful Moments" },
  { name:"Noto Nastaliq Urdu",label:"Arabic Nastaliq",  preview:"لحظات جميلة" },
  { name:"Noto Sans Arabic", label:"Arabic Modern",     preview:"لحظات جميلة" },
  { name:"Markazi Text",     label:"Arabic Classic",    preview:"لحظات جميلة" },
];

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&family=Noto+Sans+Arabic:wght@300;400;500;600;700&family=Londrina+Solid:wght@400;900&family=Playfair+Display:wght@400;600;700&family=Dancing+Script:wght@400;600;700&family=Pacifico&family=Amatic+SC:wght@400;700&family=Caveat:wght@400;600;700&family=Lobster&family=Comfortaa:wght@300;400;700&family=Markazi+Text:wght@400;500&display=swap";

// ─── localStorage helpers (lang/reviews/projects — purely local, not Firestore) ──
function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}
function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn("Storage quota exceeded:", e); }
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
// Convert a File to base64 string so it can survive localStorage (used for editor images)
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
// Compress + resize an uploaded image file down to a small JPEG data URL so it fits
// comfortably inside a single Firestore document (1MB limit) without needing paid Storage.
function compressImageFile(file, maxWidth = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Image failed to load"));
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
// Renders each album page div to canvas via html2canvas, then packs them all
// into a single jsPDF document at print-quality resolution (scale: 2).
// Returns the jsPDF instance so the caller can save() or open it.
async function exportAlbumToPDF(pageRefs, title = "Miora Album") {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfWidth  = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pageRefs.length; i++) {
    const el = pageRefs[i];
    if (!el) continue;

    const canvas = await html2canvas(el, {
      scale: 2,                  // 2x = crisp at print resolution
      useCORS: true,
      backgroundColor: el.style.background || "#ffffff",
      logging: false,
    });

    const imgData   = canvas.toDataURL("image/jpeg", 0.92);
    const imgWidth  = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    if (i > 0) pdf.addPage();

    // Center vertically if page is shorter than A4
    const yOffset = imgHeight < pdfHeight ? (pdfHeight - imgHeight) / 2 : 0;
    pdf.addImage(imgData, "JPEG", 0, yOffset, imgWidth, imgHeight);
  }

  pdf.setProperties({ title, creator: "Miora by Layal" });
  return pdf;
}
const inputStyle = {
  width:"100%", padding:"12px 16px", borderRadius:12, fontSize:14,
  border:`1px solid ${PASTEL_PURPLE}30`, background:`${SOFT_PINK}15`,
  outline:"none", marginBottom:16,
  fontFamily:"'Quicksand','Noto Sans Arabic',sans-serif", color:DARK_PURPLE,
};
const primaryBtnStyle = {
  width:"100%", padding:"14px", borderRadius:14, fontSize:15, fontWeight:700,
  background:`linear-gradient(135deg,${DEEP_PURPLE},${DARK_PURPLE})`,
  color:"white", border:"none", cursor:"pointer",
  fontFamily:"'Quicksand',sans-serif", transition:"all 0.3s ease",
};
const pageShell = {
  minHeight:"100vh", fontFamily:"'Quicksand','Noto Sans Arabic',sans-serif",
  color:DARK_PURPLE, padding:24,
};
const backBtnStyle = {
  background:"none", border:"none", color:DEEP_PURPLE, cursor:"pointer",
  fontSize:14, fontWeight:600, marginBottom:24,
  display:"flex", alignItems:"center", gap:8,
  fontFamily:"'Quicksand',sans-serif",
};

// ─── Responsive hook ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn, { passive:true });
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function MioraPlatform() {
  const isMobile = useIsMobile();
  const [lang,            setLang]            = useState(() => loadFromStorage(STORAGE_KEYS.LANG,     "en"));
  const [currentView,     setCurrentView]     = useState(() => window.location.hash === "#admin" ? "admin" : "home");
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [reviewForm,      setReviewForm]      = useState({ name:"", rating:5, text:"" });
  const [reviews,         setReviews]         = useState(DEFAULT_REVIEWS); // seeded with defaults, overwritten by Firestore
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [projects,        setProjects]        = useState(() => loadFromStorage(STORAGE_KEYS.PROJECTS, []));
  const [scrollY,         setScrollY]         = useState(0);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [saveToast,       setSaveToast]       = useState(null);
  const [authUser,        setAuthUser]        = useState(null); // Firebase auth user (anonymous customer OR admin)

  const isRTL = lang === "ar";
  const dir   = isRTL ? "rtl" : "ltr";
  const t = (en, ar) => lang === "ar" ? ar : en;

  // ── Bootstrap Firebase auth (anonymous for everyone, until admin logs in) ──
  useEffect(() => {
    const unsub = ensureAuth((user) => setAuthUser(user));
    return unsub;
  }, []);

  // ── Load reviews from Firestore in real time (shared across all visitors) ──
  useEffect(() => {
    const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) return; // keep DEFAULT_REVIEWS showing until real ones exist
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn("Reviews listener failed, using local fallback:", err);
    });
    return unsub;
  }, []);

  // ── Persist to localStorage (only plain data) ──────────────────────────────
  useEffect(() => saveToStorage(STORAGE_KEYS.LANG,     lang),     [lang]);
  useEffect(() => saveToStorage(STORAGE_KEYS.PROJECTS, projects), [projects]);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", h, { passive:true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    if (saveToast) { const id = setTimeout(() => setSaveToast(null), 2500); return () => clearTimeout(id); }
  }, [saveToast]);

  // ── Project CRUD ──────────────────────────────────────────────────────────
  const createProject = useCallback((mode, occasion) => {
    const p = {
      id:        generateId(),
      mode,
      occasion:  occasion || "General",
      title:     "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pages:     [{ id: generateId(), background:"#ffffff", elements:[] }],
      status:    "draft",
    };
    setProjects(prev => [p, ...prev]);
    setActiveProjectId(p.id);
    return p.id;
  }, []);

  const updateProject = useCallback((projectId, updates) => {
    setProjects(prev =>
      prev.map(p => p.id === projectId
        ? { ...p, ...updates, updatedAt: new Date().toISOString() }
        : p
      )
    );
    setSaveToast(lang === "ar" ? "تم الحفظ ✓" : "Saved ✓");
  }, [lang]);

  const deleteProject = useCallback((projectId) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setActiveProjectId(null);
    setCurrentView("my-projects");
  }, []);

  // ── Routing ────────────────────────────────────────────────────────────────
  if (currentView === "admin") {
    return <AdminView authUser={authUser} onExit={() => { window.location.hash = ""; setCurrentView("home"); }} t={t} lang={lang} isRTL={isRTL} />;
  }

  if (currentView === "my-projects") {
    return <MyProjectsView projects={projects} onBack={() => setCurrentView("home")}
      onOpen={id => { const p = projects.find(x => x.id === id); if(p){ setActiveProjectId(id); setCurrentView("editor-"+p.mode); }}}
      onDelete={deleteProject} t={t} lang={lang} isRTL={isRTL} />;
  }

  if (currentView === "template-picker") {
    return <TemplatePickerView
      onBack={() => setCurrentView("home")}
      onSelect={(template) => {
        // Create a new project pre-seeded with the chosen template
        const pid = createProject("template", template.occasion);
        setProjects(prev => prev.map(p => p.id === pid
          ? { ...p, title: template.title, pages: template.pages }
          : p
        ));
        setActiveProjectId(pid);
        setCurrentView("editor-template");
      }}
      t={t} lang={lang} isRTL={isRTL} isMobile={isMobile}
    />;
  }
  const editorModes = ["editor-manual","editor-ai","editor-template"];
  if (editorModes.includes(currentView)) {
    const mode = currentView.replace("editor-","");
    let pid = activeProjectId;
    if (!pid || !projects.find(p => p.id === pid)) pid = createProject(mode);
    const project = projects.find(p => p.id === pid);
    if (!project) return null;

    const handleEditorDone = (updatedPages) => {
      // Count pages, detect tier, set package, go to payment
      const pageCount = (updatedPages || project.pages || []).length;
      const pkg = getPackageFromPageCount(pageCount);
      setSelectedPackage(pkg);
      setCurrentView("payment");
    };

    return <BookEditorView mode={mode} project={project}
      onBack={() => { setActiveProjectId(null); setCurrentView("home"); }}
      onUpdate={updates => updateProject(pid, updates)}
      onDone={handleEditorDone}
      t={t} lang={lang} isRTL={isRTL} isMobile={isMobile} />;
  }

  if (currentView === "payment") {
    return <PaymentView selectedPackage={selectedPackage} authUser={authUser}
      onBack={() => setCurrentView("home")}
      t={t} lang={lang} isRTL={isRTL} />;
  }

  if (currentView === "my-orders") {
    return <MyOrdersView authUser={authUser} onBack={() => setCurrentView("home")} t={t} lang={lang} isRTL={isRTL} />;
  }

  // ── Home ───────────────────────────────────────────────────────────────────
  return (
    <div dir={dir} style={{ fontFamily:"'Quicksand','Noto Sans Arabic',sans-serif", color:DARK_PURPLE, background:WARM_WHITE, minHeight:"100vh", overflowX:"hidden" }}>
      <link href={FONT_LINK} rel="stylesheet" />

      {/* Save Toast */}
      {saveToast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", zIndex:300,
          background:DARK_PURPLE, color:"white", padding:"10px 24px", borderRadius:30,
          fontSize:13, fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.2)", animation:"fadeInUp 0.3s ease-out" }}>
          {saveToast}
        </div>
      )}

      {/* Navbar */}
      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:100,
        background: scrollY>50 ? "rgba(255,254,249,0.96)" : "transparent",
        backdropFilter: scrollY>50 ? "blur(12px)" : "none",
        borderBottom: scrollY>50 ? `1px solid ${PASTEL_PURPLE}40` : "none",
        transition:"all 0.3s ease", padding: isMobile ? "10px 16px" : "12px 24px",
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <div onClick={() => setCurrentView("home")} style={{ fontFamily:"'Londrina Solid',cursive",
          fontSize: isMobile ? 22 : 28, color:DEEP_PURPLE, letterSpacing:2, cursor:"pointer", flexShrink:0 }}>
          MIORA <span style={{ fontFamily:"'Quicksand'", fontSize: isMobile ? 10 : 13, fontWeight:300, opacity:0.7, letterSpacing:1 }}>by Layal</span>
        </div>
        <div style={{ display:"flex", gap: isMobile ? 8 : 12, alignItems:"center", flexWrap:"nowrap", overflowX:"auto" }}>
          {!isMobile && <a href="#create-section" style={{ fontSize:13, color:DARK_PURPLE, textDecoration:"none", fontWeight:500, opacity:0.7 }}>{t("Create","أنشئ")}</a>}
          {projects.length > 0 && (
            <span onClick={() => setCurrentView("my-projects")} style={{ fontSize: isMobile ? 12 : 13, color:DEEP_PURPLE, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap" }}>
              {isMobile ? <Icon name="folder" size={18} color={DEEP_PURPLE} /> : t("My Projects","مشاريعي")}
              <span style={{ background:GOLD_ACCENT, color:"white", fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:10 }}>{projects.length}</span>
            </span>
          )}
          <span onClick={() => setCurrentView("my-orders")} style={{ fontSize: isMobile ? 12 : 13, color:DARK_PURPLE, fontWeight:500, opacity:0.7, cursor:"pointer", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4 }}>
            {isMobile ? <Icon name="receipt" size={18} color={DARK_PURPLE} /> : t("Orders","الطلبات")}
          </span>
          {!isMobile && <a href="#pricing-section" style={{ fontSize:13, color:DARK_PURPLE, textDecoration:"none", fontWeight:500, opacity:0.7 }}>{t("Pricing","الأسعار")}</a>}
          {!isMobile && <a href="#reviews-section" style={{ fontSize:13, color:DARK_PURPLE, textDecoration:"none", fontWeight:500, opacity:0.7 }}>{t("Reviews","التقييمات")}</a>}
          <button onClick={() => setLang(lang==="en"?"ar":"en")} style={{
            background:`${PASTEL_PURPLE}30`, border:`1px solid ${PASTEL_PURPLE}60`,
            borderRadius:20, padding: isMobile ? "5px 10px" : "6px 14px",
            cursor:"pointer", fontSize: isMobile ? 11 : 13, color:DEEP_PURPLE, fontWeight:600, whiteSpace:"nowrap" }}>
            {lang==="en"?"عربي":"EN"}
          </button>
        </div>
      </nav>

      {/* Hero — Cinematic Book Intro */}
      <CinematicHero isMobile={isMobile} t={t} lang={lang}
        projects={projects} setCurrentView={setCurrentView} />

      {/* Occasions — Animated Book Showcase */}
      <section style={{ padding: isMobile ? "56px 0" : "80px 0", background:WARM_WHITE, textAlign:"center", overflow:"hidden" }}>
        <SectionTitle title={t("For Every Occasion","لكل مناسبة")} subtitle={t("Celebrate your milestones with a beautifully crafted album","احتفل بمناسباتك مع ألبوم مصمم بعناية")} />
        <OccasionBooksShowcase isMobile={isMobile} t={t} />
      </section>

      {/* Create Section */}
      <section id="create-section" style={{ padding: isMobile ? "56px 16px" : "80px 24px", background:`linear-gradient(180deg,${WARM_WHITE},${SOFT_PINK}30)`, textAlign:"center" }}>
        <SectionTitle title={t("Create Your Album","أنشئ ألبومك")} subtitle={t("Choose how you'd like to build your photo book","اختر الطريقة التي تفضلها")} />
        <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", flexWrap:"wrap", justifyContent:"center", gap: isMobile ? 14 : 24, maxWidth:1000, margin:"0 auto" }}>
          <CreateOptionCard icon={<Icon name="edit" size={36} color={DEEP_PURPLE} />} title={t("Design Your Own","صمم بنفسك")}
            desc={t("Drag & drop photos, add stickers, text and decorations. Full creative control.","اسحب وأفلت صورك، أضف ملصقات ونصوص. تحكم إبداعي كامل.")}
            onClick={() => { setActiveProjectId(null); setCurrentView("editor-manual"); }}
            gradient={`linear-gradient(135deg,${PASTEL_PURPLE}20,${SOFT_PINK}40)`} isMobile={isMobile} />
          <CreateOptionCard icon={<Icon name="ai" size={36} color={DEEP_PURPLE} />} title={t("AI-Powered Design","تصميم بالذكاء الاصطناعي")}
            desc={t("Upload your photos and let our AI create a stunning layout automatically.","ارفع صورك ودع الذكاء الاصطناعي يصمم تخطيطاً مذهلاً تلقائياً.")}
            onClick={() => { setActiveProjectId(null); setCurrentView("editor-ai"); }}
            gradient={`linear-gradient(135deg,#E8D5FF30,${PASTEL_PURPLE}25)`} badge={t("Popular","الأكثر طلباً")} isMobile={isMobile} />
          <CreateOptionCard icon={<Icon name="template" size={36} color={DEEP_PURPLE} />} title={t("Use a Template","استخدم قالباً")}
            desc={t("Browse pre-designed album templates by Layal. Drop your photos into a ready-made layout.","تصفح قوالب مصممة مسبقاً من ليال. أضف صورك إلى التخطيط الجاهز.")}
            onClick={() => { setActiveProjectId(null); setCurrentView("template-picker"); }}
            gradient={`linear-gradient(135deg,#FFE8F020,#F5E6FF30)`} isMobile={isMobile} />
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: isMobile ? "56px 16px" : "80px 24px", background:WARM_WHITE, textAlign:"center" }}>
        <SectionTitle title={t("How It Works","كيف يعمل")} subtitle={t("From photos to a printed album in 4 simple steps","من الصور إلى ألبوم مطبوع في 4 خطوات")} />
        <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:32, maxWidth:900, margin:"0 auto" }}>
          {[
            { step:1, icon:<Icon name="image" size={28} color={DEEP_PURPLE} />, title:t("Upload Photos","ارفع الصور"), desc:t("Select your favorite photos","اختر صورك المفضلة") },
            { step:2, icon:<Icon name="edit" size={28} color={DEEP_PURPLE} />, title:t("Design Album","صمم الألبوم"), desc:t("Create manually, use AI, or pick a template","صمم يدوياً أو استخدم الذكاء الاصطناعي") },
            { step:3, icon:<Icon name="creditcard" size={28} color={DEEP_PURPLE} />, title:t("Pay via CliQ","ادفع عبر كليك"), desc:t("Choose your package and submit payment","اختر الباقة وأرسل الدفع") },
            { step:4, icon:<Icon name="package" size={28} color={DEEP_PURPLE} />, title:t("Receive Album","استلم الألبوم"), desc:t("We print and deliver your album","نطبع ونوصل ألبومك الجميل") },
          ].map(s => (
            <div key={s.step} style={{ flex:"1 1 180px", maxWidth:200 }}>
              <div style={{ width:72, height:72, borderRadius:"50%", margin:"0 auto 16px",
                background:`linear-gradient(135deg,${PASTEL_PURPLE}30,${SOFT_PINK})`,
                display:"flex", alignItems:"center", justifyContent:"center", border:`1.5px solid ${PASTEL_PURPLE}30` }}>
                {s.icon}
              </div>
              <div style={{ fontSize:11, color:DEEP_PURPLE, fontWeight:700, opacity:0.5, marginBottom:4 }}>{t("Step","خطوة")} {s.step}</div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:6, color:DARK_PURPLE }}>{s.title}</div>
              <div style={{ fontSize:13, color:DARK_PURPLE, opacity:0.6, lineHeight:1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing-section" style={{ padding: isMobile ? "56px 16px" : "80px 24px", background:`linear-gradient(180deg,${WARM_WHITE},${SOFT_PINK}20)`, textAlign:"center" }}>
        <SectionTitle title={t("Pricing","الأسعار")} subtitle={t("Your price is calculated automatically based on your album's page count","يتم احتساب سعرك تلقائياً بناءً على عدد صفحات ألبومك")} />
        <div style={{ maxWidth:700, margin:"0 auto", background:"white", borderRadius:20, overflow:"hidden", border:`1px solid ${PASTEL_PURPLE}25`, boxShadow:`0 4px 24px ${PASTEL_PURPLE}10` }}>
          {PRICING.map((p,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              padding: isMobile ? "12px 20px" : "16px 28px",
              borderBottom: i<PRICING.length-1 ? `1px solid ${PASTEL_PURPLE}15` : "none",
              background: i%2===0 ? "transparent" : `${SOFT_PINK}20` }}>
              <div>
                <span style={{ fontWeight:600, fontSize: isMobile ? 13 : 15, color:DARK_PURPLE }}>{p.pages}</span>
                <span style={{ fontSize:12, color:DARK_PURPLE, opacity:0.5, marginLeft:8 }}>{t("pages","صفحة")}</span>
              </div>
              <span style={{ fontWeight:700, fontSize: isMobile ? 14 : 16, color:DEEP_PURPLE }}>{p.price}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop:20, fontSize:13, color:DARK_PURPLE, opacity:0.5 }}>
          {t("Finish designing your album and the right package will be selected for you automatically.",
             "أنهِ تصميم ألبومك وسيتم اختيار الباقة المناسبة لك تلقائياً.")}
        </p>
        <div style={{ marginTop:20 }}>
          <HeroBtn label={t("Start Designing","ابدأ التصميم")} primary
            onClick={() => document.getElementById("create-section")?.scrollIntoView({behavior:"smooth"})} />
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews-section" style={{ padding:"80px 24px", background:WARM_WHITE, textAlign:"center" }}>
        <SectionTitle title={t("Customer Reviews","آراء العملاء")} subtitle={t("What our customers say","ماذا يقول عملاؤنا")} />
        <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:20, maxWidth:900, margin:"0 auto 40px" }}>
          {reviews.slice(0,8).map((r,i) => (
            <div key={r.id||i} style={{ background:"white", borderRadius:16, padding:24, flex:"1 1 240px", maxWidth:280,
              border:`1px solid ${PASTEL_PURPLE}20`, textAlign:isRTL?"right":"left" }}>
              <div style={{ display:"flex", gap:4, marginBottom:8, justifyContent:isRTL?"flex-end":"flex-start" }}>
                {Array.from({length:5}).map((_,si) => <span key={si} style={{ color:si<r.rating?GOLD_ACCENT:"#ddd", fontSize:16 }}>★</span>)}
              </div>
              <p style={{ fontSize:13, lineHeight:1.6, color:DARK_PURPLE, opacity:0.75, marginBottom:12 }}>"{t(r.text, r.textAr||r.text)}"</p>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:13, fontWeight:700, color:DEEP_PURPLE }}>{t(r.name, r.nameAr||r.name)}</div>
                {r.date && <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.35 }}>{r.date}</div>}
              </div>
            </div>
          ))}
        </div>

        {!reviewSubmitted ? (
          <div style={{ maxWidth:480, margin:"0 auto", background:"white", borderRadius:20, padding:32,
            border:`1px solid ${PASTEL_PURPLE}20`, boxShadow:`0 4px 20px ${PASTEL_PURPLE}08`, textAlign:isRTL?"right":"left" }}>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:DARK_PURPLE, marginBottom:20, textAlign:"center" }}>{t("Leave a Review","اترك تقييماً")}</h3>
            <input placeholder={t("Your Name","اسمك")} value={reviewForm.name}
              onChange={e => setReviewForm({...reviewForm,name:e.target.value})} style={inputStyle} dir={dir} />
            <div style={{ marginBottom:16, textAlign:"center" }}>
              <div style={{ fontSize:13, color:DARK_PURPLE, opacity:0.6, marginBottom:8 }}>{t("Rating","التقييم")}</div>
              <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
                {[1,2,3,4,5].map(s => (
                  <span key={s} onClick={() => setReviewForm({...reviewForm,rating:s})}
                    style={{ cursor:"pointer", fontSize:28, color:s<=reviewForm.rating?GOLD_ACCENT:"#ddd", transition:"transform 0.2s" }}
                    onMouseEnter={e => e.target.style.transform="scale(1.2)"}
                    onMouseLeave={e => e.target.style.transform="scale(1)"}>★</span>
                ))}
              </div>
            </div>
            <textarea placeholder={t("Share your experience...","شاركنا تجربتك...")}
              value={reviewForm.text} onChange={e => setReviewForm({...reviewForm,text:e.target.value})}
              rows={3} style={{ ...inputStyle, resize:"vertical", minHeight:80 }} dir={dir} />
            <button onClick={async () => {
              if (reviewForm.name && reviewForm.text) {
                try {
                  await addDoc(collection(db, "reviews"), {
                    name: reviewForm.name,
                    rating: reviewForm.rating,
                    text: reviewForm.text,
                    createdAt: new Date().toISOString(),
                    date: new Date().toISOString().split("T")[0],
                  });
                  setReviewSubmitted(true);
                  setReviewForm({ name:"", rating:5, text:"" });
                } catch (err) {
                  console.error("Review save failed:", err);
                  // Fallback: show locally even if Firestore fails
                  setReviews(prev => [{ id:generateId(), name:reviewForm.name, rating:reviewForm.rating,
                    text:reviewForm.text, date:new Date().toISOString().split("T")[0] }, ...prev]);
                  setReviewSubmitted(true);
                  setReviewForm({ name:"", rating:5, text:"" });
                }
              }
            }} style={primaryBtnStyle}>{t("Submit Review","أرسل التقييم")}</button>
          </div>
        ) : (
          <div style={{ maxWidth:400, margin:"0 auto", background:`linear-gradient(135deg,${SOFT_PINK},white)`,
            borderRadius:20, padding:40, textAlign:"center", border:`1px solid ${PASTEL_PURPLE}25` }}>
            <div style={{ marginBottom:12 }}><Icon name="heart" size={48} color={DEEP_PURPLE} strokeWidth={1} /></div>
            <div style={{ fontSize:18, fontWeight:700, color:DEEP_PURPLE, marginBottom:8 }}>{t("Thank you!","شكراً لك!")}</div>
            <div style={{ fontSize:14, color:DARK_PURPLE, opacity:0.6 }}>{t("Your review has been saved.","تم حفظ تقييمك.")}</div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer style={{ padding:"40px 24px", background:DARK_PURPLE, color:"white", textAlign:"center" }}>
        <div style={{ fontFamily:"'Londrina Solid',cursive", fontSize:24, marginBottom:8, letterSpacing:2 }}>MIORA</div>
        <div style={{ fontSize:12, opacity:0.5, marginBottom:16 }}>by Layal</div>
        <div style={{ fontSize:13, opacity:0.4, marginBottom:8 }}>{t("Amman, Jordan","عمّان، الأردن")} · {t("All rights reserved","جميع الحقوق محفوظة")} © 2026</div>
        <div style={{ display:"flex", justifyContent:"center", gap:20, marginTop:16, flexWrap:"wrap" }}>
          <a href="https://instagram.com/miorabylayal" target="_blank" rel="noopener noreferrer"
            style={{ color:PASTEL_PURPLE, fontSize:13, textDecoration:"none", opacity:0.7, display:"flex", alignItems:"center", gap:6 }}>
            <Icon name="instagram" size={16} color={PASTEL_PURPLE} /> Instagram
          </a>
          <a href={`https://wa.me/${LAYAL_WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer"
            style={{ color:PASTEL_PURPLE, fontSize:13, textDecoration:"none", opacity:0.7, display:"flex", alignItems:"center", gap:6 }}>
            <Icon name="whatsapp" size={16} color={PASTEL_PURPLE} /> WhatsApp
          </a>
          <span onClick={() => { window.location.hash = "admin"; setCurrentView("admin"); }} style={{ color:PASTEL_PURPLE, fontSize:13, opacity:0.35, cursor:"pointer" }}>{t("Admin","الإدارة")}</span>
        </div>
        <div style={{ marginTop:16, fontSize:11, opacity:0.25 }}>{t("Projects auto-saved to this device","المشاريع محفوظة تلقائياً على هذا الجهاز")}</div>
      </footer>

      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes floatBook { 0%,100%{transform:translateY(0) rotateX(3deg)} 50%{transform:translateY(-8px) rotateX(3deg)} }
        @keyframes openCover { 0%{transform:rotateY(0deg)} 100%{transform:rotateY(-155deg)} }
        @keyframes revealInner { 0%,70%{opacity:0} 100%{opacity:1} }
        @keyframes bookFloat { 0%{transform:translateY(0) rotate(var(--tilt,0deg));opacity:0} 8%{opacity:0.7} 92%{opacity:0.7} 100%{transform:translateY(-110vh) rotate(var(--tilt,0deg));opacity:0} }
        @keyframes scrollDot { 0%,100%{opacity:0.3;transform:translateY(0)} 50%{opacity:1;transform:translateY(4px)} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes overlayIn { from{opacity:0} to{opacity:1} }
        *{box-sizing:border-box;margin:0;padding:0} body{margin:0}
        ::selection{background:${PASTEL_PURPLE}60}
        textarea,input,select{font-family:'Quicksand','Noto Sans Arabic',sans-serif}
        @media(max-width:768px){
          .desktop-only{display:none!important}
          .mobile-nav-wrap{flex-wrap:nowrap;overflow-x:auto;gap:8px!important}
        }
        @media(min-width:769px){
          .mobile-only{display:none!important}
        }
      `}</style>
    </div>
  );
}

// ─── Cinematic Hero ───────────────────────────────────────────────────────────
const LAYAL_BOOK_IMAGES = {
  dad_always: {
    src: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAFQAPADASIAAhEBAxEB/8QAGwAAAgMBAQEAAAAAAAAAAAAAAgQAAQMGBQf/xABJEAABAwMABAkICAQEBQUAAAABAAIDBAURBhIhMQcTNEFRcYGRwRQVIjZhcnOxIzJCUlNikqEkM9HhFiU1Q3SCorLwFyZjwvH/xAAZAQEBAAMBAAAAAAAAAAAAAAAAAQIDBAX/xAAyEQEAAgEBBAUMAwEBAAAAAAAAAQIDEQQSMVEhI0FhcQUTIiQygaGxwdHh8DNCkRTx/9oADAMBAAIRAxEAPwD6QoVFFBFSipBFShVIKVKKsoLVKKBQWqRYUwoBKpGQqwgAqkZCrCAFEWFMIBVFFhUQgA71AVTt6rKo0CMLIFGCg0CMLMFGFQQVoQiQWrVKKiwooooKVK1RQUqUKpBSFWVSCIgEIWjBtWIIDYr1VoG7FeoistVVqrbUU1FEYFqrVW+opqIMNVVqpjUVaiBfVQlqZ1EDmbFVJP2FAtJRgrHKI0BWgKxBWjSqNQUYWYKNqoMIkIVoLVqlaotRRRQUqKtUgEqirKEoKVKFUoCC3p2cZK1g3k4S4TdCf4yL3lA/FQySRNe3Vw4Z2lH5tm/J3p2k5HD7viUwFFeX5tm/J3qebZvyd69ZRB5Pm2b8nep5tm/J3r1lEHk+bZvyd6nm2b8nevVUQeT5tl/J3oTa5T9zvXrqkHFV7eJqZIiRrMODhKayO8SEXytbndL4BKhyqGmlaNKXYVs0qjdq0asWrVqoMIkIKJBatUrVEUVqKClStUUAlCURQlAJVKyhUFhN0PLIfeSgTVDy2H3lCHQ0nI4fd8SmAsKTkcPu+JW4UZCS1xrorZbqiunDzFAwvcGDLiB0JleLpf6n3b/hneCzx1i14ie2WGS01pNo7IXa9KLdd7ZVV1MZQylBM0b2gPbgE7s42gHG1KVOm9rpLVb7jLFVcTXBxjDWAubqnB1hn5ZXG0tKLBBdo45XuirLC2p9LeHEgEd7jjrQxUDLjbtGbRUve1orqume5mwjBzsyvQ/5cW9r2a/DSZef/wBWXd06N7T46xHyfUaWqhraWKqppBJDK0PY4c4K2XL6AOeNGBTyHJpqmaHPU7+66hcGWm5ea8nfivv0i09qlSJUVrZvnd6P/uCu+L4BLtK3vfrBXfF8AlWqhphW7ClmJhiqN2latWLVs1UaBEhCJBESpWqLUUCigpUVaooBKEoihKAShRFCgsJqh5bD7yWCaoeWQ+8sVh0NJyOHq8StwsKPkcPUfmUwFFWvF0v9T7t/wzvBevLLHBE6WaRkcbRlz3uDQB7SdyQu8NNdbZNazWRRPrYXNjOsC4jfrNbn0h1LZjnS8TPNryRNqTWOT5hXXSO50lVJTB+pTWinoySMZeZWZ+RHYjpLo+hq6GrukT4ZKa7zyzxtZtaXRtOA3rXTU2hdto7NVUXnhhkbUxTVU7tUagYchhGt6I9pPOpetDaK63GrmN8jpzNIKx0Ya0lrdQNLtrt2zOdy9ONowa7vZ+Ij7vMnZs+m92/mZ+x7g+LpNGn1Dm48oq5pcdZ/sV1S8+2Q0FroKO3Us8fFtj+hBkBdIN5cOnnJITcFTBVR8ZTzxTMzjWieHDPRkLzctt+82jhL0sNdzHFZ4w0VFWqPOtTa+c3v1grvi+ASzUze/WCu+L4BKtVQwxMMS8aYYqjdq2asWrZqoNqNC1EgtWqRKiKK1SClRRISoBKEoihKACqVlUgsJqh5bD7yVCboeWQ+8sSHQ0fI4eo/MpgJej5HF1H5lMBRk43hUkeOD6up4xmSqkhp2N6S6Ruz9ly1pqfLNJuDOY4J81TNJ9rY9U/Je3ws3IW+1WM8Q+o/zaKUwx/WkEYLtUb9+xchoTUipvfB/sIMUdxiwd4w5xA7iF2469Vr4/KXPafT/wA+Z/SmRlK3hQhJY187KR7GnAL8sGcdPOUMcflfDAbbKB5PNaBbHEjnNMH4XicKz6iLTe400UbjHVU9M6QjmBHFjPbhNxXlreGERCnk2aQ6gqPsY4nidTr5962VrO5rHbH0hjMxvaTz+7n5rnVTWF7mEtnsdkNBI4b2PfU8Wer0Nnavo/Bjo7XaM3e50rXS1FoqaWnqIKrU1Y5JCMnVwcbnEdQC8qzU2j7qPT+vvMnk1orbmaQyAE6uHE5GAduu4EbOZenwZwVej2kl/wBE5K3yykpWRVNPJjAAeAdg5shzSRuyPapltrS0R+8PlK0j0omX01QqKLz3Q+b3z1grvi+ASrU1fPWCu+L4BKsVDDEyxLRplnMqjdq2asWrZqo0CJC1GgitRWqIorUUFISiVFABQlEUJQAUKIoUFhN0HLYfeSgTdBy2H3liQ6OjB8ji6j8yt15FfRuuGjM9KySRj5IXBro3FrgQcjBG0HYvA4OZLnUUFXLcpZ5HwvFMHSSFwkLdpeMnfgtGVnFNaTbXgxm+l4rpxetfdH6i76R6O3Bk8TKe1zyTyxuB1nktAbq42bPavn124ILxXaop7tRRMjq6maLIkBayVzXAZA3jBX2JRWma9OC2pFuL5bTcFVd5EyKsulPLM2mhg4zVe7ayqMx37cFuG9fsXpDQG4i1mNtfS+WDSHzy2Qh2rjP1enOOxfQFFZzXntPN1cJR8Hrv/Tms0ZrquN1TVTSVDqmJpLWyF+s04OCcYAPaj4PNA5dDo62eurWVdfV6rXPj1tVjG7gC7aT/AEAXcKKTlvMTGvE3K6xKlCvGvVVWmqp7fbpmQzyMdK+VzdbVYCBsHtJW9krZ62261UGiqhkfDNqjAL2nGR1jB7VJxzFN8i8TbdcTfPWCu+L4BKNTd89YK74vgEo1YMjMaZZzJaNMsVQw1atWTVs1UG1GhaiQWrVK1RaiiiClRVqioAKEoygKAChRlCggTdBy2H3koE3Qcth99YkOgpjq29js4w1xyebeue4PJaR+iwZQtIpoqmVjCT9baCXdpJK9qXbYJhrBmaeUax+zsdtXOcGdTHPo7PHTRFlHBUcVTkjbIwNaNftcHFbax1Vp74arT1tY7p+jspZY4IXzSvDI2NLnOO4AbyvEg0st84icIK5rJgHRONOTrg8+ASe8J2/U76qx1kDON1nM3RHDyAQSB7cAr5u2eKBgjbV1jn0PowS60TmuGPQBaWgnmGN4XNabzaK05Tx+Hx017nVSkWfVIKiKqgZPBI2SJ4y17TkELUbdwXO6HRVFPZ5YaqRskrJ3FzmjA1iGucMc20lTSGWWKrp8ueYDG4lgcQC4H54IWrLtNceLzs8Oj4sseKb33IdEovOsT5JLTFJI4uLi4tJOfRycdi9Fbcd/OUi8dsasL13bTXk5vSanZFLBc9YtfHG6EAEjJJBG7tTWjNLJS2Rhm1uNne6d+tvy47M9gCPSEtbb2PcMlsoLR+bBwm7aHNtdM15y4RgE+1dc3nzMR3ueKx5zVwd89YK74vgEm3enL56wV3xfAJRu9aG0xGmmJaNMs5lUbtWzVk1atVGgRIQiQWrVK1RaiiigpUVaooBKEoihKAChRFCoLCaoOWw++EqE1Qcuh99SR6Vya1+iNax7wxrqSVrnH7IIcCVzfBjUOqaC4SMZxdEZI20cZ3iJrS0HtIJXvX1kMmhFwZUScXA6lkbI/wC60k5PcuZ4LpZKk3SrcBFDUCI00H4cLdZre/aumkdRafBz3nr6x4voq4q5l9x03FvcI3276JtW17MkvwXBoOef0QRg7Au1xk46VwVLVGS5Gskb/MuzhCAckgSapeegBox/+rhyzSIjfjXpjTx/HF2444u4gp4aWBsMETIomj0WMGAF5GkrWS0kUbmhxLi4ezZjxXtrwr87FRT9AY4/uFx+VLbuyX93zht2T+aHsUha6jgcxoa0xtw0DAGzctikrU7WtlOehuP3KdK7MN9/HW3OIabxpaYeLpG5rKSB5GdWXWA6Tg4+abtGt5pp9c5dqnJ9uSktIg3iad7z6Mb3PP6dnzTNk1/NEWv9fLiR0ZJOF1z/ABR4tEe24q+esFd8XwCUamr56wV3xfAJVi0thmNMsS0aZZzKoYatmrFq1aqNAiQBGgtWqVqi1FFFBSoq1RQCUJRFCUAFCiKEqCwmqDlsPvpQJug5bD74UIa6TxQTaBV8dTIY6d0OJXjmZrgn9lzHBfK+puVyrpcRGsgYaam/Dp2OLWd+Sui0vggqdAaqKql4qmcGmV/QwSBx7wMdq5Xgyl8p0iq7hP8ARy1tITTU4/26dj2huz2krrxx6vb95OXJPrFf3m+qg4cD7V8zsrnm0sqXY4yR5e38kYm1iesnw6F9ImdqQSO6GOP7L5ra2yt0dpYWPxJJE2SV4H1Ga2xo9p2/uehebnvNYrFI1tM9Hdzn/HpYI4vpzvrHrK52/wCTWRAc0fiV0TvrHrK5u+uPl4A2nixgd64PLU6bJPjDZsX8r1LMc2yL2Fw/dPleZYXB1t2bhI4fJemV17DOuzY57o+TVnjTLbxeFpCNc0rHbIwXPf1DGAmLBI+W2GR+zWkcQDzA7kppD9LPTU4+21xd7G5Gf6JjR6Uy0c5xhomIZ1YC9OY6mHJr6f7+/wDrj756wV3xfAJViavnrBXfF8AlWLnbTMaZYlo0yxVDDVq1YtWzVRoESBqNBatUrVFqKKKClRVqigFCUSEoAKEoihKggTdBy2H30oE3Qcth95RS+nFPFV6BuhqJRFTGaN07if8Aba8ud8sLluDedsulhrKhupU19JIaeEboaZhaGjt8F0entMyr0Iiinl4ulFUySpdnH0TS5xHbgBctoBUj/GFLVVEerV3OKV0Uf4FMxvoD2Zwu7FHq9ve4cs+sVfXahpdTStG8xuA7ivnNsic6wU8QeSTEx8zhsJ3YaP8AzcPavpQOCCdy4GCj8mmitjCTq1bWSHnJ4z0R1aoB6gOleVnm+kVxx0zOmvKO162Cfad+76x6yuZvRxc3fDb4rpScknpXL3k612kHQxnyXm+XJ9V98Nmwx1vuelYD/Byj/wCXP7BesvG0fJ4icE7nj5L2CuryZOuyY/Bq2noy2c/pAcVEbWfzZGcWD0DJJK3sL26tTFGMMic1oPTs2pW960dw47e7imsiHtJOfBbaPnVdVQtGWxhgL+lxySvZmOpcf9/39/YcrfPWCu+L4BKsTV89YK74vgEqxcraZjTMaVjTLFUMNWzVi1bNVBtRoGo0Fq1StURRRRQRUrVIKQFEUJQAUJRFCVFWE1Qcth95KhNUHLYffCivQuVmp7/ozLbKoZjmbv6HB2Qe8LluDuxVQuN10gudMYKmSV1HTwuH8qJhwcdZGOw9K7uk5HH2/MrYLZXLaKTSOEtc46zeL9sCXlG0E6RNuIezidTWMePS40DVDujGr+4C9QkAEk7AMpanr4KqV0cevkDPpMIBHsWttjXjBpclf2SwXY1Dh9HIwBp6cDaOtdal6ykirqZ0Ewy0843g9I9q4fKGyztWCccTpPGG7Zs0Ysm9PB5OjTZDHUyOB1HuaGnpIBzjvXukHoKzihZDA2CJuqxrdVoC4iwVM1VpZFAyZ/EU0Uhe0POC7Gqcj2Erq2DY5xbPua+zDn2radcuuntOpvFIZ6Xjo4y+eAFzGjedm0I7VRGhtzInbZXenKelx3/07E8qW7fnd3U3Y11fOr56wV3xfAJRiavnrBXfF8AlWLFTMaZjSsaajVDDFq1ZN3LVu5VGgRoAjQWrVK0EUUUQRUrVFAJQlEUJRQFCURQqCwmqDlsPvhKBN0HLYffCxZOho+Rx9vzK3C8G+1E9LoRcp6V7mTx0spY9u9p27R7Qvm1n020ustqp6yvpZLha3t9GedpOwHH81ucbQfrZWNrxWdJbsWzXy1m1Zjlx0fZyA4Fp3EYXi6Pgu41zsl0YEeTz8+f2C30evkGkVlp7pTxvjZLkFjyCWuacEZG/dvWdkIEk7B15POcn+qzidYYxE1i0TxetLLHDGZJZGRsG9z3BoHaUX2dbmO48y5LhHpJKvRGQMJ1Y5o3vAGdmSPmQuVq9F7to/ZxdbPeny0gjEmI3OgcGuxghuS07xs2Lfjw1vWJm2ky475ppaYiuuj6uN4XJaPFrtI66UNAMgeAQN+H5XuWSpmqrBQVNQ7WmfTse9xGNY42nt3rnrHM1l7giaNr43lx6BjZ34KuKJit4YZZib0l2CnSkbnc2W2NjjE+V7yQ1jSBu3kk7t60oK1lwpBUMY9mSWlj8ZaR1Ln0de7Om9p0ODvnrBXfF8AlWJm+esFd8XwCVYiGo0yzmSsaajVQwxbNWDVs1VGgRoGo0Fq1StBFFFSC0KtUgooSrKEqKEoSiKEqKiaoOWw++lU1Qcuh99RXuxQx1NrMEwzFKx7Hjpacg/sV8wtV1qNEtB9JLfI7+JpK00lOCN7pG4z7dgLl9TpORx9vzK+dS258nDYGSM42B0ba4xuJLQWxajX6u7IcMArC/ZMOnZpiYtW3Dj/n3jV1mhNplsWiFBRTjVmDDLI0/Zc462D1DAWliINS6TJxIw6gP3QRt7cr2ZTiJ5P3T8l4lnOaxrtzdQsYOof2WysaRow3pvFrT2vYrqSK4UE9HN/LnjdG72Ajf2b1818rnuFktmiMcoNd5XLT1LQclkcbj6RHRtyOnVC+olcBo7Rk8Jd6micHU9Pxh1sja6QjYOoh4PUt+CdImeXT7+H1efnrrMRz6Pdx+jtpGx0dueyNurFDCQ1vQ1rdg7guOsmIbnSSzECWaXVx7S07OwbO9dddXalpq3DfxRA7dniuCppuO0ipHNOYqWZrQc73ZGsexbdmrrSzVtM6ZKOq0jj1m0jyMtDnAnsB/+qZsGTatc/7kj3DqzjwQaS00dVZnwS62q6Rm1ry0gh3MRtBTVqDBaKQRt1WCJoA6ti5NfRerNupiO9w189YK74vgEqxM3z1grvi+ASrFGg1GmWJaNMMKqGWLZqwYtmqo1buRIGo0BK0KJBSitUgipWqKAShKIoSooShKsoVFWE3Qcth99KBN0HLYfeUZPfpORx9vzK+faM3SW4cLt/cX5iEDoGjobG9oH75719ApXiOiY87m6zj2ElfI+Cp5qtNLjUuzl1LI8n3pWla7z6VYdWz0icWW89kR8Z/D6/VH+Em249B23sXjWstdWRlp9BmY2+042r1bgHG31AY7VcYyAejK8Wg1W10DWnVhieI2/mduW6ODTjj0JdIXagLvujPcvnHB9Lr6R1v5qTXdneSZBt+a725zcRaKyYnGpTyOz0eiVwHB0B/iCuxuZRMaesv/ALLpwx1OSfB5uaevxx4u8u8EtTaKuGD+c6I8X7XDaB+y4G3QkSUNPCfpKiZjQT0Z1nO7gT3L6Wuco7LLDpjVVz2/wrYc055g559IdYwexwUwZYpW0SufDN71tB3SB/8Alwxs1pWj5rWzOD7RARzBze5xSmk79S3RHOPpR/2uWujxPmdgcfSD3g+zbnxXP/V6Ux1ET3/Rx199YK74p+QSjE3fPWCu+L4BKMUaDMZTLClo0zGqhhi3Yl2LdqqNWo0DUaC0SEIkEVK1SCKirQlBRQFEUJUUJQqyhJUZCam6DlsPvpNqboOXQ++op+6VPkeiNfUZxxdLM4deHYXzTgdjPn65u+5Rsb3yf2XaacVHk/B1cDnbI0RD/mkA+WVyPA23N0vL87oIR/1OK02nraw9DBGmw5bc5iPl931K6GTzbPxQy/VwO8LxqVgbW08TNrYnjb0kn/z910T2CRjmO3OGCvEtsLm3BsJOTDrOkPS7cPmuiODjx29GYbaVSmLRa4ubvMOoP+YgeK5Lg1bm6XV+N0MQB5yC5xXv6eSamisjCcCSaNp6s6x/Zq8Hgxa51XepXbzxLerY7YuzHGmy2nv+zysk67XWO77voihUUK4Xe8HScZpaYH6vHZPY0rTRpxdbJAd4md8gUvpU7EFIAdpkds6dm5a6NEeR1DM5xKM9rQs/6uuY9W97lL56wV3xfAJRqbvnrBXfF8AlGrFyGWJiNLMTMaqGGLdqwYt2qo0atFm1aILRIUSClFFEFISiQFBRQkqygKihJQkqygJUZNGlN0HLoPfSTSnLfy6D31irxOE6o4rQemhztmrGjsbrH+i8rgZH8TfHflgH/cr4WJXebLJBg6pkneTzZGB4lMcD1BVU8F0q5Yi2nqeLMT+Z+C8HHVjatHHM9WNK+TfGfr+H1BYx07I6iWYfWkxkdGFsouh5GrjuEWXVtVFETgPqC49TWnxISXBj6QvbiMHyiNueppWnCU2RtLbqjIEMb5A49DiBjPYHdy9DQGyvtFhdNKTxle4VJY4YLAW7Gn59q7ptEbLEc5cMVmdrmeUOrUKiorhdzndKXBraPI3OeQewKaKuJhqwed7T+x/og0raXvomjcS/P/Sq0WdmWsA3arMd7gtn9Xdp6p+83PXz/X674vgEo1N3z/X674vgEk0rBwmWJlnMlY0yxVDLFu1Ls5kwxEatWizatFRatUiQCooogpCVaEooSsyUZKzJUAkoCVZKAlRRhydtxzXQ++vN1k5bJB5wgBI+uoq9MNHZdI9E2U9K1prIZhJDrHA+sQ4Z6jnsXv2S0wWOzU1tpyXRwMxrH7Tjtc7tJJWtHUQ+SsBljzk/aHSt+Ph/Gj/WFN2NdWc5bTSMevRHS1UWfHw/jR/qCnHw/ix/qCrWWutqpLzRtpaxhfCJWS6oO8tOcdR3H2FOrPj4fxY/1BXx0X4sf6grrOmiaRxGoVnx0X4sf6gpx0X4rP1BRSd4ojXW+RjB9M304z+Yc3aNiwsFH5JbQ5zS2SY65BGCBuaD2fNekZovxY/1BTjoj/us/UFdejRn5y25udj55ff9frvi+ASTU5fCDfq0gggy7x1BJNRgajTDOZLRpiPmVQ0xbsS7OZMMRGzdyNA3cjVBK1StBSoqKIBQlEUJQZlZuK0csnKKBxWbiicsnKKBzlhK86pHStHlLvKDzpIGl2cDuWXEN6B3Jx6yKMS/Et6B3KuKb0DuWxVIMuKb0DuU4pvQO5alUgz4pvQFOKb0BaKIoOJb90dyJsTfujuR4RgIDaMDAWrVmAtWhBuxMx8ywYExHzIGGJhiwYt2Ko2ajQNRqglapWgFRRUgooSiKEoM3LJy1dzrJyisnLFy1csXKDF6wct3rByBd6yK2csSgAoURQlBSiiiCK1MKwEFgLRoQgLRoQEAtmhAAtWhBswJhnMsWBbsG5UbMTDVgwLdqI1ajQNRqglapWgFQqKIBKEoihKDNyyctnLJwUVi7nWLls5YuCgwesHJh4WLggXcsSt3BYkKDMoSjIQkIBKgV4UAVEARAKAIgFBYC1aEAC1aFQQG1bNCzA2rZoQatC3YNyxaFuwKjZi2asW8y3aiDajQtRKglapWg//Z",
    occasion: "Family",
    title: "Dad Always",
    spineBg: "#e8e0d0",
    spineText: "#8090b0",
  },
  yearbook_2026: {
    src: "data:image/jpeg;base64,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",
    occasion: "Travel",
    title: "2026 Year Book",
    spineBg: "#f0ece4",
    spineText: "#c04080",
  },
  miles_memories: {
    src: "data:image/jpeg;base64,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",
    occasion: "Travel",
    title: "Miles & Memories",
    spineBg: "#f0ece4",
    spineText: "#c04080",
  },
  forever_starts: {
    src: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAFQAPADASIAAhEBAxEB/8QAGwAAAgMBAQEAAAAAAAAAAAAAAwQBAgUABgf/xABBEAACAgEBAwgIBQMBBwUAAAAAAQIDEQQSITEFEzJBUXFysSIzNGGBkaHhFBWSwdEjQlNSQ1Ric4Lw8SREVcLS/8QAFwEBAQEBAAAAAAAAAAAAAAAAAAECA//EABgRAQEBAQEAAAAAAAAAAAAAAAABESES/9oADAMBAAIRAxEAPwD6I2UkyWykmBWTBSZaTBSYFZMDJl5MDJgVkwUmWkwUmRUSZVnNkGaqpBbB2DKqMqEaK4CqM4u0RgChJbZOwBVFjsE4KiUEiwRZPeWIYiwkWLqQSMjSGYsNFi0ZBYyKhiLCJgIsKmAZMumCTLpgXbByZZsHJgUkwMmXkwMmBSTBSZaTAyZBWTBtkyZVsK4lIhIJGJmrEKJ2yGUCdgy0XcSNkY5s7mwF3EjZGebO5sBbZO2BjmzubAX2SNkY5sq4ALtEBJxwDZYlXTLxkAyXjI2yZjINCQrGQaEghqLCpi0WGTKDphEwEWFTAu2Dky7YKTAHNgJMJNgJsAcmCky0mBkyDmyMlcnIlUWKGK45A1rI9p63KSS4vdvM1qIjWW5sYrpnKLeIcWuPZ8C/MT7IfP7GdawpzZ3NjnMT7IfP7HcxPsj8/sQwnzZ3NjnMT7I/P7HcxPsj8/sNMJc2dzY7zE+yPz+x3MT7IfP7AwjzZSVZofh59kPn9iHppvqh83/BdMY9scC0h3VR2LJReMp4EJs1GarneSpAnLecpGoyajIPCQnGQeEiocgw0WKwkGiyhmLCxYvFhosAjBSYRgpABmxabDTYtNgDmwLZabBNkVOd5aL3gs7y8XvJQ3UaWj9bDvMyo09H62HeYrcO0+rfjl5hAdXq345eYQy04444g4444DjjjgOIJIKMDXv/ANZcv+IzrGPcoe3XeIz7GajNBlLecpbwcnvIUjcYNRkHrkJwkMVyKHIMYixStjEGVDMWHixeAePAAzATDsBMBewVmxixis2ACbBNl5sC3vIqU94WDAJ7wsGSh2k09H62HeZlJqaP1sO8xW4dq9W/HLzNfRckw1WljdK6cdrO6MVuwzIq9W/HLzNqFeos5DpWmclJTk3sy2d28kWuo5GhZbep2WbEJ7EcYTe7i/mRpeSqZPUR1E5J1WbCakop7s5B2WTXI2lltS2pXuTbe9tZH9ZRPUV66qqKlOU4NJvHUi8TpSPI8fx86JWz5vm9uMklnjjDLW8i1VzUVdbvhKSylxWP5HsNamNSlmyOlabz15S/YzOT67qOVo0XyblsST9NyW9ZGQ2qaXk6Gop085Wzi7pyjhJbkk3+wxfyNTTzT521qdsYPOFufwL6T0HyXD3WSFeZvo5XojdJvasUkttvdlkOi63kmqrTTt09km6+lGTT7+5mSb0qJ6erlO6xJQty4rPHjv8AqYIqx5vlH267xGdYzR5S9uu8RmWssSlpveVT3nTe8pnebjBiLGK2KQYxWyh2tjUBOtjcGEMwGIi8BiPAoLIBMPIBMBWwUsG7BOwBebAt7ws2Ab3kVKe8NWxdPeHrZKHqDU0frYd5lUGro/Ww7zFbh6roPxy8zbq1U9JyHVOEYycpyi9rseTEq6D8cvMflqoS5Lr0uzLbjNyz1Y3/AMki0WacuRNIlvxe4/PJrc9Gq/VzfCNlcX8Ul+5lcncpw0lU6rYSlHO1HZxxBy16np9XCcJbd81JNcI8P4GpjQpVlXLGtcpOT5pyi32dRn6PUW28sUXW9KUkm9nC4YGo8r0rUQvlVZt81sSxje8p9veU1nKteot084QsXNWbb2sb+7eUMuPN8saKn/RW188iPP238sUyt/st2ViON2SZco1y5Wjq9iexGONndng/5GNRyzTcq0q7fRsjN5xwT7wCcrSldopuLaVV2zOK6+zzRhGj+Y1SlrVKux16jfFLGU8GcSrHmuUvbrvEZdrNTlP267xGVayxmlZveDzvLze8HneajI0GNVikBqo0HKxusUqG6yoZgMxF4DMeABJC8xiQCwBSwTsHLROwBWYFsLMC+JFcnvDVi64h6yUP0M1dF62HeZNHUa2i9bDvMVuH6eg/HLzCA6eg/HLzCGWnHHHEHEEnLc0+HvQBXpNQmk6Zpt4XfnBEtPdFJyqkk8Y9+f8AwNR1OnhOXouScs9HCe/PD3/QEr6k4yfpOM08OHfn57txcidCWl1Dxime/h/38GCH/wAVp23lL0ks/wBLOOPVnf1fIQQV5rlP267xGTaavKnt13iMm01GKUm95TO8tPiUXE1GRoDVQrWN1Gg5UOVidQ5WVDUBiIvAZiBeQCwYkLzAUsE7B2wTsAUmAlxDzAS4kVVcQ1YFcQ1ZKHqOo1tF62HeZNBraH10O8xW40Kug/HLzCFKug/HLzLmWkkEkEHHHHAccccUccccB5jlT267xGRca/Knt13iMi41GKTnxKriWnxKriajI1Y3UKVjdRoOVDtYnUOVlQ1AYiAgMRAvIBMYkgE0ApYhOxDtiFLEAnYheS3jM0Akt5FDS3hoAkt4WBKHaDW0Prod5k09RraH10O8xW40aug/HLzLlKug/HLzLmWkkHHEHHHNpcWiNpdqAscQSBBxJBR5nlT267xGPd1mxyp7dd4jHuNRik58SFxLS4lVxNRkatDlQpWOVI0huocrFKkOVlDUBiICCGIgEkgE0HkAmArYhOxDtiFLAE5oXkt4zMXlxIoYWAMJAlDlJraH10O8yaeo1tD62HeYrcaNPQfjl5lylXQfjl5hDLTgsI11QVlyc9rfCtPGV2t9S8wcI7dkYL+5pB65bd9l+dlR6LS6K93clu9+ALLVatLFNfNx7KqcfXDZD1euS/qSslHrVlSa+qCW2uEFKaufavxknKOd6zu3E1WqUNrb1FeXiONVJt444WPPBULS2LoOdcFCcVmUI8Gu1dnvQINc3XfG5Y2s5eFubXH58fiDsioWSiuCe7u6iKqQScB5jlT26/xGRca/Knt13iMi01GKTlxIXEtLiQuJuMj1obqQpX1DlRUN1IcrQpUOVlDUEMRAQDxAJIDMNIDMBWwUsQ3YKWAKWC8uIzYLy4kAy8CnWEgSqbp6jW0Prod5lU9Rq6H10O8xW40aug/HLzCA6eg/HLzLmWhad1m1/pjJ/Rl6YSlp5QhCUpSziMVlvGz9wdXGf/Ll5E12VqLhbXKcc5TjPZafyAZs0mplz+NPZmViabjxW/7EfhNSpaeK08/Rw20s728/QA56b/dG/fK5v9iFZp8+xx+FshxF9RFxhGMk1JYymt6zFfwDt4xfbCL+h1lkJJRrr2I5y8zcm33nWcKv+WvNhVDjjgPMcqe3XeIybjW5U9uv8RkWmoxSkuJC4ky4kR4m4yYrHKhOsbqKh2ocrE6hysoagMRF4B4gEkBmGkBmAtYKWDdgpYArYLS4jMxeXEihl4FC8CUhynqNbQ+th3mVSaui9bDvOdbjQp6D8cvMIDp6D8cvMuRobTwdkrIrC/pvfJ4S72VlVzNkee6L3+hJPK7U+B0vRohHrm9t+S/d/ErXBzsUYvD45xwAYrshLa5vT6aqEVlzuTnj58fgi6lfOajXVptRGS2lsUreuD6k0XbjC3bs1EpWY2Xzt64djilL5FLJaa2W1OVUn2uVv/5wvkVCtiXPOManW84cMt4fmFvptqqqdkHHCcXnqeW8PsK2J6e5Spk1lZTzlrq49ff7ytCzKcF/fFr4revqiKocQiQPMcqe3X+IyLTX5U9uu8RkWmoxSkuJC4ky4kLibjJisbqFKxyoqHKhysTqG6yhqAxEXgMRAJIDMMwMwFrBWwbsFLAFZi8uIxMXkRQ+svAp1l4EqnKTV0XrYd5lUmrovXQ7znWo0Kug/HLzLvgUq6D8cvMLXHathHtkl9SNLX7rnHqilH5LBbTPFk31qDYWNMJShY23Kc8yT4Yk/ugWmTzNdew0BOnri6puUU8YxkJbzars2KqtnZST2fST2sP4/tgvCrUU7MVqFBQlu9HOG0/4+pEqLJRSs1OYpKC9DPWt3z6/cVC9u+qh/wDC0UqlsXQl2ST+oXUQ5uqtZTxtLK6wi00XGfocMRzl+i9n+e0ilpR2ZSj2NoqEu33zfa8/PeUA8xyp7dd4jItNflT267xGRaajFKS4nR4nS4nR4m4yPWOVClY3UVDlXAbrFKhysoZgMRAQGIgXkBmGkBmAvYK2DUxWwBWYvLiMWC8uJFD6y8CnWXgZpDdJq6L10O8y6TU0Xrod5itxoVdB+OXmHp3XQfY8gKug/HLzGNOo87me04xi21Hi+rd8yNGbJY0MJJvKimvS/YHXHGruiuvLXc2n+5PM220xrp2boZXpxlvx749Xv7kVui6ZVW1vbi442nDdLq3ruKhpWajG1+Dt2u3Zxjq6/cVdln99NiXo/wC0jHOMfwJ/iIL/ANppF31N+bOWskujDTR8NEP4GmC3f1ZUw3elJ7k843pcev7BqJxnC2fW5Sxx4Ni+nlK/UO2cs7KxlY3bsLHUt2X8C3NqqMs3QhTNZjnEptNdSXB43dQALHmSfbGL+iKhL0lOLjFxWzjZk8tY3fsDIrzHKvt13iMi01uVfbrvEZNpqMUrLidHidLiQuJuMmKxyoTrHKiocqG6xSobrKGoDEReAxEC8gMw7AzAWmK2DUxawBSwXlxGLBeRFDLwKdYSBKsN0mpovXQ7zMpNTR+uh3nOtQ/V0H45eYaqUYz9LKi1huPFe9Aaug/HLzLmWmhHTzsshPmKrntJ87TLZfe4/YFC/mqaU9VqafQ3bG+PF+9BtHJLU6Z9rj+wvZrboWyjXJQqTaVeNqK39jNIMtTa+HK0v+uEl+zO/EXf/K1P/pk//qVqtjbGU7dJpnGPWoOLbxnqfYvI6+yFElH8Dps7087Tw0+/uA78TOTlD8dZbmMswUNmL3Pj/wCC8KpKFUk6as1x9PG1Y93Uur6C3465dHYhDrhCCjGXueN7Q7qJxeprUUkubhhLgtwGdbJOxqKajH0Vl5fe/eVIzl57d5xFeY5V9uu8RkWmvyr7fd4jJtNRilZcSFxJlxIXE3GTFY5UJ1jlRUOVDdYpUN1lDUBiIvAYiASQGYZgZgLWC1gzMVsAVsF5cRiwWlxIqnWEgC6wkDNWHaDU0frod5l0Gpo/XQ7zFah+roPxy8y4OroPxy8whloxTbCKrnK1wlU87Ozna35WH1fEFVXK+1rKit8pSfCK62ysK52z2K4SnLjiKyFu/oVLT8JPEre/qj8PN+4oNGcZbCgmqtrYgnxa4yb973eRTD1MVHP9SxKcM9cuEo/HH/eSE9jU6eD4Q2U+9735lKoOyEtM/WRbdfvfXH44+a94AWnGTjJNSXFNYaDu6twUtmbuUdjOVspYxntzglaycoqGoXPVr/V0l3S4/MtZpqtmXM2TlKDaakktrHHZ7usBUkgkDzHKnt93iMq01uVPb7vEZNpqMUpLiQuJMuJC4m4yYrHKhKscqKhysbrFKxusobgMRF4DEQLsFMKwMwF7BWwZmK2ALWC0uIxMXlxIoYSAPrCQM1YdoNTR+uh3mVQauj9dDvMVqHqug/HLzL9RSroPxy8wnUZaMPFNUa8pxs3XNdvUvhuff3Ar4Td7i05WtJNJZblgPGCkpXTTdLipSaW7aW7Z735MHVZmd19rnlrGYNJ5l2Z92SiurTWqtTympY7idQ82QuTw7Iqe7qlwf1R2oT2a5OW3mLxJ/wByXD+PgHks0yplKpRjFuuLXptri8469+5sAN7jKyu/clZvkuySfpfz8S89qi1y/vrS2ev0pPOf3+RNNvNUqM2+YazOKXTb8sJZ+BHOxqXNWxc5VP0JLrxwT92/P0CAWpK+xRWEpPC+JUjv3skK8zyp7fd4jJtNblT2+7xGTaajFKy4lVxLS4lVxNxkescqEqxyoodrG6xSrgN1lQ1AYiLwGIgXYGYZgZgL2Clg1YK2AKzF5DExeXEih9YSAMvFmasO0s1dE/60O8yKWamhebod5itRpVdB+OXmEBVdB+OXmEI07O7HV2B4SgtOlOCcZWNOW/Mdyxj6gAlV06W9lRafGM4qSfZuYE6lOMlU3vriovv4v6sOoxlqo2Wzkuca2FGOc5S+S6hRtybk3lt5b7Qsb0q4/wBNu2EdmM9rclv6u3ewLQSs08NpejS3t44tPh9cr4lL5bUoS2YxbgvRjwXZ9MFarZUybiovKw4yjlNdxWUpTm5zbcm8tvrAgkg4DzXKnt9/iMi01uVPbrvEZNpqMUrLiVXEtLiQuJuMjVjlQpWhuoodq4DdYpUN1lQ1AYiLwGIgWYKYVgpgLTFZjcxaaAUmLyGbELzW8igstEhnIlDNcsD+l1CqnGfHDzgy4ywFUzNajWjyxCtNOlv0m+l2nfnsF/sH+v7GLJg2yZF1u/n8P8D/AF/Y78/r/wAD/X9jAbIyPMNr0H5/X/u8v1/Y78/r/wAD/X9jz+TsjIbXofz+v/BL9f2O/P6/8Ev1/Y89k7IyG16H8/r/AMEv1/Yn8+r/AMEv1HnskpjIbTWtvV99lqWFJ5x2GdYGnIBNlSl5cToreWa3kxW81GRa0N1IXrQ3UihmpDcBetDMCoZgHiAgMRAswUgzQKSAWmLTQ3NC80AnNC80NzQtNEUuypeSKMlFkyykCJyZVZyBtnNg2wqzkRtA2yMgE2idoFk7IBdo7aB5JyATaJyDyTkC0mDkWZVoqKYLxRKReEd5pBK4jdaA1xGq4hBq0MwQGtDEUUHgGiCig0UBdoFJBmDkgF5oXmhmaATQCk0LzQ3NC80RSs0CaDzQGSIKFWyzKsiqtg2yzKMiqtkZOZAE5OTOOAlFiqLASWRUsgJOwTglIqOSCwjvKpBYI0gsENVoBBDVaALBDEUCgg8UVBYoKikUFQH/2Q==",
    occasion: "Wedding",
    title: "Forever Starts Here",
    spineBg: "#c8b8a8",
    spineText: "#ffffff",
  },
  me_and_you: {
    src: "data:image/jpeg;base64,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",
    occasion: "Anniversary",
    title: "Me & You",
    spineBg: "#7a1010",
    spineText: "#c04040",
  },
  sit_alkol: {
    src: "data:image/jpeg;base64,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",
    occasion: "Family",
    title: "ست الكل",
    spineBg: "#f4c8c8",
    spineText: "#c04040",
  },
};

// Phases:
//  0  intro     — book fills screen (scale ~2.5), cover closed,  0 → 0.8s
//  1  open      — cover swings open while still large,           0.8 → 2.0s
//  2  shrink    — book scales down + slides to left,             2.0 → 3.2s
//  3  close     — cover snaps shut,                              3.0 → 3.8s
//  4  reveal    — hero text / CTAs fade in on the right,         3.5s+
function CinematicHero({ isMobile, t, lang, projects, setCurrentView }) {
  const [phase, setPhase] = useState(0);
  const [floatingBooks, setFloatingBooks] = useState([]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 2000);
    const t3 = setTimeout(() => setPhase(3), 3000);
    const t4 = setTimeout(() => setPhase(4), 3600);
    return () => [t1,t2,t3,t4].forEach(clearTimeout);
  }, []);

  // Floating Layal's real book images — spawn after reveal, drift upward slowly
  useEffect(() => {
    if (phase < 4) return;
    const bookKeys = Object.keys(LAYAL_BOOK_IMAGES);
    let bookIdx = 0;
    const spawn = () => {
      const id = generateId();
      const key = bookKeys[bookIdx % bookKeys.length];
      bookIdx++;
      const book = LAYAL_BOOK_IMAGES[key];
      const scale = 0.32 + Math.random() * 0.18;
      const duration = 10 + Math.random() * 8;
      const delay = Math.random() * 2;
      const tilt = (Math.random() - 0.5) * 16;
      const left = 2 + Math.random() * 92;
      const b = { id, book, scale, duration, delay, tilt, left };
      setFloatingBooks(prev => [...prev.slice(-10), b]);
      setTimeout(() => setFloatingBooks(prev => prev.filter(x => x.id !== id)),
        (duration + delay + 1) * 1000);
    };
    [0,1,2,3].forEach(i => setTimeout(spawn, i * 700));
    const iv = setInterval(spawn, 3200);
    return () => clearInterval(iv);
  }, [phase]);

  // Book geometry
  const BW = isMobile ? 140 : 200; // single cover width
  const BH = isMobile ? 196 : 280;
  const SPINE = 14;

  // Phase-driven transforms for the whole book wrapper
  const bookStyle = (() => {
    const base = { position:"absolute", transformStyle:"preserve-3d",
      transition:"transform 1.2s cubic-bezier(0.4,0,0.2,1), left 1.0s cubic-bezier(0.4,0,0.2,1), top 1.0s cubic-bezier(0.4,0,0.2,1)",
      perspective:1400 };
    if (phase === 0) return { ...base,
      left:"50%", top:"50%",
      transform:"translate(-50%,-50%) scale(2.6) rotateX(4deg)",
      transition:"none" };
    if (phase === 1) return { ...base,
      left:"50%", top:"50%",
      transform:"translate(-50%,-50%) scale(2.6) rotateX(4deg)" };
    if (phase >= 2) return { ...base,
      left: isMobile ? "50%" : "8%",
      top:"50%",
      transform: isMobile
        ? "translate(-50%,-50%) scale(1) rotateX(2deg)"
        : "translate(0,-50%) scale(1) rotateX(2deg)",
      transition:"transform 1.1s cubic-bezier(0.4,0,0.2,1), left 1.0s cubic-bezier(0.35,0,0.25,1), top 1.0s cubic-bezier(0.4,0,0.2,1)" };
    return base;
  })();

  // Cover rotation
  const coverOpen = phase === 1 || phase === 2;
  const coverRot = coverOpen ? "rotateY(-150deg)" : "rotateY(0deg)";

  return (
    <section style={{ minHeight:"100vh", position:"relative", overflow:"hidden",
      background:`linear-gradient(160deg,${SOFT_PINK} 0%,#fff5f8 45%,${WARM_WHITE} 100%)` }}>
      <link href={FONT_LINK} rel="stylesheet" />

      {/* Floating Layal's real books */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden" }}>
        {floatingBooks.map(b => (
          <img key={b.id} src={b.book.src} alt={b.book.title}
            style={{
              position:"absolute", bottom:"-5%", left:`${b.left}%`,
              height: 280 * b.scale,
              width:"auto",
              animation:`bookFloat ${b.duration}s ease ${b.delay}s forwards`,
              opacity:0,
              transform:`rotate(${b.tilt}deg)`,
            }} />
        ))}
      </div>

      {/* Book */}
      <div style={bookStyle}>
        <div style={{ position:"relative", width:BW*2+SPINE, height:BH }}>

          {/* Left page — inner spread */}
          <div style={{ position:"absolute", left:0, top:0, width:BW, height:BH,
            background:"#fffef9", borderRadius:"8px 0 0 8px",
            boxShadow:"-3px 4px 20px rgba(74,48,104,0.10)",
            display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"space-between", padding:"14px 12px",
            opacity: phase>=1 ? 1:0, transition:"opacity 0.4s ease 0.5s" }}>
            <div style={{ fontSize:8, letterSpacing:2, textTransform:"uppercase", color:DEEP_PURPLE, opacity:0.35 }}>01</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, width:"100%" }}>
              <div style={{ background:`${PASTEL_PURPLE}20`, borderRadius:4, height:BH*0.22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:BH*0.08, gridColumn:"1/-1" }}>🌅</div>
              <div style={{ background:`${SOFT_PINK}40`, borderRadius:4, height:BH*0.17, display:"flex", alignItems:"center", justifyContent:"center", fontSize:BH*0.07 }}>🌸</div>
              <div style={{ background:`${PASTEL_PURPLE}15`, borderRadius:4, height:BH*0.17, display:"flex", alignItems:"center", justifyContent:"center", fontSize:BH*0.07 }}>✨</div>
            </div>
            <div style={{ fontSize:8, letterSpacing:2, textTransform:"uppercase", color:DEEP_PURPLE, opacity:0.3, fontFamily:"'Playfair Display',serif" }}>
              {t("Our Memories","ذكرياتنا")}
            </div>
          </div>

          {/* Spine */}
          <div style={{ position:"absolute", left:BW-1, top:0, width:SPINE+2, height:BH, zIndex:5,
            background:"linear-gradient(to right,#d4a8bc,#e8c4d4,#d0a0b8)",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ fontSize:6, letterSpacing:3, textTransform:"uppercase",
              color:"#a07888", writingMode:"vertical-rl", transform:"rotate(180deg)", opacity:0.6,
              fontFamily:"'Playfair Display',serif" }}>Miora</div>
          </div>

          {/* Front cover */}
          <div style={{ position:"absolute", left:BW+SPINE, top:0, width:BW, height:BH,
            transformOrigin:"left center", transformStyle:"preserve-3d",
            transform: coverRot,
            transition: phase===3
              ? "transform 0.7s cubic-bezier(0.6,0,0.4,1)"
              : "transform 0.9s cubic-bezier(0.4,0,0.2,1)",
            borderRadius:"0 8px 8px 0",
            boxShadow: coverOpen ? "none" : "5px 5px 28px rgba(74,48,104,0.20)" }}>

            {/* Front face */}
            <div style={{ position:"absolute", inset:0, background:"#fff0f5",
              borderRadius:"0 8px 8px 0", backfaceVisibility:"hidden",
              display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", padding:"16px 12px", overflow:"hidden" }}>
              <div style={{ position:"absolute", left:0, top:0, bottom:0, width:12,
                background:"linear-gradient(to right,rgba(200,160,180,0.5),transparent)" }} />
              <div style={{ fontFamily:"'Playfair Display',serif",
                fontSize:isMobile?15:20, fontWeight:700, color:"#c0506a",
                textAlign:"center", lineHeight:1.25, marginBottom:6 }}>
                A Year<br/>to<br/>Remember
              </div>
              <div style={{ fontSize:isMobile?6:7, letterSpacing:3, textTransform:"uppercase",
                color:"#c0506a", opacity:0.45, marginBottom:10 }}>
                {t("Photo Album","ألبوم صور")}
              </div>
              <svg width={isMobile?60:80} height={isMobile?60:80} viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r="20" fill="#f4a0b8" opacity="0.22"/>
                <ellipse cx="40" cy="31" rx="8" ry="11" fill="#e87898" opacity="0.85"/>
                <ellipse cx="31" cy="39" rx="8" ry="11" fill="#d45878" opacity="0.7" transform="rotate(-30 31 39)"/>
                <ellipse cx="49" cy="39" rx="8" ry="11" fill="#e87898" opacity="0.7" transform="rotate(30 49 39)"/>
                <ellipse cx="40" cy="49" rx="8" ry="11" fill="#f09ab4" opacity="0.85"/>
                <ellipse cx="40" cy="40" rx="7" ry="7" fill="#c04068"/>
                <ellipse cx="26" cy="57" rx="5" ry="9" fill="#88b878" opacity="0.65" transform="rotate(-20 26 57)"/>
                <ellipse cx="54" cy="57" rx="5" ry="9" fill="#68a858" opacity="0.65" transform="rotate(20 54 57)"/>
              </svg>
            </div>
            {/* Back face */}
            <div style={{ position:"absolute", inset:0, background:"#f8e8ef",
              borderRadius:"0 8px 8px 0", backfaceVisibility:"hidden", transform:"rotateY(180deg)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ fontSize:7, letterSpacing:3, textTransform:"uppercase",
                color:"#c0506a", opacity:0.35, fontFamily:"'Playfair Display',serif", textAlign:"center" }}>
                Miora<br/>by Layal
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero content — fades in on the right after reveal (desktop) or below (mobile) */}
      <div style={{
        position:"absolute",
        left: isMobile ? 0 : "calc(8% + " + (BW*2+SPINE+40) + "px)",
        right: 0,
        top: isMobile ? "auto" : "50%",
        bottom: isMobile ? 0 : "auto",
        transform: (!isMobile && phase>=4) ? "translateY(-50%)" : isMobile ? "none" : "translateY(-40%)",
        padding: isMobile ? "0 24px 48px" : "0 40px",
        opacity: phase >= 4 ? 1 : 0,
        transition: "opacity 0.8s ease, transform 0.8s ease",
        textAlign: isMobile ? "center" : "left",
        pointerEvents: phase >= 4 ? "auto" : "none",
        zIndex: 10,
      }}>
        <div style={{ fontFamily:"'Londrina Solid',cursive",
          fontSize:isMobile?"clamp(40px,12vw,60px)":"clamp(40px,5vw,72px)",
          color:DEEP_PURPLE, lineHeight:1, marginBottom:4, letterSpacing:4 }}>MIORA</div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:isMobile?11:14,
          color:DARK_PURPLE, opacity:0.45, letterSpacing:6, textTransform:"uppercase", marginBottom:16 }}>
          by Layal
        </div>
        <p style={{ fontSize:isMobile?14:17, maxWidth:360, lineHeight:1.75,
          color:DARK_PURPLE, opacity:0.7, fontWeight:300, marginBottom:28 }}>
          {t("Beautiful photo albums for life's most precious moments.",
             "ألبومات صور جميلة لأغلى لحظات الحياة.")}
        </p>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent: isMobile ? "center" : "flex-start" }}>
          <HeroBtn label={t("Start Creating","ابدأ التصميم")} primary
            onClick={() => document.getElementById("create-section")?.scrollIntoView({behavior:"smooth"})} />
          {projects.length > 0 && (
            <HeroBtn label={t(`My Projects (${projects.length})`,`مشاريعي (${projects.length})`)}
              onClick={() => setCurrentView("my-projects")} />
          )}
        </div>
        {/* Scroll dots */}
        <div style={{ display:"flex", flexDirection: isMobile?"row":"column",
          justifyContent:isMobile?"center":"flex-start",
          gap:5, marginTop:28, opacity:0.3 }}>
          {[0,1,2].map(i=>(
            <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:DEEP_PURPLE,
              animation:`scrollDot 1.4s ease-in-out ${i*0.2}s infinite` }} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Occasion Books Showcase ──────────────────────────────────────────────────
// Styled to match Layal's real books: bold title top, illustration center,
// thick spine on left, slight 3D perspective tilt — exactly like the screenshots.
const OCCASION_BOOKS = [
  {
    title: "WEDDING",     titleAr: "زفاف",
    sub: "Our Special Day", subAr: "يومنا المميز",
    bg: "#fff0f5", titleColor: "#c0506a", spineColor: "#e8c0d0", spineText: "#fff",
    illustration: (
      <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
        <ellipse cx="55" cy="85" rx="40" ry="8" fill="#f4c0d0" opacity="0.3"/>
        {/* Rings */}
        <circle cx="42" cy="58" r="16" stroke="#D4A853" strokeWidth="3.5" fill="none"/>
        <circle cx="58" cy="58" r="16" stroke="#D4A853" strokeWidth="3.5" fill="none"/>
        {/* Roses */}
        <circle cx="30" cy="35" r="10" fill="#e87898" opacity="0.8"/>
        <circle cx="30" cy="35" r="6" fill="#c04068"/>
        <circle cx="80" cy="35" r="10" fill="#e87898" opacity="0.8"/>
        <circle cx="80" cy="35" r="6" fill="#c04068"/>
        <ellipse cx="55" cy="28" rx="8" ry="10" fill="#e87898" opacity="0.9"/>
        <ellipse cx="55" cy="28" rx="5" ry="5" fill="#c04068"/>
        {/* Leaves */}
        <ellipse cx="20" cy="42" rx="5" ry="9" fill="#88b878" opacity="0.7" transform="rotate(-20 20 42)"/>
        <ellipse cx="90" cy="42" rx="5" ry="9" fill="#68a858" opacity="0.7" transform="rotate(20 90 42)"/>
        {/* Bow */}
        <path d="M45 75 Q55 70 65 75 Q55 80 45 75Z" fill="#f09ab4"/>
      </svg>
    ),
  },
  {
    title: "BABY",        titleAr: "استقبال مولود",
    sub: "New Arrival",   subAr: "مولود جديد",
    bg: "#f0f8ff", titleColor: "#5b8fc9", spineColor: "#b8d8f0", spineText: "#2a5a8a",
    illustration: (
      <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
        {/* Cloud */}
        <ellipse cx="55" cy="38" rx="28" ry="16" fill="white" opacity="0.9"/>
        <circle cx="35" cy="42" r="12" fill="white" opacity="0.9"/>
        <circle cx="75" cy="42" r="12" fill="white" opacity="0.9"/>
        {/* Stars */}
        <text x="25" y="28" fontSize="14" textAnchor="middle" fill="#f4c060">⭐</text>
        <text x="85" y="28" fontSize="14" textAnchor="middle" fill="#f4c060">⭐</text>
        {/* Baby bottle */}
        <rect x="46" y="55" width="18" height="28" rx="5" fill="#b8d8f0"/>
        <rect x="48" y="52" width="14" height="6" rx="3" fill="#a0c8e8"/>
        <rect x="51" y="49" width="8" height="5" rx="2" fill="#88b8d8"/>
        {/* Dots on bottle */}
        <circle cx="52" cy="63" r="2" fill="white" opacity="0.5"/>
        <circle cx="58" cy="68" r="2" fill="white" opacity="0.5"/>
        {/* Duck */}
        <ellipse cx="30" cy="78" rx="10" ry="7" fill="#f4c060"/>
        <circle cx="38" cy="72" r="6" fill="#f4c060"/>
        <ellipse cx="43" cy="73" rx="4" ry="2.5" fill="#e8a030"/>
        <circle cx="40" cy="71" r="1.2" fill="#333"/>
        {/* Bear */}
        <circle cx="82" cy="78" r="9" fill="#d4a878"/>
        <circle cx="75" cy="72" r="5" fill="#d4a878"/>
        <circle cx="89" cy="72" r="5" fill="#d4a878"/>
        <circle cx="82" cy="78" r="5" fill="#c49060"/>
        <circle cx="80" cy="76" r="1.2" fill="#333"/>
        <circle cx="84" cy="76" r="1.2" fill="#333"/>
        <ellipse cx="82" cy="79" rx="2" ry="1.2" fill="#b08050"/>
      </svg>
    ),
  },
  {
    title: "BIRTHDAY",    titleAr: "عيد ميلاد",
    sub: "Celebrate You", subAr: "احتفل بك",
    bg: "#fff8e0", titleColor: "#b8860b", spineColor: "#f4d060", spineText: "#7a5800",
    illustration: (
      <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
        {/* Balloons */}
        <ellipse cx="28" cy="45" rx="12" ry="15" fill="#e87898"/>
        <line x1="28" y1="60" x2="32" y2="85" stroke="#e87898" strokeWidth="1.5"/>
        <ellipse cx="55" cy="38" rx="14" ry="17" fill="#D8C0FF"/>
        <line x1="55" y1="55" x2="52" y2="85" stroke="#D8C0FF" strokeWidth="1.5"/>
        <ellipse cx="82" cy="45" rx="12" ry="15" fill="#88c878"/>
        <line x1="82" y1="60" x2="78" y2="85" stroke="#88c878" strokeWidth="1.5"/>
        {/* Cake */}
        <rect x="35" y="78" width="40" height="24" rx="4" fill="#f4c0d0"/>
        <rect x="35" y="68" width="40" height="14" rx="4" fill="#fff0f5"/>
        <ellipse cx="55" cy="68" rx="20" ry="5" fill="#f4c0d0"/>
        {/* Candles */}
        <rect x="48" y="58" width="5" height="12" rx="2" fill="#f4d060"/>
        <rect x="57" y="58" width="5" height="12" rx="2" fill="#88c8f8"/>
        {/* Flames */}
        <ellipse cx="50.5" cy="57" rx="3" ry="4" fill="#f4a030" opacity="0.9"/>
        <ellipse cx="59.5" cy="57" rx="3" ry="4" fill="#f4a030" opacity="0.9"/>
        {/* Stars */}
        <text x="20" y="20" fontSize="12" fill="#f4d060">✨</text>
        <text x="80" y="25" fontSize="12" fill="#f4d060">✨</text>
      </svg>
    ),
  },
  {
    title: "GRADUATION",  titleAr: "تخرج",
    sub: "Achievement",   subAr: "إنجاز",
    bg: "#f4f0ff", titleColor: "#6040c0", spineColor: "#c0b0f0", spineText: "#fff",
    illustration: (
      <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
        {/* Cap */}
        <rect x="22" y="45" width="66" height="10" rx="3" fill="#4a3068"/>
        <polygon points="55,20 20,45 90,45" fill="#4a3068"/>
        {/* Tassel */}
        <line x1="90" y1="45" x2="90" y2="72" stroke="#D4A853" strokeWidth="2.5"/>
        <circle cx="90" cy="74" r="4" fill="#D4A853"/>
        <line x1="86" y1="74" x2="83" y2="88" stroke="#D4A853" strokeWidth="1.5"/>
        <line x1="90" y1="74" x2="90" y2="90" stroke="#D4A853" strokeWidth="1.5"/>
        <line x1="94" y1="74" x2="97" y2="88" stroke="#D4A853" strokeWidth="1.5"/>
        {/* Diploma scroll */}
        <rect x="28" y="70" width="52" height="34" rx="4" fill="#fffef0"/>
        <rect x="28" y="70" width="52" height="6" rx="2" fill="#D4A853" opacity="0.6"/>
        <rect x="28" y="98" width="52" height="6" rx="2" fill="#D4A853" opacity="0.6"/>
        <line x1="38" y1="82" x2="72" y2="82" stroke="#4a3068" strokeWidth="1.5" opacity="0.3"/>
        <line x1="38" y1="88" x2="72" y2="88" stroke="#4a3068" strokeWidth="1.5" opacity="0.3"/>
        <line x1="38" y1="94" x2="60" y2="94" stroke="#4a3068" strokeWidth="1.5" opacity="0.3"/>
        {/* Stars */}
        <text x="15" y="30" fontSize="11" fill="#D4A853">⭐</text>
        <text x="85" y="35" fontSize="11" fill="#D4A853">⭐</text>
      </svg>
    ),
  },
  {
    title: "TRAVEL",      titleAr: "سفر",
    sub: "Adventures",    subAr: "مغامرات",
    bg: "#e8f4f0", titleColor: "#1a7a5a", spineColor: "#88c8b0", spineText: "#fff",
    illustration: (
      <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
        {/* Globe */}
        <circle cx="55" cy="62" r="34" fill="#b8d8f0"/>
        <circle cx="55" cy="62" r="34" stroke="#5898c8" strokeWidth="1.5" fill="none"/>
        {/* Continents */}
        <ellipse cx="42" cy="52" rx="10" ry="14" fill="#88c878" opacity="0.8"/>
        <ellipse cx="65" cy="55" rx="12" ry="10" fill="#88c878" opacity="0.8"/>
        <ellipse cx="55" cy="75" rx="8" ry="6" fill="#88c878" opacity="0.7"/>
        {/* Latitude lines */}
        <ellipse cx="55" cy="62" rx="34" ry="12" stroke="#5898c8" strokeWidth="0.8" fill="none" opacity="0.4"/>
        <ellipse cx="55" cy="62" rx="34" ry="24" stroke="#5898c8" strokeWidth="0.8" fill="none" opacity="0.4"/>
        {/* Plane */}
        <text x="55" y="32" fontSize="22" textAnchor="middle">✈️</text>
        {/* Dotted path */}
        <path d="M 35 44 Q 55 15 75 44" stroke="#D4A853" strokeWidth="1.5" strokeDasharray="4 3" fill="none"/>
      </svg>
    ),
  },
  {
    title: "FAMILY",      titleAr: "عائلة",
    sub: "Our Story",     subAr: "قصتنا",
    bg: "#fff5e8", titleColor: "#c86020", spineColor: "#f4c090", spineText: "#7a3800",
    illustration: (
      <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
        {/* House */}
        <polygon points="55,18 18,48 92,48" fill="#e87040"/>
        <rect x="22" y="46" width="66" height="52" rx="2" fill="#f4a060"/>
        {/* Door */}
        <rect x="44" y="72" width="22" height="26" rx="3" fill="#c86020"/>
        <circle cx="60" cy="85" r="2" fill="#D4A853"/>
        {/* Windows */}
        <rect x="26" y="56" width="16" height="16" rx="2" fill="#b8d8f0"/>
        <rect x="68" y="56" width="16" height="16" rx="2" fill="#b8d8f0"/>
        <line x1="34" y1="56" x2="34" y2="72" stroke="white" strokeWidth="1"/>
        <line x1="26" y1="64" x2="42" y2="64" stroke="white" strokeWidth="1"/>
        <line x1="76" y1="56" x2="76" y2="72" stroke="white" strokeWidth="1"/>
        <line x1="68" y1="64" x2="84" y2="64" stroke="white" strokeWidth="1"/>
        {/* Sun */}
        <circle cx="88" cy="22" r="10" fill="#f4d060"/>
        <line x1="88" y1="8" x2="88" y2="4" stroke="#f4d060" strokeWidth="2"/>
        <line x1="100" y1="22" x2="104" y2="22" stroke="#f4d060" strokeWidth="2"/>
        <line x1="96" y1="14" x2="99" y2="11" stroke="#f4d060" strokeWidth="2"/>
        {/* Hearts */}
        <text x="15" y="35" fontSize="14" fill="#e87898">💕</text>
      </svg>
    ),
  },
  {
    title: "ANNIVERSARY", titleAr: "ذكرى سنوية",
    sub: "Forever Yours", subAr: "إلى الأبد",
    bg: "#fff0f5", titleColor: "#c0506a", spineColor: "#f4b0c8", spineText: "#fff",
    illustration: (
      <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
        {/* Big heart */}
        <path d="M55 90 C20 65 10 40 30 28 C40 22 55 32 55 32 C55 32 70 22 80 28 C100 40 90 65 55 90Z" fill="#e87898"/>
        <path d="M55 80 C30 60 24 44 38 36 C44 32 55 40 55 40 C55 40 66 32 72 36 C86 44 80 60 55 80Z" fill="#f09ab4"/>
        {/* Arrow */}
        <line x1="15" y1="55" x2="95" y2="55" stroke="#D4A853" strokeWidth="2.5"/>
        <polygon points="95,50 105,55 95,60" fill="#D4A853"/>
        <polygon points="15,50 5,55 15,60" fill="#D4A853"/>
        {/* Small hearts */}
        <text x="20" y="30" fontSize="14" fill="#f4c0d0">💕</text>
        <text x="78" y="28" fontSize="14" fill="#f4c0d0">💕</text>
        <text x="50" y="16" fontSize="12" fill="#e87898">✨</text>
      </svg>
    ),
  },
  {
    title: "ENGAGEMENT",  titleAr: "خطوبة",
    sub: "Said Yes!",     subAr: "قالت نعم!",
    bg: "#fdf0ff", titleColor: "#8040b0", spineColor: "#d0a0f0", spineText: "#fff",
    illustration: (
      <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
        {/* Ring box */}
        <rect x="28" y="60" width="54" height="38" rx="6" fill="#8040b0"/>
        <rect x="28" y="60" width="54" height="16" rx="6" fill="#6030a0"/>
        <rect x="35" y="50" width="40" height="14" rx="4" fill="#6030a0"/>
        {/* Diamond ring */}
        <circle cx="55" cy="44" r="10" stroke="#D4A853" strokeWidth="3" fill="none"/>
        <polygon points="55,24 48,34 55,38 62,34" fill="#b8d0f8"/>
        <polygon points="55,38 48,34 55,46 62,34" fill="#d0e8ff"/>
        <polygon points="55,24 55,38 62,34" fill="#d0e8ff"/>
        <polygon points="55,24 55,38 48,34" fill="#a0c0e8"/>
        {/* Sparkles */}
        <text x="18" y="36" fontSize="14" fill="#D4A853">✨</text>
        <text x="80" y="32" fontSize="14" fill="#D4A853">✨</text>
        <text x="50" y="14" fontSize="11" fill="#D4A853">⭐</text>
        {/* Velvet interior */}
        <rect x="34" y="72" width="42" height="18" rx="3" fill="#c070e0" opacity="0.4"/>
      </svg>
    ),
  },
];

function OccasionBooksShowcase({ isMobile, t }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState(1); // 1=forward, -1=back
  const timerRef = useRef(null);

  const BW = isMobile ? 130 : 180;
  const BH = isMobile ? 182 : 252;
  const SPINE = isMobile ? 22 : 30;

  const goTo = (idx, dir) => {
    if (animating) return;
    setAnimating(true);
    setDirection(dir);
    setTimeout(() => {
      setActiveIdx(idx);
      setAnimating(false);
    }, 320);
  };

  const next = () => goTo((activeIdx + 1) % OCCASION_BOOKS.length, 1);
  const prev = () => goTo((activeIdx - 1 + OCCASION_BOOKS.length) % OCCASION_BOOKS.length, -1);

  // Auto-advance every 3s
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (!animating) {
        setAnimating(true);
        setDirection(1);
        setTimeout(() => {
          setActiveIdx(prev => (prev + 1) % OCCASION_BOOKS.length);
          setAnimating(false);
        }, 320);
      }
    }, 3000);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  const resetTimer = () => { clearInterval(timerRef.current); timerRef.current = setInterval(next, 3000); };

  const book = OCCASION_BOOKS[activeIdx];

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0, paddingBottom:48 }}>

      {/* 3D book display */}
      <div style={{ position:"relative", width:BW+SPINE+60, height:BH+60,
        display:"flex", alignItems:"center", justifyContent:"center",
        perspective:1000 }}>

        {/* Shadow */}
        <div style={{ position:"absolute", bottom:10, left:SPINE+20, width:BW,
          height:20, background:"rgba(74,48,104,0.12)", borderRadius:"50%", filter:"blur(8px)" }} />

        {/* Animated book wrapper */}
        <div style={{
          transform: animating
            ? `translateX(${direction * 60}px) scale(0.92)`
            : "translateX(0) scale(1)",
          opacity: animating ? 0 : 1,
          transition: animating
            ? "opacity 0.25s ease, transform 0.25s ease"
            : "opacity 0.3s ease 0.05s, transform 0.3s ease 0.05s",
          display:"flex", position:"relative",
        }}>

          {/* Spine */}
          <div style={{ width:SPINE, height:BH, background:book.spineColor,
            borderRadius:"6px 0 0 6px", display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"inset -4px 0 12px rgba(0,0,0,0.12)",
            flexShrink:0, position:"relative" }}>
            <div style={{ writingMode:"vertical-rl", transform:"rotate(180deg)",
              fontSize:isMobile?8:9, fontWeight:700, letterSpacing:2.5,
              textTransform:"uppercase", color:book.spineText, opacity:0.85,
              fontFamily:"'Quicksand',sans-serif" }}>
              {t(book.title, book.titleAr)}
            </div>
          </div>

          {/* Cover */}
          <div style={{ width:BW, height:BH, background:book.bg,
            borderRadius:"0 8px 8px 0",
            boxShadow:"6px 8px 32px rgba(74,48,104,0.18), 2px 2px 8px rgba(74,48,104,0.08)",
            display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"flex-start", padding: isMobile ? "16px 12px 10px" : "22px 16px 14px",
            overflow:"hidden", position:"relative",
            transform:"perspective(800px) rotateY(-8deg)",
            transformOrigin:"left center" }}>

            {/* Top edge highlight */}
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3,
              background:"rgba(255,255,255,0.5)", borderRadius:"0 8px 0 0" }} />
            {/* Spine edge shadow on cover */}
            <div style={{ position:"absolute", left:0, top:0, bottom:0, width:12,
              background:"linear-gradient(to right,rgba(0,0,0,0.08),transparent)" }} />

            {/* Title */}
            <div style={{ fontFamily:"'Londrina Solid',cursive",
              fontSize: isMobile ? Math.max(18, 28 - book.title.length * 0.8) : Math.max(24, 40 - book.title.length),
              color:book.titleColor, textAlign:"center", lineHeight:1.0,
              letterSpacing:1, marginBottom:isMobile?6:10, zIndex:1, width:"100%" }}>
              {t(book.title, book.titleAr)}
            </div>

            {/* Sub */}
            <div style={{ fontSize:isMobile?8:10, letterSpacing:2.5, textTransform:"uppercase",
              color:book.titleColor, opacity:0.55, marginBottom:isMobile?8:12, zIndex:1 }}>
              {t(book.sub, book.subAr)}
            </div>

            {/* Illustration */}
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
              transform: isMobile ? "scale(0.8)" : "scale(1)", transformOrigin:"center" }}>
              {book.illustration}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display:"flex", alignItems:"center", gap:20, marginTop:4 }}>
        <button onClick={() => { prev(); resetTimer(); }}
          style={{ width:36, height:36, borderRadius:"50%", border:`1.5px solid ${PASTEL_PURPLE}40`,
            background:"white", cursor:"pointer", fontSize:16, color:DEEP_PURPLE,
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:`0 2px 8px ${PASTEL_PURPLE}15` }}>‹</button>

        {/* Dots */}
        <div style={{ display:"flex", gap:7 }}>
          {OCCASION_BOOKS.map((_,i) => (
            <div key={i} onClick={() => { goTo(i, i > activeIdx ? 1 : -1); resetTimer(); }}
              style={{ width: i===activeIdx ? 20 : 7, height:7, borderRadius:4,
                background: i===activeIdx ? DEEP_PURPLE : `${PASTEL_PURPLE}50`,
                cursor:"pointer", transition:"all 0.3s ease" }} />
          ))}
        </div>

        <button onClick={() => { next(); resetTimer(); }}
          style={{ width:36, height:36, borderRadius:"50%", border:`1.5px solid ${PASTEL_PURPLE}40`,
            background:"white", cursor:"pointer", fontSize:16, color:DEEP_PURPLE,
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:`0 2px 8px ${PASTEL_PURPLE}15` }}>›</button>
      </div>

      {/* Book label */}
      <div style={{ marginTop:16, fontSize:isMobile?12:14, color:DARK_PURPLE, opacity:0.5,
        fontFamily:"'Playfair Display',serif", letterSpacing:1 }}>
        {t(book.sub, book.subAr)} ·
        <span style={{ fontStyle:"italic", marginLeft:6 }}>{t("and many more","والمزيد")}</span>
      </div>
    </div>
  );
}

// ─── Template Library ─────────────────────────────────────────────────────────
// Each template pre-seeds the editor with a designed cover spread + blank interior pages.
// The cover page (index 0-1) comes fully styled; interior pages are blank for the user to fill.

function makeBlankPages(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + "p" + Math.random().toString(36).slice(2),
    background: "#ffffff",
    elements: [],
  }));
}

function makeCoverPages(frontBg, frontElements, backBg = "#ffffff", backElements = []) {
  return [
    { id: "back-" + Math.random().toString(36).slice(2), background: backBg, elements: backElements },
    { id: "front-" + Math.random().toString(36).slice(2), background: frontBg, elements: frontElements },
  ];
}

const TEMPLATE_LIBRARY = [
  // ── WEDDING ──────────────────────────────────────────────────────────────
  {
    id: "w1", occasion: "Wedding", title: "Our Wedding Day",
    coverBg: "#fff0f5", spineColor: "#e8c0d0", titleColor: "#c0506a",
    desc: "Classic floral pink",
    pages: [
      ...makeCoverPages("#fff0f5", [
        { id:"e1", type:"text", content:"OUR\nWEDDING\nDAY", x:30, y:30, w:340, h:120, font:"Londrina Solid", fontSize:52, color:"#c0506a", bold:false, italic:false, rotation:0 },
        { id:"e2", type:"text", content:"Est. 2026", x:120, y:160, w:160, h:36, font:"Dancing Script", fontSize:22, color:"#c0506a", bold:false, italic:true, rotation:0 },
        { id:"e3", type:"sticker", content:"🌹", x:280, y:140, w:70, h:70, rotation:-15 },
        { id:"e4", type:"sticker", content:"💐", x:20, y:140, w:60, h:60, rotation:12 },
        { id:"e5", type:"sticker", content:"✨", x:310, y:260, w:45, h:45, rotation:0 },
        { id:"e6", type:"sticker", content:"🌸", x:10, y:260, w:45, h:45, rotation:-8 },
        { id:"e7", type:"text", content:"photo album", x:120, y:470, w:160, h:30, font:"Quicksand", fontSize:12, color:"#c0506a", bold:false, italic:false, rotation:0 },
      ], "#f8e8ef", [
        { id:"b1", type:"text", content:"Thank you for\nbeing part of\nour story ♥", x:40, y:180, w:320, h:120, font:"Dancing Script", fontSize:28, color:"#c0506a", bold:false, italic:true, rotation:0 },
      ]),
      ...makeBlankPages(14),
    ],
  },
  {
    id: "w2", occasion: "Wedding", title: "Forever & Always",
    coverBg: "#f5f0ff", spineColor: "#d0b8f0", titleColor: "#7B5EA7",
    desc: "Elegant purple",
    pages: [
      ...makeCoverPages("#f5f0ff", [
        { id:"e1", type:"text", content:"FOREVER\n& ALWAYS", x:20, y:20, w:360, h:100, font:"Playfair Display", fontSize:44, color:"#4A3068", bold:true, italic:false, rotation:0 },
        { id:"e2", type:"sticker", content:"💍", x:150, y:140, w:100, h:100, rotation:0 },
        { id:"e3", type:"sticker", content:"🕊️", x:40, y:160, w:60, h:60, rotation:-10 },
        { id:"e4", type:"sticker", content:"🕊️", x:300, y:160, w:60, h:60, rotation:10 },
        { id:"e5", type:"text", content:"2026", x:160, y:260, w:80, h:36, font:"Quicksand", fontSize:18, color:"#7B5EA7", bold:false, italic:false, rotation:0 },
        { id:"e6", type:"sticker", content:"✨", x:20, y:400, w:50, h:50, rotation:0 },
        { id:"e7", type:"sticker", content:"✨", x:330, y:420, w:50, h:50, rotation:0 },
      ]),
      ...makeBlankPages(14),
    ],
  },

  // ── TRAVEL ───────────────────────────────────────────────────────────────
  {
    id: "t1", occasion: "Travel", title: "Our Adventure",
    coverBg: "#e8f4f0", spineColor: "#88c8b0", titleColor: "#1a7a5a",
    desc: "Mint green explorer",
    pages: [
      ...makeCoverPages("#e8f4f0", [
        { id:"e1", type:"text", content:"OUR\nADVENTURE", x:20, y:20, w:360, h:110, font:"Londrina Solid", fontSize:56, color:"#1a7a5a", bold:false, italic:false, rotation:0 },
        { id:"e2", type:"text", content:"2026", x:160, y:140, w:80, h:36, font:"Quicksand", fontSize:20, color:"#1a7a5a", bold:true, italic:false, rotation:0 },
        { id:"e3", type:"sticker", content:"✈️", x:160, y:200, w:80, h:80, rotation:-15 },
        { id:"e4", type:"sticker", content:"🗺️", x:30, y:320, w:70, h:70, rotation:8 },
        { id:"e5", type:"sticker", content:"📸", x:290, y:300, w:65, h:65, rotation:-5 },
        { id:"e6", type:"sticker", content:"⭐", x:20, y:180, w:40, h:40, rotation:0 },
        { id:"e7", type:"sticker", content:"⭐", x:340, y:180, w:40, h:40, rotation:0 },
        { id:"e8", type:"text", content:"memories from around the world", x:40, y:460, w:320, h:30, font:"Quicksand", fontSize:11, color:"#1a7a5a", bold:false, italic:false, rotation:0 },
      ]),
      ...makeBlankPages(14),
    ],
  },
  {
    id: "t2", occasion: "Travel", title: "Solo Trip",
    coverBg: "#fffafa", spineColor: "#f4c0c8", titleColor: "#e06080",
    desc: "Solo traveller pink",
    pages: [
      ...makeCoverPages("#fffafa", [
        { id:"e1", type:"text", content:"SOLO\nTRIP", x:30, y:20, w:340, h:110, font:"Londrina Solid", fontSize:70, color:"#e06080", bold:false, italic:false, rotation:0 },
        { id:"e2", type:"text", content:"LOCATION", x:120, y:138, w:160, h:32, font:"Quicksand", fontSize:16, color:"#c04060", bold:true, italic:false, rotation:0 },
        { id:"e3", type:"sticker", content:"🧳", x:120, y:240, w:160, h:160, rotation:0 },
        { id:"e4", type:"sticker", content:"✈️", x:130, y:320, w:50, h:50, rotation:-20 },
        { id:"e5", type:"sticker", content:"🌸", x:290, y:380, w:50, h:50, rotation:10 },
      ]),
      ...makeBlankPages(14),
    ],
  },

  // ── BIRTHDAY ─────────────────────────────────────────────────────────────
  {
    id: "b1", occasion: "Birthday", title: "Happy Birthday",
    coverBg: "#fff8e0", spineColor: "#f4d060", titleColor: "#b8860b",
    desc: "Golden celebration",
    pages: [
      ...makeCoverPages("#fff8e0", [
        { id:"e1", type:"text", content:"HAPPY\nBIRTHDAY", x:20, y:20, w:360, h:110, font:"Londrina Solid", fontSize:56, color:"#b8860b", bold:false, italic:false, rotation:0 },
        { id:"e2", type:"sticker", content:"🎂", x:130, y:160, w:140, h:140, rotation:0 },
        { id:"e3", type:"sticker", content:"🎉", x:20, y:180, w:70, h:70, rotation:-15 },
        { id:"e4", type:"sticker", content:"🎈", x:300, y:160, w:65, h:65, rotation:12 },
        { id:"e5", type:"sticker", content:"🎊", x:20, y:380, w:60, h:60, rotation:8 },
        { id:"e6", type:"sticker", content:"🎁", x:300, y:370, w:65, h:65, rotation:-10 },
        { id:"e7", type:"text", content:"make a wish", x:110, y:330, w:180, h:30, font:"Dancing Script", fontSize:20, color:"#b8860b", bold:false, italic:true, rotation:0 },
        { id:"e8", type:"text", content:"✨ 2026 ✨", x:130, y:460, w:140, h:30, font:"Quicksand", fontSize:14, color:"#b8860b", bold:false, italic:false, rotation:0 },
      ]),
      ...makeBlankPages(14),
    ],
  },
  {
    id: "b2", occasion: "Birthday", title: "Birthday Memories",
    coverBg: "#fdf0ff", spineColor: "#d0a0f0", titleColor: "#8040b0",
    desc: "Purple party",
    pages: [
      ...makeCoverPages("#fdf0ff", [
        { id:"e1", type:"text", content:"BIRTHDAY\nMEMORIES", x:20, y:20, w:360, h:110, font:"Londrina Solid", fontSize:50, color:"#8040b0", bold:false, italic:false, rotation:0 },
        { id:"e2", type:"sticker", content:"🎂", x:140, y:150, w:120, h:120, rotation:0 },
        { id:"e3", type:"sticker", content:"🎈", x:20, y:140, w:80, h:80, rotation:-10 },
        { id:"e4", type:"sticker", content:"🎈", x:300, y:140, w:80, h:80, rotation:10 },
        { id:"e5", type:"sticker", content:"🎉", x:30, y:360, w:70, h:70, rotation:0 },
        { id:"e6", type:"sticker", content:"🎊", x:290, y:360, w:70, h:70, rotation:0 },
        { id:"e7", type:"text", content:"another year of amazing memories", x:20, y:458, w:360, h:30, font:"Quicksand", fontSize:10, color:"#8040b0", bold:false, italic:false, rotation:0 },
      ]),
      ...makeBlankPages(14),
    ],
  },

  // ── BABY SHOWER ──────────────────────────────────────────────────────────
  {
    id: "bs1", occasion: "Baby Shower", title: "Baby's First Year",
    coverBg: "#f0f8ff", spineColor: "#b8d8f0", titleColor: "#5b8fc9",
    desc: "Baby blue",
    pages: [
      ...makeCoverPages("#f0f8ff", [
        { id:"e1", type:"text", content:"BABY'S\nFIRST\nYEAR", x:20, y:15, w:360, h:130, font:"Londrina Solid", fontSize:54, color:"#5b8fc9", bold:false, italic:false, rotation:0 },
        { id:"e2", type:"sticker", content:"🍼", x:30, y:200, w:80, h:80, rotation:-12 },
        { id:"e3", type:"sticker", content:"👶", x:150, y:190, w:100, h:100, rotation:0 },
        { id:"e4", type:"sticker", content:"🧸", x:290, y:200, w:80, h:80, rotation:10 },
        { id:"e5", type:"sticker", content:"🌙", x:20, y:380, w:60, h:60, rotation:0 },
        { id:"e6", type:"sticker", content:"⭐", x:310, y:360, w:60, h:60, rotation:0 },
        { id:"e7", type:"text", content:"a new adventure begins", x:60, y:320, w:280, h:30, font:"Dancing Script", fontSize:20, color:"#5b8fc9", bold:false, italic:true, rotation:0 },
        { id:"e8", type:"text", content:"2026", x:170, y:470, w:60, h:28, font:"Quicksand", fontSize:14, color:"#5b8fc9", bold:true, italic:false, rotation:0 },
      ]),
      ...makeBlankPages(14),
    ],
  },

  // ── GRADUATION ───────────────────────────────────────────────────────────
  {
    id: "g1", occasion: "Graduation", title: "Graduation Day",
    coverBg: "#f4f0ff", spineColor: "#c0b0f0", titleColor: "#6040c0",
    desc: "Classic purple cap",
    pages: [
      ...makeCoverPages("#f4f0ff", [
        { id:"e1", type:"text", content:"CLASS OF\n2026", x:30, y:20, w:340, h:110, font:"Londrina Solid", fontSize:58, color:"#4A3068", bold:false, italic:false, rotation:0 },
        { id:"e2", type:"sticker", content:"🎓", x:140, y:160, w:120, h:120, rotation:0 },
        { id:"e3", type:"sticker", content:"⭐", x:30, y:180, w:60, h:60, rotation:-8 },
        { id:"e4", type:"sticker", content:"⭐", x:310, y:180, w:60, h:60, rotation:8 },
        { id:"e5", type:"sticker", content:"🏆", x:40, y:330, w:70, h:70, rotation:0 },
        { id:"e6", type:"sticker", content:"📚", x:280, y:330, w:70, h:70, rotation:0 },
        { id:"e7", type:"text", content:"the journey continues", x:70, y:440, w:260, h:30, font:"Dancing Script", fontSize:20, color:"#6040c0", bold:false, italic:true, rotation:0 },
        { id:"e8", type:"text", content:"Congratulations!", x:70, y:470, w:260, h:28, font:"Quicksand", fontSize:14, color:"#6040c0", bold:true, italic:false, rotation:0 },
      ]),
      ...makeBlankPages(14),
    ],
  },

  // ── FAMILY ───────────────────────────────────────────────────────────────
  {
    id: "f1", occasion: "Family", title: "Our Family Story",
    coverBg: "#fff5e8", spineColor: "#f4c090", titleColor: "#c86020",
    desc: "Warm terracotta",
    pages: [
      ...makeCoverPages("#fff5e8", [
        { id:"e1", type:"text", content:"OUR\nFAMILY\nSTORY", x:30, y:15, w:340, h:130, font:"Londrina Solid", fontSize:54, color:"#c86020", bold:false, italic:false, rotation:0 },
        { id:"e2", type:"sticker", content:"🏡", x:130, y:180, w:140, h:140, rotation:0 },
        { id:"e3", type:"sticker", content:"❤️", x:30, y:200, w:65, h:65, rotation:-8 },
        { id:"e4", type:"sticker", content:"❤️", x:300, y:200, w:65, h:65, rotation:8 },
        { id:"e5", type:"sticker", content:"💕", x:40, y:360, w:60, h:60, rotation:0 },
        { id:"e6", type:"sticker", content:"💕", x:290, y:360, w:60, h:60, rotation:0 },
        { id:"e7", type:"text", content:"together is our favourite place", x:30, y:455, w:340, h:30, font:"Dancing Script", fontSize:18, color:"#c86020", bold:false, italic:true, rotation:0 },
      ]),
      ...makeBlankPages(14),
    ],
  },

  // ── ANNIVERSARY ──────────────────────────────────────────────────────────
  {
    id: "a1", occasion: "Anniversary", title: "Our Anniversary",
    coverBg: "#fff0f5", spineColor: "#f4b0c8", titleColor: "#c0506a",
    desc: "Romantic rose",
    pages: [
      ...makeCoverPages("#fff0f5", [
        { id:"e1", type:"text", content:"FOREVER\nTOGETHER", x:20, y:20, w:360, h:110, font:"Playfair Display", fontSize:42, color:"#c0506a", bold:true, italic:false, rotation:0 },
        { id:"e2", type:"sticker", content:"❤️", x:160, y:160, w:80, h:80, rotation:0 },
        { id:"e3", type:"sticker", content:"🌹", x:30, y:160, w:70, h:70, rotation:-10 },
        { id:"e4", type:"sticker", content:"🌹", x:300, y:160, w:70, h:70, rotation:10 },
        { id:"e5", type:"sticker", content:"🥂", x:40, y:360, w:70, h:70, rotation:0 },
        { id:"e6", type:"sticker", content:"🥂", x:280, y:360, w:70, h:70, rotation:0 },
        { id:"e7", type:"text", content:"years of love & laughter", x:60, y:280, w:280, h:30, font:"Dancing Script", fontSize:22, color:"#c0506a", bold:false, italic:true, rotation:0 },
        { id:"e8", type:"text", content:"2026", x:170, y:460, w:60, h:28, font:"Quicksand", fontSize:16, color:"#c0506a", bold:true, italic:false, rotation:0 },
      ]),
      ...makeBlankPages(14),
    ],
  },

  // ── ENGAGEMENT ───────────────────────────────────────────────────────────
  {
    id: "en1", occasion: "Engagement", title: "She Said Yes!",
    coverBg: "#fdf0ff", spineColor: "#d0a0f0", titleColor: "#8040b0",
    desc: "Lilac proposal",
    pages: [
      ...makeCoverPages("#fdf0ff", [
        { id:"e1", type:"text", content:"SHE SAID\nYES!", x:30, y:20, w:340, h:120, font:"Londrina Solid", fontSize:58, color:"#8040b0", bold:false, italic:false, rotation:0 },
        { id:"e2", type:"sticker", content:"💍", x:150, y:170, w:100, h:100, rotation:0 },
        { id:"e3", type:"sticker", content:"✨", x:30, y:180, w:60, h:60, rotation:0 },
        { id:"e4", type:"sticker", content:"✨", x:310, y:180, w:60, h:60, rotation:0 },
        { id:"e5", type:"sticker", content:"💐", x:30, y:340, w:80, h:80, rotation:-8 },
        { id:"e6", type:"sticker", content:"💕", x:290, y:350, w:70, h:70, rotation:8 },
        { id:"e7", type:"text", content:"the beginning of forever", x:50, y:450, w:300, h:30, font:"Dancing Script", fontSize:20, color:"#8040b0", bold:false, italic:true, rotation:0 },
      ]),
      ...makeBlankPages(14),
    ],
  },
];

// Group templates by occasion for the picker UI
const TEMPLATE_BY_OCCASION = TEMPLATE_LIBRARY.reduce((acc, tpl) => {
  if (!acc[tpl.occasion]) acc[tpl.occasion] = [];
  acc[tpl.occasion].push(tpl);
  return acc;
}, {});

const TEMPLATE_OCCASIONS = Object.keys(TEMPLATE_BY_OCCASION);

// ─── Template Picker View ─────────────────────────────────────────────────────
function TemplatePickerView({ onBack, onSelect, t, lang, isRTL, isMobile }) {
  const [activeOccasion, setActiveOccasion] = useState(TEMPLATE_OCCASIONS[0]);
  const [hovered, setHovered] = useState(null);

  const occasionAr = {
    Wedding:"زفاف", Travel:"سفر", Birthday:"عيد ميلاد",
    "Baby Shower":"استقبال مولود", Graduation:"تخرج",
    Family:"عائلة", Anniversary:"ذكرى سنوية", Engagement:"خطوبة",
  };

  const templates = TEMPLATE_BY_OCCASION[activeOccasion] || [];

  // Mini book preview for each template
  const MiniBook = ({ tpl, size = isMobile ? 130 : 160 }) => {
    const H = Math.round(size * 1.4);
    const SPINE = Math.round(size * 0.12);
    const coverEls = tpl.pages[1]?.elements || [];
    return (
      <div style={{ display:"flex", perspective:600, flexShrink:0 }}>
        {/* Spine */}
        <div style={{ width:SPINE, height:H, background:tpl.spineColor,
          borderRadius:"4px 0 0 4px", display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:"inset -2px 0 6px rgba(0,0,0,0.1)", flexShrink:0 }}>
          <div style={{ writingMode:"vertical-rl", transform:"rotate(180deg)",
            fontSize:Math.max(6, size*0.045), fontWeight:700, letterSpacing:1.5,
            textTransform:"uppercase", color:tpl.titleColor, opacity:0.8,
            fontFamily:"'Quicksand',sans-serif" }}>
            {tpl.title}
          </div>
        </div>
        {/* Cover */}
        <div style={{ width:size, height:H, background:tpl.coverBg,
          borderRadius:"0 6px 6px 0", overflow:"hidden", position:"relative",
          transform:"perspective(500px) rotateY(-6deg)",
          transformOrigin:"left center",
          boxShadow:"4px 4px 16px rgba(74,48,104,0.15)" }}>
          {/* Spine shadow */}
          <div style={{ position:"absolute", left:0, top:0, bottom:0, width:8,
            background:"linear-gradient(to right,rgba(0,0,0,0.08),transparent)", zIndex:2 }} />
          {/* Scale down the actual template elements */}
          <div style={{ position:"absolute", inset:0,
            transform:`scale(${size/400})`, transformOrigin:"top left",
            width:400, height:520, pointerEvents:"none" }}>
            {coverEls.filter(el => el.type === "text").map(el => (
              <div key={el.id} style={{ position:"absolute", left:el.x, top:el.y, width:el.w, height:el.h,
                fontFamily:`'${el.font||"Quicksand"}',sans-serif`, fontSize:el.fontSize||16,
                color:el.color||"#333", fontWeight:el.bold?"bold":"normal", fontStyle:el.italic?"italic":"normal",
                display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center",
                whiteSpace:"pre-wrap", wordBreak:"break-word", lineHeight:1.1 }}>
                {el.content}
              </div>
            ))}
            {coverEls.filter(el => el.type === "sticker").map(el => (
              <div key={el.id} style={{ position:"absolute", left:el.x, top:el.y, width:el.w, height:el.h,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:Math.min(el.w, el.h)*0.7 }}>
                {el.content}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div dir={isRTL?"rtl":"ltr"} style={{ minHeight:"100vh", background:`linear-gradient(160deg,${SOFT_PINK}30,${WARM_WHITE})`,
      fontFamily:"'Quicksand','Noto Sans Arabic',sans-serif", color:DARK_PURPLE }}>
      <link href={FONT_LINK} rel="stylesheet" />

      {/* Header */}
      <div style={{ background:"white", borderBottom:`1px solid ${PASTEL_PURPLE}20`,
        padding: isMobile ? "14px 16px" : "16px 32px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:50, boxShadow:`0 2px 12px ${PASTEL_PURPLE}08` }}>
        <button onClick={onBack} style={{ ...backBtnStyle, marginBottom:0 }}>
          ← {t("Back","عودة")}
        </button>
        <div style={{ fontFamily:"'Londrina Solid',cursive", fontSize:20, color:DEEP_PURPLE, letterSpacing:2 }}>
          MIORA <span style={{ fontFamily:"'Quicksand'", fontSize:11, fontWeight:300, opacity:0.5 }}>templates</span>
        </div>
        <div style={{ width:60 }} />
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding: isMobile ? "24px 16px" : "40px 32px" }}>

        {/* Title */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize: isMobile ? 24 : 32, color:DARK_PURPLE, marginBottom:8 }}>
            {t("Choose a Template","اختر قالباً")}
          </h1>
          <p style={{ fontSize:14, color:DARK_PURPLE, opacity:0.5, lineHeight:1.6 }}>
            {t("Pick a design for your occasion. Add your photos inside the editor.",
               "اختر تصميماً لمناسبتك. أضف صورك في المحرر.")}
          </p>
        </div>

        {/* Occasion tab bar */}
        <div style={{ display:"flex", gap: isMobile ? 6 : 10, overflowX:"auto", paddingBottom:8,
          marginBottom:32, justifyContent: isMobile ? "flex-start" : "center", flexWrap: isMobile ? "nowrap" : "wrap" }}>
          {TEMPLATE_OCCASIONS.map(occ => (
            <button key={occ} onClick={() => setActiveOccasion(occ)} style={{
              padding: isMobile ? "8px 14px" : "10px 20px", borderRadius:24, fontSize: isMobile ? 12 : 13,
              fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'Quicksand',sans-serif",
              border: activeOccasion===occ ? `2px solid ${DEEP_PURPLE}` : `1px solid ${PASTEL_PURPLE}40`,
              background: activeOccasion===occ ? `${PASTEL_PURPLE}25` : "white",
              color: activeOccasion===occ ? DEEP_PURPLE : DARK_PURPLE,
              transition:"all 0.2s ease", flexShrink:0 }}>
              {t(occ, occasionAr[occ] || occ)}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div style={{ display:"flex", gap: isMobile ? 16 : 24, flexWrap:"wrap", justifyContent:"center" }}>
          {templates.map(tpl => (
            <div key={tpl.id}
              onMouseEnter={() => setHovered(tpl.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16,
                cursor:"pointer", transition:"transform 0.2s ease",
                transform: hovered===tpl.id ? "translateY(-6px)" : "translateY(0)" }}
              onClick={() => onSelect(tpl)}>

              {/* Book preview */}
              <div style={{ position:"relative" }}>
                <MiniBook tpl={tpl} />
                {/* Hover overlay */}
                {hovered===tpl.id && (
                  <div style={{ position:"absolute", inset:0, borderRadius:6,
                    background:"rgba(123,94,167,0.08)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    border:`2px solid ${DEEP_PURPLE}` }}>
                  </div>
                )}
              </div>

              {/* Label + CTA */}
              <div style={{ textAlign:"center" }}>
                <div style={{ fontWeight:700, fontSize:14, color:DARK_PURPLE, marginBottom:2 }}>{tpl.title}</div>
                <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.45, marginBottom:10 }}>{tpl.desc}</div>
                <button onClick={e => { e.stopPropagation(); onSelect(tpl); }} style={{
                  background: hovered===tpl.id ? DEEP_PURPLE : "transparent",
                  border:`1.5px solid ${DEEP_PURPLE}`,
                  borderRadius:20, padding:"7px 20px", fontSize:12, fontWeight:700,
                  color: hovered===tpl.id ? "white" : DEEP_PURPLE,
                  cursor:"pointer", fontFamily:"'Quicksand',sans-serif",
                  transition:"all 0.2s ease" }}>
                  {t("Use This Template","استخدم هذا القالب")}
                </button>
              </div>
            </div>
          ))}

          {/* Start from scratch card */}
          <div
            onMouseEnter={() => setHovered("scratch")}
            onMouseLeave={() => setHovered(null)}
            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16,
              cursor:"pointer", transition:"transform 0.2s ease",
              transform: hovered==="scratch" ? "translateY(-6px)" : "translateY(0)" }}
            onClick={() => { /* go to blank template editor */ onSelect({ id:"scratch", occasion:activeOccasion, title:"", pages: makeBlankPages(16) }); }}>

            {/* Blank book mockup */}
            <div style={{ display:"flex", perspective:600 }}>
              <div style={{ width: isMobile ? 16 : 20, height: isMobile ? 182 : 224,
                background:`${PASTEL_PURPLE}30`, borderRadius:"4px 0 0 4px", flexShrink:0 }} />
              <div style={{ width: isMobile ? 130 : 160, height: isMobile ? 182 : 224,
                background:"white", borderRadius:"0 6px 6px 0",
                border:`2px dashed ${PASTEL_PURPLE}50`,
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12,
                transform:"perspective(500px) rotateY(-6deg)", transformOrigin:"left center",
                boxShadow:"4px 4px 16px rgba(74,48,104,0.08)" }}>
                <div style={{ width:40, height:40, borderRadius:"50%",
                  border:`2px dashed ${PASTEL_PURPLE}60`,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:20, color:PASTEL_PURPLE }}>+</span>
                </div>
                <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.4, textAlign:"center", padding:"0 12px" }}>
                  {t("Start from scratch","من الصفر")}
                </div>
              </div>
            </div>

            <div style={{ textAlign:"center" }}>
              <div style={{ fontWeight:700, fontSize:14, color:DARK_PURPLE, marginBottom:2 }}>{t("Blank Canvas","لوحة فارغة")}</div>
              <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.45, marginBottom:10 }}>{t("Full creative freedom","حرية إبداعية كاملة")}</div>
              <button onClick={e => { e.stopPropagation(); onSelect({ id:"scratch", occasion:activeOccasion, title:"", pages: makeBlankPages(16) }); }} style={{
                background: hovered==="scratch" ? DARK_PURPLE : "transparent",
                border:`1.5px solid ${DARK_PURPLE}`,
                borderRadius:20, padding:"7px 20px", fontSize:12, fontWeight:700,
                color: hovered==="scratch" ? "white" : DARK_PURPLE,
                cursor:"pointer", fontFamily:"'Quicksand',sans-serif",
                transition:"all 0.2s ease" }}>
                {t("Start from Scratch","ابدأ من الصفر")}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom hint */}
        <p style={{ textAlign:"center", fontSize:12, color:DARK_PURPLE, opacity:0.35, marginTop:40, lineHeight:1.6 }}>
          {t("All templates are fully customisable — change colours, fonts, add photos and stickers in the editor.",
             "جميع القوالب قابلة للتخصيص بالكامل — غيّر الألوان والخطوط وأضف الصور والملصقات في المحرر.")}
        </p>
      </div>
    </div>
  );
}

// ─── Clean SVG Icons (replaces all emojis on the marketing site) ─────────────
const Icon = ({ name, size=20, color="currentColor", strokeWidth=1.5 }) => {
  const s = { width:size, height:size, display:"inline-block", verticalAlign:"middle", flexShrink:0 };
  const p = { stroke:color, strokeWidth, strokeLinecap:"round", strokeLinejoin:"round", fill:"none" };
  const icons = {
    camera:    <svg style={s} viewBox="0 0 24 24"><path {...p} d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle {...p} cx="12" cy="13" r="4"/></svg>,
    palette:   <svg style={s} viewBox="0 0 24 24"><path {...p} d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10 1.1 0 2-.9 2-2 0-.53-.2-1-.53-1.36-.32-.36-.5-.83-.5-1.31 0-1.1.9-2 2-2h2.36C19.73 15.33 22 13.8 22 12c0-5.52-4.48-10-10-10z"/><circle cx="6.5" cy="11.5" r="1.5" fill={color} stroke="none"/><circle cx="9.5" cy="7.5" r="1.5" fill={color} stroke="none"/><circle cx="14.5" cy="7.5" r="1.5" fill={color} stroke="none"/><circle cx="17.5" cy="11.5" r="1.5" fill={color} stroke="none"/></svg>,
    creditcard:<svg style={s} viewBox="0 0 24 24"><rect {...p} x="1" y="4" width="22" height="16" rx="2"/><line {...p} x1="1" y1="10" x2="23" y2="10"/></svg>,
    package:   <svg style={s} viewBox="0 0 24 24"><path {...p} d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline {...p} points="3.27 6.96 12 12.01 20.73 6.96"/><line {...p} x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    edit:      <svg style={s} viewBox="0 0 24 24"><path {...p} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path {...p} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    sparkles:  <svg style={s} viewBox="0 0 24 24"><path {...p} d="M12 3L9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5L12 3z"/></svg>,
    template:  <svg style={s} viewBox="0 0 24 24"><rect {...p} x="3" y="3" width="18" height="18" rx="2"/><path {...p} d="M3 9h18M9 21V9"/></svg>,
    folder:    <svg style={s} viewBox="0 0 24 24"><path {...p} d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
    receipt:   <svg style={s} viewBox="0 0 24 24"><path {...p} d="M4 2v20l3-2 2 2 3-2 2 2 3-2 3 2V2l-3 2-2-2-3 2-2-2-3 2-2-2z"/><line {...p} x1="9" y1="9" x2="15" y2="9"/><line {...p} x1="9" y1="13" x2="15" y2="13"/></svg>,
    heart:     <svg style={s} viewBox="0 0 24 24"><path {...p} d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
    check:     <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="20 6 9 17 4 12"/></svg>,
    upload:    <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="16 16 12 12 8 16"/><line {...p} x1="12" y1="12" x2="12" y2="21"/><path {...p} d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
    save:      <svg style={s} viewBox="0 0 24 24"><path {...p} d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline {...p} points="17 21 17 13 7 13 7 21"/><polyline {...p} points="7 3 7 8 15 8"/></svg>,
    trash:     <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="3 6 5 6 21 6"/><path {...p} d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path {...p} d="M10 11v6M14 11v6"/><path {...p} d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
    layers:    <svg style={s} viewBox="0 0 24 24"><polygon {...p} points="12 2 2 7 12 12 22 7 12 2"/><polyline {...p} points="2 17 12 22 22 17"/><polyline {...p} points="2 12 12 17 22 12"/></svg>,
    pdf:       <svg style={s} viewBox="0 0 24 24"><path {...p} d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline {...p} points="14 2 14 8 20 8"/><line {...p} x1="16" y1="13" x2="8" y2="13"/><line {...p} x1="16" y1="17" x2="8" y2="17"/><polyline {...p} points="10 9 9 9 8 9"/></svg>,
    order:     <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="9" cy="21" r="1"/><circle {...p} cx="20" cy="21" r="1"/><path {...p} d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
    ai:        <svg style={s} viewBox="0 0 24 24"><path {...p} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    instagram: <svg style={s} viewBox="0 0 24 24"><rect {...p} x="2" y="2" width="20" height="20" rx="5"/><circle {...p} cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill={color} stroke="none"/></svg>,
    whatsapp:  <svg style={s} viewBox="0 0 24 24"><path {...p} d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
    arrowup:   <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="17 11 12 6 7 11"/><line {...p} x1="12" y1="18" x2="12" y2="6"/></svg>,
    arrowdown: <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="17 13 12 18 7 13"/><line {...p} x1="12" y1="6" x2="12" y2="18"/></svg>,
    text:      <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="4 7 4 4 20 4 20 7"/><line {...p} x1="9" y1="20" x2="15" y2="20"/><line {...p} x1="12" y1="4" x2="12" y2="20"/></svg>,
    image:     <svg style={s} viewBox="0 0 24 24"><rect {...p} x="3" y="3" width="18" height="18" rx="2"/><circle {...p} cx="8.5" cy="8.5" r="1.5"/><polyline {...p} points="21 15 16 10 5 21"/></svg>,
    sticker:   <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="12" cy="12" r="10"/><path {...p} d="M8 14s1.5 2 4 2 4-2 4-2"/><line {...p} x1="9" y1="9" x2="9.01" y2="9"/><line {...p} x1="15" y1="9" x2="15.01" y2="9"/></svg>,
    bg:        <svg style={s} viewBox="0 0 24 24"><path {...p} d="M3 3h18v18H3z"/><path {...p} d="M3 9h18M9 3v18"/></svg>,
    font:      <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="4 7 4 4 20 4 20 7"/><line {...p} x1="9" y1="20" x2="15" y2="20"/><line {...p} x1="12" y1="4" x2="12" y2="20"/></svg>,
  };
  return icons[name] || null;
};

// ─── Small shared components ──────────────────────────────────────────────────
function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom:48 }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(24px,4vw,36px)", color:DARK_PURPLE, marginBottom:8 }}>{title}</h2>
      <p style={{ fontSize:14, color:DARK_PURPLE, opacity:0.5, maxWidth:500, margin:"0 auto", lineHeight:1.6 }}>{subtitle}</p>
      <div style={{ width:48, height:3, background:`linear-gradient(90deg,${PASTEL_PURPLE},${GOLD_ACCENT})`, borderRadius:2, margin:"16px auto 0" }} />
    </div>
  );
}
function HeroBtn({ label, primary, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding:"14px 36px", borderRadius:30, fontSize:15, fontWeight:600,
      background: primary ? `linear-gradient(135deg,${DEEP_PURPLE},${DARK_PURPLE})` : "transparent",
      color: primary ? "white" : DEEP_PURPLE,
      border: primary ? "none" : `2px solid ${PASTEL_PURPLE}60`,
      cursor:"pointer", fontFamily:"'Quicksand',sans-serif", transition:"all 0.3s ease", letterSpacing:0.5 }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow=`0 6px 20px ${PASTEL_PURPLE}30`; }}
      onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)";   e.currentTarget.style.boxShadow="none"; }}>
      {label}
    </button>
  );
}
function CreateOptionCard({ icon, title, desc, onClick, gradient, badge, isMobile }) {
  return (
    <div onClick={onClick} style={{ flex: isMobile ? "none" : "1 1 260px",
      width: isMobile ? "100%" : undefined, maxWidth: isMobile ? "100%" : 300,
      background:gradient||"white",
      borderRadius:16, padding: isMobile ? "16px 20px" : 32, cursor:"pointer",
      border:`1px solid ${PASTEL_PURPLE}20`, position:"relative",
      transition:"all 0.3s ease",
      display: isMobile ? "flex" : "block",
      alignItems: isMobile ? "center" : undefined,
      gap: isMobile ? 16 : undefined,
      textAlign: isMobile ? "left" : "center",
      boxShadow:`0 2px 16px ${PASTEL_PURPLE}08` }}
      onMouseEnter={e => { if(!isMobile){e.currentTarget.style.transform="translateY(-6px)";e.currentTarget.style.boxShadow=`0 12px 32px ${PASTEL_PURPLE}20`;} }}
      onMouseLeave={e => { if(!isMobile){e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=`0 2px 16px ${PASTEL_PURPLE}08`;} }}>
      {badge && <div style={{ position:"absolute", top:12, right:12, background:GOLD_ACCENT, color:"white", fontSize:10, fontWeight:700, padding:"4px 10px", borderRadius:10 }}>{badge}</div>}
      <div style={{ fontSize: isMobile ? 32 : 40, marginBottom: isMobile ? 0 : 16, flexShrink:0 }}>{icon}</div>
      <div style={{ flex:1 }}>
        <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize: isMobile ? 16 : 18, color:DARK_PURPLE, marginBottom: isMobile ? 4 : 12 }}>{title}</h3>
        <p style={{ fontSize: isMobile ? 12 : 13, lineHeight:1.6, color:DARK_PURPLE, opacity:0.6 }}>{desc}</p>
      </div>
      {!isMobile && <div style={{ marginTop:20, fontSize:13, fontWeight:700, color:DEEP_PURPLE }}>→</div>}
      {isMobile && <div style={{ fontSize:18, color:DEEP_PURPLE, flexShrink:0 }}>›</div>}
    </div>
  );
}

// ─── My Projects View ─────────────────────────────────────────────────────────
function MyProjectsView({ projects, onBack, onOpen, onDelete, t, lang, isRTL }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const modeLabels = {
    manual:   { en:"Manual Design", ar:"تصميم يدوي",   icon:"✏️" },
    ai:       { en:"AI Design",     ar:"تصميم ذكي",    icon:"🤖" },
    template: { en:"Template",      ar:"قالب",          icon:"📋" },
  };
  const fmt = iso => { try { return new Date(iso).toLocaleDateString(lang==="ar"?"ar-JO":"en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); } catch{return iso;} };

  return (
    <div dir={isRTL?"rtl":"ltr"} style={{ ...pageShell, background:`linear-gradient(180deg,${SOFT_PINK}30,${WARM_WHITE})` }}>
      <link href={FONT_LINK} rel="stylesheet" />
      <button onClick={onBack} style={backBtnStyle}>← {t("Back to Home","العودة للرئيسية")}</button>
      <div style={{ maxWidth:680, margin:"0 auto" }}>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, textAlign:"center", marginBottom:8, color:DARK_PURPLE }}>{t("My Saved Projects","مشاريعي المحفوظة")}</h1>
        <p style={{ textAlign:"center", fontSize:13, color:DARK_PURPLE, opacity:0.5, marginBottom:32 }}>{t("Pick up where you left off.","أكمل من حيث توقفت.")}</p>
        {projects.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, background:"white", borderRadius:20, border:`1px solid ${PASTEL_PURPLE}15` }}>
            <div style={{ marginBottom:16, opacity:0.25 }}><Icon name="folder" size={48} color={DARK_PURPLE} /></div>
            <div style={{ fontSize:16, fontWeight:600, color:DARK_PURPLE }}>{t("No projects yet","لا توجد مشاريع بعد")}</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {projects.map(proj => {
              const ml = modeLabels[proj.mode] || modeLabels.manual;
              const pageCount = proj.pages?.length || 1;
              const imgCount  = (proj.pages||[]).reduce((a,pg) => a + (pg.elements||[]).filter(e=>e.type==="image").length, 0);
              return (
                <div key={proj.id} style={{ background:"white", borderRadius:16, padding:"20px 24px",
                  border:`1px solid ${PASTEL_PURPLE}15`, display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:14, flex:1, minWidth:200 }}>
                    <div style={{ width:44, height:44, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, background:`${PASTEL_PURPLE}15` }}>{ml.icon}</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:DARK_PURPLE }}>{proj.title || t(ml.en,ml.ar)} — {proj.occasion}</div>
                      <div style={{ fontSize:12, color:DARK_PURPLE, opacity:0.45, marginTop:2 }}>
                        {t("Last edited","آخر تعديل")}: {fmt(proj.updatedAt)} · {pageCount} {t("pages","صفحات")} · {imgCount} {t("photos","صور")}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => onOpen(proj.id)} style={{ background:DEEP_PURPLE, color:"white", border:"none", borderRadius:12, padding:"8px 18px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Quicksand',sans-serif" }}>{t("Continue","تابع")}</button>
                    {confirmDelete === proj.id ? (
                      <div style={{ display:"flex", gap:4 }}>
                        <button onClick={() => { onDelete(proj.id); setConfirmDelete(null); }} style={{ background:"#e74c3c", color:"white", border:"none", borderRadius:10, padding:"8px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'Quicksand',sans-serif" }}>{t("Yes","نعم")}</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ background:`${PASTEL_PURPLE}20`, color:DARK_PURPLE, border:"none", borderRadius:10, padding:"8px 12px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'Quicksand',sans-serif" }}>{t("No","لا")}</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(proj.id)} style={{ background:`${PASTEL_PURPLE}15`, color:DARK_PURPLE, border:"none", borderRadius:12, padding:"8px 14px", fontSize:12, cursor:"pointer", fontFamily:"'Quicksand',sans-serif", opacity:0.6 }}>{t("Delete","حذف")}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── My Orders View (live status from Firestore) ─────────────────────────────
function MyOrdersView({ authUser, onBack, t, lang, isRTL }) {
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!authUser) return;
    const q = query(collection(db, "payments"), where("customerUid", "==", authUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||""));
      setPayments(list);
      setLoading(false);
    }, (err) => { console.error("Orders listener failed:", err); setLoading(false); });
    return unsub;
  }, [authUser]);

  const fmt = iso => { try { return new Date(iso).toLocaleDateString(lang==="ar"?"ar-JO":"en-US",{month:"short",day:"numeric",year:"numeric"}); } catch{return iso;} };
  const statusColors = { pending:GOLD_ACCENT, approved:"#27ae60", rejected:"#e74c3c" };
  const statusLabel = s => s==="pending" ? t("Pending Review","قيد المراجعة") : s==="approved" ? t("Approved","تمت الموافقة") : t("Rejected","مرفوض");

  return (
    <div dir={isRTL?"rtl":"ltr"} style={{ ...pageShell, background:`linear-gradient(180deg,${SOFT_PINK}30,${WARM_WHITE})` }}>
      <link href={FONT_LINK} rel="stylesheet" />
      <button onClick={onBack} style={backBtnStyle}>← {t("Back","عودة")}</button>
      <div style={{ maxWidth:600, margin:"0 auto" }}>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, textAlign:"center", marginBottom:32, color:DARK_PURPLE }}>{t("My Orders","طلباتي")}</h1>
        {loading ? (
          <div style={{ textAlign:"center", padding:40, color:DARK_PURPLE, opacity:0.5, fontSize:14 }}>{t("Loading...","جاري التحميل...")}</div>
        ) : payments.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, background:"white", borderRadius:20, border:`1px solid ${PASTEL_PURPLE}15` }}>
            <div style={{ marginBottom:16, opacity:0.25 }}><Icon name="receipt" size={48} color={DARK_PURPLE} /></div>
            <div style={{ fontSize:16, fontWeight:600, color:DARK_PURPLE }}>{t("No orders yet","لا توجد طلبات بعد")}</div>
          </div>
        ) : payments.map((pay) => (
          <div key={pay.id} style={{ background:"white", borderRadius:16, padding:"20px 24px", marginBottom:12, border:`1px solid ${PASTEL_PURPLE}15`, display:"flex", gap:16, alignItems:"center" }}>
            {pay.proofImage && <img src={pay.proofImage} alt="proof" style={{ width:56, height:56, objectFit:"cover", borderRadius:10, flexShrink:0 }} />}
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <div style={{ fontWeight:700, fontSize:15, color:DARK_PURPLE }}>{pay.package?.pages||"—"} {t("pages","صفحة")}</div>
                <div style={{ fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:10, color:"white", background:statusColors[pay.status]||GOLD_ACCENT }}>
                  {statusLabel(pay.status)}
                </div>
              </div>
              <div style={{ fontSize:13, color:DARK_PURPLE, opacity:0.5 }}>{pay.package?.price||"—"} · {t("Submitted","أُرسل")}: {fmt(pay.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Payment View (writes directly to Firestore, no Storage needed) ──────────
function PaymentView({ selectedPackage, authUser, onBack, t, lang, isRTL }) {
  const fileRef = useRef(null);
  const [file,      setFile]      = useState(null);
  const [preview,   setPreview]   = useState(null);
  const [sending,   setSending]   = useState(false);
  const [sendError, setSendError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setSendError(null);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!file || !authUser) return;
    setSending(true);
    setSendError(null);

    try {
      // Compress the screenshot so it fits inside a Firestore document (no paid Storage needed)
      const compressed = await compressImageFile(file, 900, 0.7);

      await addDoc(collection(db, "payments"), {
        customerUid: authUser.uid,
        package: selectedPackage,
        status: "pending",
        proofImage: compressed,
        createdAt: new Date().toISOString(),
      });

      // Best-effort instant email heads-up to Layal (no attachment — she reviews in the admin panel)
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          package_name:    selectedPackage ? `${selectedPackage.pages} ${t("pages","صفحة")}` : "—",
          package_price:   selectedPackage ? selectedPackage.price : "—",
          submission_date: new Date().toLocaleString(lang==="ar"?"ar-JO":"en-US"),
        }, { publicKey: EMAILJS_PUBLIC_KEY });
      } catch (emailErr) {
        console.warn("Email notification failed (non-blocking):", emailErr);
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Firestore submission failed:", err);
      setSendError(t(
        "Something went wrong saving your payment proof. Please check your connection and try again, or contact Layal directly via WhatsApp.",
        "حدث خطأ أثناء حفظ إثبات الدفع. يرجى التحقق من اتصالك والمحاولة مرة أخرى، أو التواصل مع ليال مباشرة عبر واتساب."
      ));
    } finally {
      setSending(false);
    }
  };

  return (
    <div dir={isRTL?"rtl":"ltr"} style={{ ...pageShell, background:`linear-gradient(180deg,${SOFT_PINK}40,${WARM_WHITE})` }}>
      <link href={FONT_LINK} rel="stylesheet" />
      <button onClick={onBack} style={backBtnStyle}>← {t("Back","عودة")}</button>
      <div style={{ maxWidth:520, margin:"0 auto" }}>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, textAlign:"center", marginBottom:24, color:DARK_PURPLE }}>{t("Complete Your Order","أكمل طلبك")}</h1>
        {selectedPackage && (
          <div style={{ background:"white", borderRadius:16, padding:24, marginBottom:24,
            border:`2px solid ${PASTEL_PURPLE}30`, textAlign:"center" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginBottom:8 }}>
              <span style={{ fontSize:11, background:`${PASTEL_PURPLE}20`, color:DEEP_PURPLE,
                padding:"3px 10px", borderRadius:10, fontWeight:700, letterSpacing:0.5 }}>
                ✓ {t("Auto-detected from your album","تم اكتشافه تلقائياً من ألبومك")}
              </span>
            </div>
            <div style={{ fontSize:20, fontWeight:700, color:DEEP_PURPLE }}>{selectedPackage.pages} {t("pages","صفحة")}</div>
            <div style={{ fontSize:28, fontWeight:700, color:GOLD_ACCENT, marginTop:4 }}>{selectedPackage.price}</div>
          </div>
        )}
        {!submitted ? (
          <div style={{ background:"white", borderRadius:20, padding:32, border:`1px solid ${PASTEL_PURPLE}20` }}>
            <h3 style={{ fontSize:16, fontWeight:700, marginBottom:20, textAlign:"center", color:DARK_PURPLE }}>{t("Payment via CliQ","الدفع عبر كليك")}</h3>
            <div style={{ background:`${SOFT_PINK}30`, borderRadius:12, padding:20, marginBottom:24, border:`1px dashed ${PASTEL_PURPLE}40` }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:8, color:DEEP_PURPLE }}>{t("Instructions:","تعليمات الدفع:")}</div>
              <div style={{ fontSize:13, lineHeight:1.9, color:DARK_PURPLE, opacity:0.7 }}>
                1. {t("Open your banking app","افتح تطبيق البنك")}<br/>
                2. {t("Send via CliQ to:","أرسل عبر كليك إلى:")} <strong style={{ color:DEEP_PURPLE }}>Miora.Layal</strong><br/>
                3. {t("Screenshot your confirmation","التقط لقطة الشاشة")}<br/>
                4. {t("Upload screenshot below","ارفع لقطة الشاشة أدناه")}
              </div>
            </div>
            <div onClick={() => fileRef.current?.click()} style={{ border:`2px dashed ${PASTEL_PURPLE}50`, borderRadius:16, padding:32,
              textAlign:"center", cursor:"pointer", marginBottom:20, transition:"all 0.2s ease" }}
              onMouseEnter={e => e.currentTarget.style.borderColor=DEEP_PURPLE}
              onMouseLeave={e => e.currentTarget.style.borderColor=`${PASTEL_PURPLE}50`}>
              {preview ? <img src={preview} alt="proof" style={{ maxWidth:"100%", maxHeight:200, borderRadius:8 }} /> : (
                <>
                  <div style={{ marginBottom:8, opacity:0.4 }}><Icon name="upload" size={36} color={DEEP_PURPLE} /></div>
                  <div style={{ fontSize:14, fontWeight:600, color:DEEP_PURPLE }}>{t("Upload Payment Proof","ارفع إثبات الدفع")}</div>
                  <div style={{ fontSize:12, color:DARK_PURPLE, opacity:0.4, marginTop:4 }}>{t("Click to select screenshot","اضغط لاختيار الصورة")}</div>
                </>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }} />
            </div>
            {sendError && (
              <p style={{ fontSize:13, color:"#b8860b", lineHeight:1.6, background:"#fffaf0", padding:12, borderRadius:12, border:"1px solid #f5deb3", marginBottom:16 }}>{sendError}</p>
            )}
            <button onClick={handleSubmit} disabled={!file || sending || !authUser} style={{ ...primaryBtnStyle, opacity:(file && !sending && authUser)?1:0.5, cursor:(file && !sending && authUser)?"pointer":"not-allowed" }}>
              {sending ? t("Submitting...","جاري الإرسال...") : t("Submit Payment Proof","إرسال إثبات الدفع")}
            </button>
          </div>
        ) : (
          <div style={{ background:"white", borderRadius:20, padding:40, textAlign:"center", border:`1px solid ${PASTEL_PURPLE}20` }}>
            <div style={{ marginBottom:16, width:64, height:64, borderRadius:"50%", background:"#e8f8f0",
              display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <Icon name="check" size={32} color="#27ae60" strokeWidth={2.5} />
            </div>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:DARK_PURPLE, marginBottom:12 }}>
              {t("Payment Proof Submitted!","تم إرسال إثبات الدفع!")}
            </h3>
            <p style={{ fontSize:14, color:DARK_PURPLE, opacity:0.6, lineHeight:1.6 }}>
              {t("Layal has been notified and will review your payment shortly. Check \"My Orders\" anytime to see the live status.",
                 "تم إشعار ليال وستراجع دفعتك قريباً. تحقق من \"طلباتي\" في أي وقت لرؤية الحالة المباشرة.")}
            </p>
            <div style={{ marginTop:20, padding:16, borderRadius:12, background:`${PASTEL_PURPLE}10`, fontSize:13, color:DEEP_PURPLE }}>
              {t("Status:","الحالة:")} <strong style={{ color:GOLD_ACCENT }}>{t("Pending Review","قيد المراجعة")}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin View (Layal's dashboard) ──────────────────────────────────────────
function AdminView({ authUser, onExit, t, lang, isRTL }) {
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [loginError,  setLoginError]  = useState(null);
  const [loggingIn,   setLoggingIn]   = useState(false);
  const [payments,    setPayments]    = useState([]);
  const [loadingPays, setLoadingPays] = useState(true);
  const [filter,       setFilter]     = useState("pending"); // pending|approved|rejected|all

  const isAdmin = authUser && authUser.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) { setLoadingPays(false); return; }
    const q = query(collection(db, "payments"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingPays(false);
    }, (err) => { console.error("Admin listener failed:", err); setLoadingPays(false); });
    return unsub;
  }, [isAdmin]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      console.error("Admin login failed:", err);
      setLoginError(t("Incorrect email or password.","البريد الإلكتروني أو كلمة المرور غير صحيحة."));
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    onExit();
  };

  const setStatus = async (paymentId, status) => {
    try {
      await updateDoc(doc(db, "payments", paymentId), { status });
    } catch (err) {
      console.error("Failed to update status:", err);
      alert(t("Failed to update — please check your connection and try again.","فشل التحديث — يرجى التحقق من اتصالك والمحاولة مرة أخرى."));
    }
  };

  const fmt = iso => { try { return new Date(iso).toLocaleString(lang==="ar"?"ar-JO":"en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); } catch{return iso;} };
  const statusColors = { pending:GOLD_ACCENT, approved:"#27ae60", rejected:"#e74c3c" };
  const statusLabel = s => s==="pending" ? t("Pending","قيد الانتظار") : s==="approved" ? t("Approved","تمت الموافقة") : t("Rejected","مرفوض");

  const visiblePayments = filter === "all" ? payments : payments.filter(p => p.status === filter);
  const counts = {
    pending:  payments.filter(p=>p.status==="pending").length,
    approved: payments.filter(p=>p.status==="approved").length,
    rejected: payments.filter(p=>p.status==="rejected").length,
    all:      payments.length,
  };

  // ── Not logged in as admin → show login form ──────────────────────────────
  if (!isAdmin) {
    return (
      <div dir={isRTL?"rtl":"ltr"} style={{ ...pageShell, background:`linear-gradient(180deg,${SOFT_PINK}40,${WARM_WHITE})`, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <link href={FONT_LINK} rel="stylesheet" />
        <div style={{ maxWidth:380, width:"100%", background:"white", borderRadius:20, padding:36, border:`1px solid ${PASTEL_PURPLE}20`, boxShadow:`0 8px 32px ${PASTEL_PURPLE}15` }}>
          <div style={{ textAlign:"center", marginBottom:24 }}>
            <div style={{ fontFamily:"'Londrina Solid',cursive", fontSize:28, color:DEEP_PURPLE, letterSpacing:2 }}>MIORA</div>
            <div style={{ fontSize:13, color:DARK_PURPLE, opacity:0.5, marginTop:4 }}>{t("Admin Login","تسجيل دخول الإدارة")}</div>
          </div>
          <form onSubmit={handleLogin}>
            <input type="email" required placeholder={t("Email","البريد الإلكتروني")} value={email}
              onChange={e=>setEmail(e.target.value)} style={inputStyle} dir="ltr" />
            <input type="password" required placeholder={t("Password","كلمة المرور")} value={password}
              onChange={e=>setPassword(e.target.value)} style={inputStyle} dir="ltr" />
            {loginError && <p style={{ fontSize:13, color:"#e74c3c", marginBottom:16, textAlign:"center" }}>{loginError}</p>}
            <button type="submit" disabled={loggingIn} style={{ ...primaryBtnStyle, opacity:loggingIn?0.6:1 }}>
              {loggingIn ? t("Logging in...","جاري الدخول...") : t("Log In","دخول")}
            </button>
          </form>
          <button onClick={onExit} style={{ width:"100%", marginTop:12, background:"none", border:"none", color:DARK_PURPLE, opacity:0.5, fontSize:13, cursor:"pointer", fontFamily:"'Quicksand',sans-serif" }}>
            ← {t("Back to site","العودة للموقع")}
          </button>
        </div>
      </div>
    );
  }

  // ── Admin dashboard ─────────────────────────────────────────────────────
  return (
    <div dir={isRTL?"rtl":"ltr"} style={{ minHeight:"100vh", background:`linear-gradient(180deg,${SOFT_PINK}20,${WARM_WHITE})`, fontFamily:"'Quicksand','Noto Sans Arabic',sans-serif", color:DARK_PURPLE }}>
      <link href={FONT_LINK} rel="stylesheet" />
      <div style={{ background:"white", borderBottom:`1px solid ${PASTEL_PURPLE}20`, padding:"16px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div style={{ fontFamily:"'Londrina Solid',cursive", fontSize:22, color:DEEP_PURPLE, letterSpacing:1 }}>
          MIORA <span style={{ fontFamily:"'Quicksand'", fontSize:12, fontWeight:400, opacity:0.5 }}>{t("Admin","الإدارة")}</span>
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <span style={{ fontSize:13, color:DARK_PURPLE, opacity:0.5 }}>{ADMIN_EMAIL}</span>
          <button onClick={handleLogout} style={{ background:`${PASTEL_PURPLE}20`, border:`1px solid ${PASTEL_PURPLE}40`, borderRadius:10, padding:"8px 16px", fontSize:12, fontWeight:700, color:DEEP_PURPLE, cursor:"pointer", fontFamily:"'Quicksand',sans-serif" }}>
            {t("Log Out","تسجيل خروج")}
          </button>
        </div>
      </div>

      <div style={{ maxWidth:800, margin:"0 auto", padding:24 }}>
        <div style={{ display:"flex", gap:8, marginBottom:24, flexWrap:"wrap" }}>
          {["pending","approved","rejected","all"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding:"8px 16px", borderRadius:20, fontSize:13, fontWeight:700, cursor:"pointer",
              border: filter===f ? `2px solid ${DEEP_PURPLE}` : `1px solid ${PASTEL_PURPLE}30`,
              background: filter===f ? `${PASTEL_PURPLE}20` : "white",
              color: filter===f ? DEEP_PURPLE : DARK_PURPLE, fontFamily:"'Quicksand',sans-serif" }}>
              {f==="pending"?t("Pending","قيد الانتظار"):f==="approved"?t("Approved","تمت الموافقة"):f==="rejected"?t("Rejected","مرفوض"):t("All","الكل")} ({counts[f]})
            </button>
          ))}
        </div>

        {loadingPays ? (
          <div style={{ textAlign:"center", padding:60, color:DARK_PURPLE, opacity:0.5 }}>{t("Loading submissions...","جاري تحميل الطلبات...")}</div>
        ) : visiblePayments.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, background:"white", borderRadius:20, border:`1px solid ${PASTEL_PURPLE}15` }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
            <div style={{ fontSize:16, fontWeight:600, color:DARK_PURPLE }}>{t("No submissions here","لا توجد طلبات هنا")}</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {visiblePayments.map(pay => (
              <div key={pay.id} style={{ background:"white", borderRadius:16, padding:20, border:`1px solid ${PASTEL_PURPLE}15`, display:"flex", gap:16, flexWrap:"wrap" }}>
                {pay.proofImage ? (
                  <img src={pay.proofImage} alt="proof" style={{ width:140, height:140, objectFit:"cover", borderRadius:12, flexShrink:0, cursor:"pointer" }}
                    onClick={() => window.open(pay.proofImage, "_blank")} />
                ) : (
                  <div style={{ width:140, height:140, borderRadius:12, background:`${PASTEL_PURPLE}10`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Icon name="image" size={32} color={PASTEL_PURPLE} /></div>
                )}
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:8 }}>
                    <div style={{ fontWeight:700, fontSize:16, color:DARK_PURPLE }}>{pay.package?.pages||"—"} {t("pages","صفحة")} — {pay.package?.price||"—"}</div>
                    <div style={{ fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:10, color:"white", background:statusColors[pay.status]||GOLD_ACCENT }}>
                      {statusLabel(pay.status)}
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:DARK_PURPLE, opacity:0.5, marginBottom:14 }}>
                    {t("Submitted","أُرسل")}: {fmt(pay.createdAt)}
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => setStatus(pay.id, "approved")} disabled={pay.status==="approved"} style={{
                      flex:1, padding:"10px", borderRadius:10, border:"none", fontSize:13, fontWeight:700,
                      background: pay.status==="approved" ? "#d4f4dd" : "#27ae60",
                      color: pay.status==="approved" ? "#27ae60" : "white",
                      cursor: pay.status==="approved" ? "default" : "pointer", fontFamily:"'Quicksand',sans-serif" }}>
                      ✓ {t("Approve","موافقة")}
                    </button>
                    <button onClick={() => setStatus(pay.id, "rejected")} disabled={pay.status==="rejected"} style={{
                      flex:1, padding:"10px", borderRadius:10, border:"none", fontSize:13, fontWeight:700,
                      background: pay.status==="rejected" ? "#fbd9d6" : "#e74c3c",
                      color: pay.status==="rejected" ? "#e74c3c" : "white",
                      cursor: pay.status==="rejected" ? "default" : "pointer", fontFamily:"'Quicksand',sans-serif" }}>
                      ✕ {t("Reject","رفض")}
                    </button>
                    {pay.status !== "pending" && (
                      <button onClick={() => setStatus(pay.id, "pending")} style={{
                        padding:"10px 14px", borderRadius:10, border:`1px solid ${PASTEL_PURPLE}30`, fontSize:13, fontWeight:600,
                        background:"white", color:DARK_PURPLE, cursor:"pointer", fontFamily:"'Quicksand',sans-serif" }}>
                        ↺
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Book Editor View ─────────────────────────────────────────────────────────
// The full canvas editor: images, stickers, text, multi-page, auto-save
function BookEditorView({ mode, project, onBack, onUpdate, onDone, t, lang, isRTL, isMobile }) {
  // ── Local state (mirrors project, synced to parent on save) ──────────────
  const [pages,       setPages]       = useState(() => project.pages && project.pages.length ? project.pages : [{ id:generateId(), background:"#ffffff", elements:[] }]);
  const [currentPage, setCurrentPage] = useState(0);
  const [title,       setTitle]       = useState(project.title || "");
  const [occasion,    setOccasion]    = useState(project.occasion || "General");
  const [selected,    setSelected]    = useState(null);   // selected element id
  const [tool]                        = useState("select"); // select|text|sticker
  const [stickerPack, setStickerPack] = useState("hearts");
  const [aiRunning,   setAiRunning]   = useState(false);
  const [aiDone,      setAiDone]      = useState(false);
  const [leftTab,     setLeftTab]     = useState("pages"); // pages|stickers|fonts|backgrounds
  const [lastSaved,   setLastSaved]   = useState(null);
  const [dragging,    setDragging]    = useState(null);   // { elId, startX, startY, origX, origY }
  const [resizing,    setResizing]    = useState(null);
  const [exporting,   setExporting]   = useState(false);  // PDF export in progress
  const [exported,    setExported]    = useState(false);  // PDF just downloaded
  const pageExportRefs = useRef([]);  // array of DOM refs for each page, used by html2canvas

  // Mobile-specific state
  const [mobilePanel, setMobilePanel] = useState(null); // null | "stickers" | "fonts" | "pages" | "backgrounds"
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const canvasRef = useRef(null);
  const fileRef   = useRef(null);
  const autoSaveTimer = useRef(null);

  // ── Spread view: always show 2 pages side by side ────────────────────────
  // currentPage always points to the LEFT page of the current spread.
  // spreadIndex = which spread we're on (0 = cover spread, 1 = first interior spread, etc.)
  // activeSide = "left" | "right" — which page is currently being edited
  const [activeSide, setActiveSide] = useState("right"); // default to front cover on load

  const spreadIndex   = Math.floor(currentPage / 2);
  const leftPageIdx   = spreadIndex * 2;
  const rightPageIdx  = spreadIndex * 2 + 1;
  const leftPage      = pages[leftPageIdx]  || { id:"empty-l", background:"#ffffff", elements:[] };
  const rightPage     = pages[rightPageIdx] || { id:"empty-r", background:"#ffffff", elements:[] };
  const activePageIdx = activeSide === "left" ? leftPageIdx : rightPageIdx;
  const page          = activeSide === "left" ? leftPage : rightPage;
  const totalSpreads  = Math.ceil(pages.length / 2);

  // ── Auto-save every 30 s ────────────────────────────────────────────────
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => doSave(), 30000);
    return () => clearInterval(autoSaveTimer.current);
  // eslint-disable-next-line
  }, [pages, title, occasion]);

  // ── Keyboard: delete selected element ───────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        removeElement(selected);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line
  }, [selected]);

  const doSave = () => {
    onUpdate({ pages, title, occasion });
    setLastSaved(new Date());
  };

  const handleExportPDF = async () => {
    setExporting(true);
    setExported(false);
    try {
      const refs = pageExportRefs.current.filter(Boolean);
      if (refs.length === 0) throw new Error("No page refs found");
      const pdf = await exportAlbumToPDF(refs, title || "Miora Album");
      const fileName = `${(title || "Miora-Album").replace(/\s+/g,"-")}-${Date.now()}.pdf`;
      pdf.save(fileName);
      setExported(true);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert(t("PDF export failed. Please try again.","فشل تصدير PDF. يرجى المحاولة مرة أخرى."));
    } finally {
      setExporting(false);
    }
  };

  const whatsappPDFMessage = encodeURIComponent(
    t(
      `Hi Layal! I've finished designing my album "${title || "My Album"}" (${pages.length} pages). I'm attaching the PDF below for printing. Please confirm receipt! 💜`,
      `مرحباً ليال! لقد انتهيت من تصميم ألبومي "${title || "ألبومي"}" (${pages.length} صفحة). أرفق ملف PDF أدناه للطباعة. يرجى تأكيد الاستلام! 💜`
    )
  );
  const whatsappPDFLink = `https://wa.me/${LAYAL_WHATSAPP_NUMBER}?text=${whatsappPDFMessage}`;

  const fmtTime = d => d ? d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "";

  // ── Page helpers ─────────────────────────────────────────────────────────
  const addPage = () => {
    // Always add 2 pages to maintain even spread pairing
    const np1 = { id:generateId(), background:"#ffffff", elements:[] };
    const np2 = { id:generateId(), background:"#ffffff", elements:[] };
    const next = [...pages, np1, np2];
    setPages(next);
    setCurrentPage(next.length - 2); // jump to new spread's left page
    setActiveSide("left");
    setSelected(null);
  };
  const removePage = idx => {
    // Remove the entire spread (both pages) if not the cover spread
    const spreadIdx = Math.floor(idx / 2);
    if (spreadIdx === 0) return; // never remove cover spread
    const leftIdx  = spreadIdx * 2;
    const rightIdx = spreadIdx * 2 + 1;
    const next = pages.filter((_,i) => i !== leftIdx && i !== rightIdx);
    setPages(next);
    const newSpread = Math.min(spreadIdx - 1, Math.ceil(next.length / 2) - 1);
    setCurrentPage(newSpread * 2);
    setActiveSide("left");
    setSelected(null);
  };
  const updatePage = (idx, patch) => setPages(prev => prev.map((p,i) => i===idx ? {...p,...patch} : p));
  const updateElements = (idx, elements) => updatePage(idx, { elements });

  // ── Element helpers ──────────────────────────────────────────────────────
  const addElement = el => {
    const next = [...(page.elements||[]), el];
    updateElements(activePageIdx, next);
    setSelected(el.id);
  };
  const updateElement = (id, patch) => {
    const next = (page.elements||[]).map(el => el.id===id ? {...el,...patch} : el);
    updateElements(activePageIdx, next);
  };
  const removeElement = id => {
    const next = (page.elements||[]).filter(el => el.id!==id);
    updateElements(activePageIdx, next);
    setSelected(null);
  };
  const bringForward = id => {
    const els = [...(page.elements||[])];
    const i = els.findIndex(e=>e.id===id);
    if (i < els.length-1) { [els[i],els[i+1]]=[els[i+1],els[i]]; updateElements(activePageIdx,els); }
  };
  const sendBackward = id => {
    const els = [...(page.elements||[])];
    const i = els.findIndex(e=>e.id===id);
    if (i > 0) { [els[i],els[i-1]]=[els[i-1],els[i]]; updateElements(activePageIdx,els); }
  };

  // ── Image upload ─────────────────────────────────────────────────────────
  const handleImageUpload = async e => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const b64 = await fileToBase64(file);   // ← base64 so it survives localStorage
      addElement({ id:generateId(), type:"image", src:b64, x:40, y:40, w:200, h:150, rotation:0 });
    }
    e.target.value = "";
  };

  // ── Add sticker ──────────────────────────────────────────────────────────
  const addSticker = emoji => {
    addElement({ id:generateId(), type:"sticker", content:emoji, x:80+Math.random()*100, y:80+Math.random()*100, w:60, h:60, rotation:0 });
  };

  // ── Add text ─────────────────────────────────────────────────────────────
  const addText = () => {
    addElement({ id:generateId(), type:"text", content: lang==="ar"?"اكتب هنا":"Your text here",
      x:80, y:120, w:200, h:50, font:"Quicksand", fontSize:20, color:"#4A3068", rotation:0, bold:false, italic:false });
  };

  // ── Drag handling ─────────────────────────────────────────────────────────
  const onMouseDownEl = (e, elId) => {
    e.stopPropagation();
    setSelected(elId);
    const el = (page.elements||[]).find(x => x.id===elId);
    if (!el) return;
    setDragging({ elId, startX:e.clientX, startY:e.clientY, origX:el.x, origY:el.y });
  };
  const onMouseMove = e => {
    if (dragging) {
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;
      updateElement(dragging.elId, { x: dragging.origX+dx, y: dragging.origY+dy });
    }
    if (resizing) {
      const dx = e.clientX - resizing.startX;
      const dy = e.clientY - resizing.startY;
      updateElement(resizing.elId, {
        w: Math.max(30, resizing.origW+dx),
        h: Math.max(30, resizing.origH+dy),
      });
    }
  };
  const onMouseUp = () => { setDragging(null); setResizing(null); };
  const onResizeMouseDown = (e, elId) => {
    e.stopPropagation();
    const el = (page.elements||[]).find(x => x.id===elId);
    if (!el) return;
    setResizing({ elId, startX:e.clientX, startY:e.clientY, origW:el.w, origH:el.h });
  };

  // ── AI layout generator (algorithmic) ────────────────────────────────────
  const runAI = async () => {
    const allImages = pages.flatMap(pg => pg.elements.filter(el => el.type==="image"));
    if (allImages.length === 0) {
      alert(t("Please upload some photos first!","يرجى رفع بعض الصور أولاً!"));
      return;
    }
    setAiRunning(true);
    await new Promise(r => setTimeout(r, 1800)); // simulate processing

    const layouts = [
      (imgs, pw, ph) => [{ ...imgs[0], x:20, y:20, w:pw-40, h:ph-40 }],
      (imgs, pw, ph) => [
        { ...imgs[0], x:10, y:20, w:pw/2-15, h:ph-60 },
        { ...imgs[1], x:pw/2+5, y:20, w:pw/2-15, h:ph-60 },
      ],
      (imgs, pw, ph) => [
        { ...imgs[0], x:10, y:10, w:pw-20, h:ph/2-15 },
        { ...imgs[1], x:10, y:ph/2+5, w:pw/2-15, h:ph/2-15 },
        { ...imgs[2], x:pw/2+5, y:ph/2+5, w:pw/2-15, h:ph/2-15 },
      ],
    ];

    const occasionStickers = {
      Wedding:["💍","🕊️","💐","✨","🥂"], Birthday:["🎂","🎉","🎈","✨","🎁"],
      "Baby Shower":["🍼","👶","🌸","💕","🎀"], Graduation:["🎓","⭐","🏆","📚","✨"],
      Engagement:["💍","💐","❤️","✨","🥂"], Travel:["✈️","🗺️","📸","🌍","⭐"],
      Family:["❤️","👨‍👩‍👧‍👦","🏡","✨","💕"], Anniversary:["❤️","🥂","🌹","✨","💕"],
    };
    const stickers = occasionStickers[occasion] || ["✨","💜","⭐","🌸","💕"];

    const PW = 400, PH = 520;
    const chunks = [];
    for (let i=0; i<allImages.length; i+=3) chunks.push(allImages.slice(i,i+3));

    const newPages = chunks.map((chunk, ci) => {
      const layoutFn = layouts[Math.min(chunk.length-1, layouts.length-1)];
      const placed   = layoutFn(chunk, PW, PH);
      const stickerEls = stickers.slice(0,2).map((s,si) => ({
        id:generateId(), type:"sticker", content:s,
        x:10+si*(PW-70), y:si%2===0?10:PH-80, w:55, h:55, rotation:(Math.random()*30)-15,
      }));
      return {
        id: generateId(),
        background: ["#fff8fe","#f5f0ff","#fff5f0","#f0f8ff"][ci%4],
        elements: [...placed.map(el => ({...el, id:generateId(), rotation:0})), ...stickerEls],
      };
    });

    setPages(newPages);
    setCurrentPage(0);
    setSelected(null);
    setAiRunning(false);
    setAiDone(true);
    onUpdate({ pages:newPages, title, occasion });
  };

  // ── Template layouts ──────────────────────────────────────────────────────
  const TEMPLATES = [
    { id:"t1", name:t("Classic Grid","شبكة كلاسيكية"), bg:"#fff8fe", desc:t("Clean rows and columns","صفوف وأعمدة واضحة"), layout: (pw,ph) => [
      { type:"text", content:t("Our Story","قصتنا"), x:pw/2-60, y:16, w:120, h:36, font:"Playfair Display", fontSize:22, color:DARK_PURPLE, bold:false, italic:false },
      { type:"sticker", content:"✨", x:pw-60, y:10, w:44, h:44 },
      { type:"sticker", content:"💜", x:10,    y:10, w:44, h:44 },
    ]},
    { id:"t2", name:t("Romantic","رومانسي"), bg:"#fff0f5", desc:t("Soft & dreamy","ناعم وحالم"), layout: (pw,ph) => [
      { type:"text", content:t("Forever & Always","إلى الأبد"), x:pw/2-70, y:16, w:140, h:36, font:"Dancing Script", fontSize:26, color:"#8B3A62", bold:false, italic:true },
      { type:"sticker", content:"🌹", x:10,    y:10, w:48, h:48 },
      { type:"sticker", content:"💕", x:pw-58, y:10, w:48, h:48 },
      { type:"sticker", content:"✨", x:pw/2-20, y:ph-60, w:40, h:40 },
    ]},
    { id:"t3", name:t("Adventure","مغامرة"), bg:"#f0f8ff", desc:t("Bold & adventurous","جريء ومغامر"), layout: (pw,ph) => [
      { type:"text", content:t("Adventures Together","مغامرات معاً"), x:pw/2-80, y:12, w:160, h:36, font:"Amatic SC", fontSize:28, color:"#1a5276", bold:true, italic:false },
      { type:"sticker", content:"✈️", x:10,    y:10, w:48, h:48 },
      { type:"sticker", content:"🗺️", x:pw-58, y:10, w:48, h:48 },
      { type:"sticker", content:"⭐", x:20,    y:ph-60, w:40, h:40 },
    ]},
    { id:"t4", name:t("Minimal","بسيط"), bg:"#fafafa", desc:t("Clean & modern","نظيف وعصري"), layout: (pw,ph) => [
      { type:"text", content:t("Memories","ذكريات"), x:pw/2-50, y:20, w:100, h:36, font:"Comfortaa", fontSize:20, color:"#333", bold:false, italic:false },
    ]},
  ];

  const applyTemplate = tpl => {
    const PW=400, PH=520;
    const elements = tpl.layout(PW,PH).map(el => ({ ...el, id:generateId(), rotation:el.rotation||0, w:el.w||120, h:el.h||40 }));
    updatePage(activePageIdx, { background:tpl.bg, elements });
    setSelected(null);
  };

  const selEl = (page.elements||[]).find(e => e.id===selected);

  // ── Mode config ───────────────────────────────────────────────────────────
  const modeConfig = {
    manual:   { color:DEEP_PURPLE, icon:"✏️", label:t("Manual Editor","المحرر اليدوي") },
    ai:       { color:"#6c3483",   icon:"🤖", label:t("AI Generator","مولّد الذكاء الاصطناعي") },
    template: { color:"#1a5276",   icon:"📋", label:t("Template Editor","محرر القوالب") },
  };
  const mc = modeConfig[mode] || modeConfig.manual;

  // ── Mobile canvas: single page, full-screen, bottom toolbar ───────────────
  if (isMobile) {
    const mobilePage = pages[currentPage] || pages[0];
    const mobilePageIdx = currentPage;
    const CANVAS_W = Math.min(window.innerWidth - 32, 360);
    const CANVAS_H = Math.round(CANVAS_W * 1.3);

    const openPanel = (panel) => {
      setMobilePanel(panel);
      setMobilePanelOpen(true);
    };
    const closePanel = () => setMobilePanelOpen(false);

    return (
      <div dir={isRTL?"rtl":"ltr"} style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
        fontFamily:"'Quicksand','Noto Sans Arabic',sans-serif", color:DARK_PURPLE, background:"#f4f0fb",
        userSelect:"none", position:"relative" }}>
        <link href={FONT_LINK} rel="stylesheet" />

        {/* Mobile top bar */}
        <div style={{ background:"white", borderBottom:`1px solid ${PASTEL_PURPLE}15`, padding:"10px 16px",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          position:"sticky", top:0, zIndex:60 }}>
          <button onClick={() => { doSave(); onBack(); }} style={{ background:"none", border:"none", color:DEEP_PURPLE,
            cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"'Quicksand',sans-serif",
            display:"flex", alignItems:"center", gap:6, padding:"4px 0" }}>
            ← {t("Exit","خروج")}
          </button>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder={t("Title...","العنوان...")}
            style={{ border:"none", borderBottom:`1px solid ${PASTEL_PURPLE}30`, outline:"none",
              fontSize:13, fontWeight:600, color:DARK_PURPLE, background:"transparent",
              width:120, textAlign:"center", fontFamily:"'Quicksand',sans-serif", padding:"2px 4px" }} />
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {lastSaved && <div style={{ width:7, height:7, borderRadius:"50%", background:"#27ae60" }} />}
            <button onClick={doSave} style={{ background:`${PASTEL_PURPLE}20`, border:`1px solid ${PASTEL_PURPLE}40`,
              borderRadius:8, padding:"6px 12px", fontSize:11, fontWeight:700, color:DEEP_PURPLE,
              cursor:"pointer", fontFamily:"'Quicksand',sans-serif", display:"flex", alignItems:"center", gap:4 }}>
              <Icon name="save" size={14} color={DEEP_PURPLE} />
            </button>
            <button onClick={() => { doSave(); onDone && onDone(pages); }} style={{
              background:`linear-gradient(135deg,${GOLD_ACCENT},#c08020)`,
              border:"none", borderRadius:8, padding:"6px 12px", fontSize:11, fontWeight:700,
              color:"white", cursor:"pointer", fontFamily:"'Quicksand',sans-serif",
              display:"flex", alignItems:"center", gap:4 }}>
              <Icon name="order" size={14} color="white" /> {t("Order","اطلب")}
            </button>
          </div>
        </div>

        {/* Spread/single selector + page nav */}
        <div style={{ background:"white", borderBottom:`1px solid ${PASTEL_PURPLE}10`,
          padding:"8px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:11, color:DEEP_PURPLE, fontWeight:700, opacity:0.6 }}>
            {mc.icon} {mc.label}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button onClick={() => { setCurrentPage(p=>Math.max(0,p-1)); setSelected(null); }}
              disabled={currentPage===0}
              style={{ background:`${PASTEL_PURPLE}15`, border:"none", borderRadius:6, padding:"4px 10px",
                fontSize:13, color:DEEP_PURPLE, cursor:currentPage===0?"not-allowed":"pointer", opacity:currentPage===0?0.3:1 }}>‹</button>
            <span style={{ fontSize:12, fontWeight:600, color:DARK_PURPLE }}>{currentPage+1}/{pages.length}</span>
            <button onClick={() => { setCurrentPage(p=>Math.min(pages.length-1,p+1)); setSelected(null); }}
              disabled={currentPage>=pages.length-1}
              style={{ background:`${PASTEL_PURPLE}15`, border:"none", borderRadius:6, padding:"4px 10px",
                fontSize:13, color:DEEP_PURPLE, cursor:currentPage>=pages.length-1?"not-allowed":"pointer", opacity:currentPage>=pages.length-1?0.3:1 }}>›</button>
            <button onClick={addPage} style={{ background:`${PASTEL_PURPLE}15`, border:`1px dashed ${PASTEL_PURPLE}40`,
              borderRadius:6, padding:"4px 10px", fontSize:11, color:DEEP_PURPLE, cursor:"pointer" }}>+</button>
          </div>
        </div>

        {/* Canvas area */}
        <div style={{ flex:1, display:"flex", alignItems:"flex-start", justifyContent:"center",
          padding:"16px 16px 120px", overflowY:"auto", background:"#f4f0fb" }}>
          <div onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onClick={e => { if(e.target.dataset.canvas) setSelected(null); }}
            style={{ width:CANVAS_W, height:CANVAS_H, background:mobilePage.background||"#ffffff",
              borderRadius:6, position:"relative", overflow:"hidden",
              boxShadow:"0 6px 24px rgba(0,0,0,0.10)" }}
            data-canvas="true">

            {(mobilePage.elements||[]).map(el => (
              <div key={el.id}
                onMouseDown={e => onMouseDownEl(e, el.id)}
                onTouchStart={e => {
                  e.stopPropagation();
                  setSelected(el.id);
                  const touch = e.touches[0];
                  setDragging({ elId:el.id, startX:touch.clientX, startY:touch.clientY, origX:el.x, origY:el.y });
                }}
                onTouchMove={e => {
                  if (!dragging || dragging.elId !== el.id) return;
                  const touch = e.touches[0];
                  const dx = touch.clientX - dragging.startX;
                  const dy = touch.clientY - dragging.startY;
                  updateElement(el.id, { x:dragging.origX+dx, y:dragging.origY+dy });
                }}
                onTouchEnd={() => setDragging(null)}
                style={{ position:"absolute", left:el.x, top:el.y, width:el.w, height:el.h,
                  transform:`rotate(${el.rotation||0}deg)`, userSelect:"none",
                  outline: selected===el.id ? `2px solid ${DEEP_PURPLE}` : "none",
                  outlineOffset:2, touchAction:"none" }}>

                {el.type==="image" && (
                  <img src={el.src} alt="" draggable={false}
                    style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:2, display:"block", pointerEvents:"none" }} />
                )}
                {el.type==="sticker" && (
                  <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:Math.min(el.w,el.h)*0.7, lineHeight:1, pointerEvents:"none" }}>
                    {el.content}
                  </div>
                )}
                {el.type==="text" && (
                  selected===el.id ? (
                    <textarea autoFocus value={el.content}
                      onChange={e => updateElement(el.id,{content:e.target.value})}
                      onMouseDown={e => e.stopPropagation()}
                      style={{ width:"100%", height:"100%", border:"none", background:"transparent", outline:"none", resize:"none",
                        fontFamily:`'${el.font||"Quicksand"}',sans-serif`, fontSize:el.fontSize||18,
                        color:el.color||DARK_PURPLE, fontWeight:el.bold?"bold":"normal", fontStyle:el.italic?"italic":"normal",
                        cursor:"text", textAlign:"center", padding:4 }} />
                  ) : (
                    <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center",
                      fontFamily:`'${el.font||"Quicksand"}',sans-serif`, fontSize:el.fontSize||18,
                      color:el.color||DARK_PURPLE, fontWeight:el.bold?"bold":"normal", fontStyle:el.italic?"italic":"normal",
                      textAlign:"center", padding:4, wordBreak:"break-word", pointerEvents:"none", whiteSpace:"pre-wrap" }}>
                      {el.content}
                    </div>
                  )
                )}
                {selected===el.id && (
                  <div onMouseDown={e => onResizeMouseDown(e, el.id)}
                    style={{ position:"absolute", right:-6, bottom:-6, width:16, height:16, borderRadius:"50%",
                      background:DEEP_PURPLE, cursor:"se-resize", border:"2px solid white", zIndex:10 }} />
                )}
              </div>
            ))}

            {(mobilePage.elements||[]).length === 0 && (
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                <div style={{ fontSize:28, marginBottom:8, opacity:0.15 }}>📷</div>
                <div style={{ fontSize:12, color:DARK_PURPLE, opacity:0.2, textAlign:"center", padding:"0 24px" }}>
                  {t("Tap 📷 below to add a photo","اضغط 📷 أدناه لإضافة صورة")}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected element quick actions */}
        {selEl && (
          <div style={{ position:"fixed", bottom:80, left:16, right:16, zIndex:55,
            background:"white", borderRadius:16, padding:"12px 16px",
            boxShadow:"0 -4px 20px rgba(74,48,104,0.12)",
            display:"flex", gap:8, alignItems:"center", overflowX:"auto" }}>
            {selEl.type==="text" && (
              <>
                <input type="number" value={selEl.fontSize||18} min={8} max={80}
                  onChange={e => updateElement(selEl.id,{fontSize:parseInt(e.target.value)||18})}
                  style={{ width:48, padding:"4px 6px", borderRadius:8, border:`1px solid ${PASTEL_PURPLE}30`, fontSize:12, color:DARK_PURPLE }} />
                <input type="color" value={selEl.color||"#4A3068"}
                  onChange={e => updateElement(selEl.id,{color:e.target.value})}
                  style={{ width:28, height:28, border:"none", borderRadius:6, cursor:"pointer" }} />
                <button onClick={() => updateElement(selEl.id,{bold:!selEl.bold})}
                  style={{ padding:"4px 10px", borderRadius:8, border:`1px solid ${selEl.bold?DEEP_PURPLE:PASTEL_PURPLE}30`,
                    background:selEl.bold?`${PASTEL_PURPLE}20`:"transparent", fontSize:13, fontWeight:"bold", color:DEEP_PURPLE, cursor:"pointer" }}>B</button>
              </>
            )}
            <button onClick={() => bringForward(selEl.id)}
              style={{ padding:"4px 10px", borderRadius:8, border:`1px solid ${PASTEL_PURPLE}20`, fontSize:13, color:DARK_PURPLE, cursor:"pointer", background:"transparent" }}>↑</button>
            <button onClick={() => sendBackward(selEl.id)}
              style={{ padding:"4px 10px", borderRadius:8, border:`1px solid ${PASTEL_PURPLE}20`, fontSize:13, color:DARK_PURPLE, cursor:"pointer", background:"transparent" }}>↓</button>
            <button onClick={() => removeElement(selEl.id)}
              style={{ marginLeft:"auto", padding:"4px 12px", borderRadius:8, border:"none",
                background:"#fdf0ef", color:"#e74c3c", fontSize:12, fontWeight:700, cursor:"pointer",
                display:"flex", alignItems:"center", gap:4 }}>
              <Icon name="trash" size={14} color="#e74c3c" />
            </button>
          </div>
        )}

        {/* Mobile bottom toolbar */}
        <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:60,
          background:"white", borderTop:`1px solid ${PASTEL_PURPLE}15`,
          padding:"10px 12px", paddingBottom:"max(10px, env(safe-area-inset-bottom))",
          display:"flex", gap:6, justifyContent:"space-around", alignItems:"center" }}>

          {/* Add Photo */}
          <label style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            cursor:"pointer", flex:1, padding:"4px 0" }}>
            <Icon name="image" size={22} color={DEEP_PURPLE} />
            <span style={{ fontSize:9, color:DEEP_PURPLE, opacity:0.6, letterSpacing:0.5 }}>{t("Photo","صورة")}</span>
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display:"none" }} />
          </label>

          {/* Add Text */}
          <button onClick={addText} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            flex:1, border:"none", background:"transparent", cursor:"pointer", padding:"4px 0" }}>
            <Icon name="text" size={22} color={DEEP_PURPLE} />
            <span style={{ fontSize:9, color:DEEP_PURPLE, opacity:0.6, letterSpacing:0.5 }}>{t("Text","نص")}</span>
          </button>

          {/* Stickers */}
          <button onClick={() => openPanel("stickers")} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            flex:1, border:"none", background:"transparent", cursor:"pointer", padding:"4px 0" }}>
            <Icon name="sticker" size={22} color={DEEP_PURPLE} />
            <span style={{ fontSize:9, color:DEEP_PURPLE, opacity:0.6, letterSpacing:0.5 }}>{t("Stickers","ملصقات")}</span>
          </button>

          {/* Background */}
          <button onClick={() => openPanel("backgrounds")} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            flex:1, border:"none", background:"transparent", cursor:"pointer", padding:"4px 0" }}>
            <Icon name="palette" size={22} color={DEEP_PURPLE} />
            <span style={{ fontSize:9, color:DEEP_PURPLE, opacity:0.6, letterSpacing:0.5 }}>{t("BG","خلفية")}</span>
          </button>

          {/* Font */}
          <button onClick={() => openPanel("fonts")} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            flex:1, border:"none", background:"transparent", cursor:"pointer", padding:"4px 0" }}>
            <Icon name="font" size={22} color={DEEP_PURPLE} />
            <span style={{ fontSize:9, color:DEEP_PURPLE, opacity:0.6, letterSpacing:0.5 }}>{t("Font","خط")}</span>
          </button>

          {/* PDF */}
          <button onClick={handleExportPDF} disabled={exporting} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            flex:1, border:"none", background:"transparent", cursor:exporting?"not-allowed":"pointer", padding:"4px 0", opacity:exporting?0.5:1 }}>
            <Icon name="pdf" size={22} color={DEEP_PURPLE} />
            <span style={{ fontSize:9, color:DEEP_PURPLE, opacity:0.6, letterSpacing:0.5 }}>{exporting?t("...","..."):"PDF"}</span>
          </button>
        </div>

        {/* Slide-up panel overlay */}
        {mobilePanelOpen && (
          <div style={{ position:"fixed", inset:0, zIndex:70, animation:"overlayIn 0.2s ease" }}
            onClick={closePanel}>
            <div style={{ position:"absolute", inset:0, background:"rgba(74,48,104,0.3)" }} />
            <div onClick={e=>e.stopPropagation()}
              style={{ position:"absolute", bottom:0, left:0, right:0,
                background:"white", borderRadius:"20px 20px 0 0",
                padding:"0 0 32px", maxHeight:"60vh", overflow:"hidden",
                animation:"slideUp 0.3s ease", display:"flex", flexDirection:"column" }}>

              {/* Panel handle + close */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 20px 8px" }}>
                <div style={{ width:36, height:4, borderRadius:2, background:`${PASTEL_PURPLE}60`, margin:"0 auto" }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0 20px 12px",
                borderBottom:`1px solid ${PASTEL_PURPLE}15` }}>
                <div style={{ fontSize:14, fontWeight:700, color:DARK_PURPLE }}>
                  {mobilePanel==="stickers"?t("Stickers","الملصقات"):
                   mobilePanel==="fonts"?t("Fonts","الخطوط"):
                   mobilePanel==="backgrounds"?t("Background","الخلفية"):""}
                </div>
                <button onClick={closePanel} style={{ background:`${PASTEL_PURPLE}15`, border:"none", borderRadius:10,
                  padding:"4px 12px", fontSize:12, color:DEEP_PURPLE, cursor:"pointer" }}>✕</button>
              </div>

              <div style={{ overflowY:"auto", flex:1, padding:"16px 20px" }}>
                {/* Stickers panel */}
                {mobilePanel==="stickers" && (
                  <>
                    <div style={{ display:"flex", gap:8, overflowX:"auto", marginBottom:16, paddingBottom:4 }}>
                      {Object.entries(STICKER_PACKS).map(([key,pack]) => (
                        <button key={key} onClick={() => setStickerPack(key)}
                          style={{ whiteSpace:"nowrap", padding:"6px 12px", borderRadius:20, border:"none",
                            background: stickerPack===key ? DEEP_PURPLE : `${PASTEL_PURPLE}15`,
                            color: stickerPack===key ? "white" : DARK_PURPLE, fontSize:11, fontWeight:600,
                            cursor:"pointer", fontFamily:"'Quicksand',sans-serif" }}>
                          {pack.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10 }}>
                      {STICKER_PACKS[stickerPack]?.items.map((emoji,i) => (
                        <button key={i} onClick={() => { addSticker(emoji); closePanel(); }}
                          style={{ fontSize:28, background:`${SOFT_PINK}20`, border:`1px solid ${PASTEL_PURPLE}10`,
                            borderRadius:10, padding:"10px 4px", cursor:"pointer" }}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {/* Fonts panel */}
                {mobilePanel==="fonts" && (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {FONTS.map(f => (
                      <div key={f.name}
                        onClick={() => { if(selEl && selEl.type==="text") { updateElement(selEl.id,{font:f.name}); closePanel(); } else { addText(); } }}
                        style={{ padding:"12px 14px", borderRadius:12, cursor:"pointer",
                          background: selEl?.font===f.name ? `${PASTEL_PURPLE}20` : `${SOFT_PINK}15`,
                          border: selEl?.font===f.name ? `1px solid ${PASTEL_PURPLE}50` : "1px solid transparent" }}>
                        <div style={{ fontFamily:`'${f.name}',sans-serif`, fontSize:20, color:DARK_PURPLE }}>{f.preview}</div>
                        <div style={{ fontSize:10, color:DARK_PURPLE, opacity:0.4, marginTop:2 }}>{f.label}</div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Backgrounds panel */}
                {mobilePanel==="backgrounds" && (
                  <>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
                      {["#ffffff","#fff8fe","#f5f0ff","#fff5f0","#f0f8ff","#fafaf0","#fff0f5","#f5fff5","#f0f5ff","#fffbf0","#f8f0ff","#fff8f0"].map(clr => (
                        <div key={clr} onClick={() => { updatePage(mobilePageIdx,{background:clr}); closePanel(); }}
                          style={{ aspectRatio:"1", borderRadius:10, background:clr, cursor:"pointer",
                            border: mobilePage.background===clr ? `3px solid ${DEEP_PURPLE}` : `1px solid ${PASTEL_PURPLE}20` }} />
                      ))}
                    </div>
                    <div style={{ fontSize:12, color:DARK_PURPLE, opacity:0.5, marginBottom:8 }}>{t("Custom","مخصص")}</div>
                    <input type="color" value={mobilePage.background||"#ffffff"}
                      onChange={e => updatePage(mobilePageIdx,{background:e.target.value})}
                      style={{ width:"100%", height:44, border:"none", borderRadius:12, cursor:"pointer" }} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hidden pages for PDF export */}
        <div style={{ position:"absolute", left:-9999, top:0, pointerEvents:"none", zIndex:-1 }}>
          {pages.map((pg, i) => (
            <div key={pg.id} ref={el => { pageExportRefs.current[i] = el; }}
              style={{ width:400, height:520, background:pg.background||"#ffffff", position:"relative", overflow:"hidden", marginBottom:8 }}>
              {(pg.elements||[]).map(el => (
                <div key={el.id} style={{ position:"absolute", left:el.x, top:el.y, width:el.w, height:el.h, transform:`rotate(${el.rotation||0}deg)` }}>
                  {el.type==="image" && <img src={el.src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:2, display:"block" }} />}
                  {el.type==="sticker" && <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:Math.min(el.w,el.h)*0.7, lineHeight:1 }}>{el.content}</div>}
                  {el.type==="text" && <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:`'${el.font||"Quicksand"}',sans-serif`, fontSize:el.fontSize||18, color:el.color||DARK_PURPLE, fontWeight:el.bold?"bold":"normal", fontStyle:el.italic?"italic":"normal", textAlign:"center", padding:4, wordBreak:"break-word", whiteSpace:"pre-wrap" }}>{el.content}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>

        {exported && (
          <div style={{ position:"fixed", top:70, left:16, right:16, zIndex:80,
            background:"#27ae60", color:"white", borderRadius:14, padding:"12px 16px",
            display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            <span style={{ fontSize:13, fontWeight:600 }}>✅ {t("PDF downloaded!","تم تنزيل PDF!")}</span>
            <a href={whatsappPDFLink} target="_blank" rel="noopener noreferrer"
              style={{ background:"white", color:"#27ae60", padding:"6px 12px", borderRadius:10,
                fontSize:11, fontWeight:700, textDecoration:"none" }}>
              💬 {t("Send","أرسل")}
            </a>
          </div>
        )}

        <style>{`
          @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          @keyframes overlayIn{from{opacity:0}to{opacity:1}}
        `}</style>
      </div>
    );
  }

  return (
    <div dir={isRTL?"rtl":"ltr"} style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
      fontFamily:"'Quicksand','Noto Sans Arabic',sans-serif", color:DARK_PURPLE, background:"#f4f0fb", userSelect:"none" }}>
      <link href={FONT_LINK} rel="stylesheet" />

      {/* ── Top bar ── */}
      <div style={{ background:"white", borderBottom:`1px solid ${PASTEL_PURPLE}20`, padding:"8px 16px",
        display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => { doSave(); onBack(); }} style={{ background:"none", border:"none", color:DEEP_PURPLE, cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Quicksand',sans-serif", display:"flex", alignItems:"center", gap:6 }}>
            ← {t("Save & Exit","حفظ وخروج")}
          </button>
          <div style={{ background:`${mc.color}15`, borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:700, color:mc.color, display:"flex", alignItems:"center", gap:4 }}>
            {mc.icon} {mc.label}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder={t("Album title...","عنوان الألبوم...")}
            style={{ border:"none", borderBottom:`1px solid ${PASTEL_PURPLE}40`, outline:"none", fontSize:13, fontWeight:600,
              color:DARK_PURPLE, background:"transparent", padding:"2px 8px", width:160, fontFamily:"'Quicksand',sans-serif" }} />
          {lastSaved && (
            <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.4, display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#27ae60", display:"inline-block" }} />
              {t("Saved","محفوظ")} {fmtTime(lastSaved)}
            </div>
          )}
          <button onClick={() => { doSave(); }} style={{ background:`${PASTEL_PURPLE}20`, border:`1px solid ${PASTEL_PURPLE}40`,
            borderRadius:10, padding:"6px 14px", fontSize:12, fontWeight:700, color:DEEP_PURPLE, cursor:"pointer", fontFamily:"'Quicksand',sans-serif",
            display:"flex", alignItems:"center", gap:6 }}>
            <Icon name="save" size={14} color={DEEP_PURPLE} /> {t("Save","احفظ")}
          </button>
          <button onClick={handleExportPDF} disabled={exporting} style={{
            background: exporting ? "#ccc" : `linear-gradient(135deg,${DEEP_PURPLE},${DARK_PURPLE})`,
            border:"none", borderRadius:10, padding:"6px 14px", fontSize:12, fontWeight:700,
            color:"white", cursor:exporting?"not-allowed":"pointer", fontFamily:"'Quicksand',sans-serif",
            display:"flex", alignItems:"center", gap:6 }}>
            <Icon name="pdf" size={14} color="white" /> {exporting ? t("Exporting...","جاري التصدير...") : t("Export PDF","تصدير PDF")}
          </button>
          <button onClick={() => { doSave(); onDone && onDone(pages); }} style={{
            background:`linear-gradient(135deg,${GOLD_ACCENT},#c08020)`,
            border:"none", borderRadius:10, padding:"6px 18px", fontSize:12, fontWeight:700,
            color:"white", cursor:"pointer", fontFamily:"'Quicksand',sans-serif",
            display:"flex", alignItems:"center", gap:6 }}>
            <Icon name="order" size={14} color="white" /> {t("Order Now","اطلب الآن")}
          </button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* ── Left sidebar ── */}
        <div style={{ width:220, background:"white", borderRight:isRTL?"none":`1px solid ${PASTEL_PURPLE}15`,
          borderLeft:isRTL?`1px solid ${PASTEL_PURPLE}15`:"none",
          display:"flex", flexDirection:"column", overflowY:"auto", flexShrink:0 }}>

          {/* Tab bar */}
          <div style={{ display:"flex", borderBottom:`1px solid ${PASTEL_PURPLE}10` }}>
            {[
              { key:"pages",       icon:"📄" },
              { key:"stickers",    icon:"🎨" },
              { key:"fonts",       icon:"Aa" },
              { key:"backgrounds", icon:"🖼️" },
              ...(mode==="template"?[{key:"templates",icon:"📋"}]:[]),
            ].map(tabItem => (
              <button key={tabItem.key} onClick={() => setLeftTab(tabItem.key)} style={{
                flex:1, padding:"10px 4px", border:"none", background: leftTab===tabItem.key ? `${PASTEL_PURPLE}20` : "transparent",
                borderBottom: leftTab===tabItem.key ? `2px solid ${DEEP_PURPLE}` : "2px solid transparent",
                cursor:"pointer", fontSize:13, color: leftTab===tabItem.key ? DEEP_PURPLE : DARK_PURPLE, fontWeight: leftTab===tabItem.key ? 700 : 400,
                fontFamily:"'Quicksand',sans-serif" }}>
                {tabItem.icon}
              </button>
            ))}
          </div>

          <div style={{ padding:12, flex:1, overflowY:"auto" }}>

            {/* Pages tab */}
            {leftTab==="pages" && (
              <>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:DARK_PURPLE, opacity:0.5, display:"block", marginBottom:4 }}>{t("Occasion","المناسبة")}</label>
                  <select value={occasion} onChange={e=>setOccasion(e.target.value)}
                    style={{ ...inputStyle, marginBottom:8, fontSize:12, padding:"6px 10px" }}>
                    <option value="General">{t("General","عام")}</option>
                    {OCCASIONS.map(o => <option key={o.name} value={o.name}>{t(o.name,o.nameAr)} {o.emoji}</option>)}
                  </select>
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:DARK_PURPLE, opacity:0.5, marginBottom:8 }}>{t("Spreads","الوجوه")} ({totalSpreads})</div>
                {Array.from({length: totalSpreads}).map((_,si) => {
                  const lIdx = si*2, rIdx = si*2+1;
                  const isCover = si===0;
                  const isActive = si===spreadIndex;
                  return (
                    <div key={si} onClick={() => { setCurrentPage(lIdx); setActiveSide("left"); setSelected(null); }} style={{
                      display:"flex", justifyContent:"space-between", alignItems:"center",
                      padding:"8px 10px", borderRadius:8, cursor:"pointer", marginBottom:4,
                      background: isActive ? `${PASTEL_PURPLE}25` : "transparent",
                      border: isActive ? `1px solid ${PASTEL_PURPLE}40` : "1px solid transparent" }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:isActive?700:400, color:DARK_PURPLE }}>
                          {isCover ? t("Cover","الغلاف") : `${t("Spread","وجه")} ${si}`}
                        </div>
                        <div style={{ fontSize:10, color:DARK_PURPLE, opacity:0.4 }}>
                          {isCover ? t("Back + Front","خلفي + أمامي") : `${t("pp","ص")} ${lIdx}–${rIdx}`}
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                        <span style={{ fontSize:10, color:DARK_PURPLE, opacity:0.4 }}>{((pages[lIdx]?.elements||[]).length + (pages[rIdx]?.elements||[]).length)}el</span>
                        {si > 0 && (
                          <span onClick={ev=>{ev.stopPropagation();removePage(lIdx);}} style={{ fontSize:14, cursor:"pointer", color:"#ccc" }}
                            onMouseEnter={e=>e.target.style.color="#e74c3c"} onMouseLeave={e=>e.target.style.color="#ccc"}>×</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button onClick={addPage} style={{ width:"100%", padding:"8px", borderRadius:10, fontSize:12, fontWeight:600,
                  background:`${PASTEL_PURPLE}15`, border:`1px dashed ${PASTEL_PURPLE}40`, color:DEEP_PURPLE, cursor:"pointer", fontFamily:"'Quicksand',sans-serif", marginTop:4 }}>
                  + {t("Add Spread","أضف وجهاً")}
                </button>
              </>
            )}

            {/* Stickers tab */}
            {leftTab==="stickers" && (
              <>
                <div style={{ fontSize:11, fontWeight:700, color:DARK_PURPLE, opacity:0.5, marginBottom:8 }}>{t("Sticker Packs","مجموعات الملصقات")}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:12 }}>
                  {Object.entries(STICKER_PACKS).map(([key,pack]) => (
                    <button key={key} onClick={() => setStickerPack(key)} style={{
                      padding:"6px 10px", borderRadius:8, border:"none", textAlign:"left", cursor:"pointer", fontSize:12,
                      background: stickerPack===key ? `${PASTEL_PURPLE}25` : "transparent",
                      color: stickerPack===key ? DEEP_PURPLE : DARK_PURPLE,
                      fontWeight: stickerPack===key ? 700 : 400, fontFamily:"'Quicksand',sans-serif" }}>
                      {pack.label}
                    </button>
                  ))}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
                  {STICKER_PACKS[stickerPack]?.items.map((emoji,i) => (
                    <button key={i} onClick={() => addSticker(emoji)} style={{
                      fontSize:22, background:`${SOFT_PINK}20`, border:`1px solid ${PASTEL_PURPLE}15`,
                      borderRadius:8, padding:"8px 4px", cursor:"pointer", transition:"transform 0.15s" }}
                      onMouseEnter={e=>e.currentTarget.style.transform="scale(1.2)"}
                      onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Fonts tab */}
            {leftTab==="fonts" && (
              <>
                <div style={{ fontSize:11, fontWeight:700, color:DARK_PURPLE, opacity:0.5, marginBottom:8 }}>{t("Add Text","أضف نصاً")}</div>
                <button onClick={addText} style={{ ...primaryBtnStyle, marginBottom:16, padding:"10px", fontSize:13 }}>
                  + {t("Add Text Box","أضف مربع نص")}
                </button>
                <div style={{ fontSize:11, fontWeight:700, color:DARK_PURPLE, opacity:0.5, marginBottom:8 }}>{t("Available Fonts","الخطوط المتاحة")}</div>
                {FONTS.map(f => (
                  <div key={f.name} onClick={() => selEl && selEl.type==="text" && updateElement(selEl.id,{font:f.name})}
                    style={{ padding:"10px 8px", borderRadius:8, cursor:"pointer", marginBottom:4,
                      background: selEl?.font===f.name ? `${PASTEL_PURPLE}25` : "transparent",
                      border: selEl?.font===f.name ? `1px solid ${PASTEL_PURPLE}40` : "1px solid transparent" }}>
                    <div style={{ fontFamily:`'${f.name}',sans-serif`, fontSize:16, color:DARK_PURPLE }}>{f.preview}</div>
                    <div style={{ fontSize:10, color:DARK_PURPLE, opacity:0.4, marginTop:2 }}>{f.label}</div>
                  </div>
                ))}
              </>
            )}

            {/* Backgrounds tab */}
            {leftTab==="backgrounds" && (
              <>
                <div style={{ fontSize:11, fontWeight:700, color:DARK_PURPLE, opacity:0.5, marginBottom:8 }}>{t("Page Background","خلفية الصفحة")}</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}>
                  {["#ffffff","#fff8fe","#f5f0ff","#fff5f0","#f0f8ff","#fafaf0","#fff0f5","#f5fff5","#f0f5ff","#fffbf0","#f8f0ff","#fff8f0"].map(clr => (
                    <div key={clr} onClick={() => updatePage(activePageIdx,{background:clr})}
                      style={{ width:"100%", aspectRatio:"1", borderRadius:8, background:clr, cursor:"pointer",
                        border: page.background===clr ? `2px solid ${DEEP_PURPLE}` : `1px solid ${PASTEL_PURPLE}20` }} />
                  ))}
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:DARK_PURPLE, opacity:0.5, marginBottom:6 }}>{t("Custom Color","لون مخصص")}</div>
                <input type="color" value={page.background||"#ffffff"} onChange={e=>updatePage(activePageIdx,{background:e.target.value})}
                  style={{ width:"100%", height:36, border:"none", borderRadius:8, cursor:"pointer" }} />
              </>
            )}

            {/* Templates tab */}
            {leftTab==="templates" && (
              <>
                <div style={{ fontSize:11, fontWeight:700, color:DARK_PURPLE, opacity:0.5, marginBottom:8 }}>{t("Apply Template","تطبيق قالب")}</div>
                {TEMPLATES.map(tpl => (
                  <div key={tpl.id} onClick={() => applyTemplate(tpl)} style={{
                    padding:"12px", borderRadius:10, cursor:"pointer", marginBottom:8,
                    background:tpl.bg, border:`1px solid ${PASTEL_PURPLE}20`, transition:"all 0.2s ease" }}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 4px 12px ${PASTEL_PURPLE}20`}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                    <div style={{ fontWeight:700, fontSize:13, color:DARK_PURPLE, marginBottom:2 }}>{tpl.name}</div>
                    <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.5 }}>{tpl.desc}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Centre: canvas + toolbar ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"auto", alignItems:"center" }}>

          {/* Toolbar */}
          <div style={{ background:"white", borderBottom:`1px solid ${PASTEL_PURPLE}10`, padding:"8px 16px",
            display:"flex", gap:8, alignItems:"center", width:"100%", flexWrap:"wrap" }}>
            <ToolBtn icon={<Icon name="image" size={16} color={DEEP_PURPLE} />} label={t("Add Photo","أضف صورة")} onClick={() => fileRef.current?.click()} />
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display:"none" }} />
            <ToolBtn icon={<Icon name="text" size={16} color={DEEP_PURPLE} />} label={t("Add Text","أضف نص")} onClick={addText} active={tool==="text"} />
            <ToolBtn icon={<Icon name="sticker" size={16} color={DEEP_PURPLE} />} label={t("Stickers","ملصقات")} onClick={() => setLeftTab("stickers")} />

            <div style={{ width:1, height:28, background:`${PASTEL_PURPLE}30`, margin:"0 4px" }} />

            {selEl && (
              <>
                {selEl.type==="text" && (
                  <>
                    <input type="number" value={selEl.fontSize||18} min={8} max={120}
                      onChange={e => updateElement(selEl.id,{fontSize:parseInt(e.target.value)||18})}
                      style={{ width:54, padding:"4px 8px", borderRadius:8, border:`1px solid ${PASTEL_PURPLE}30`, fontSize:12, color:DARK_PURPLE }} />
                    <input type="color" value={selEl.color||"#4A3068"}
                      onChange={e => updateElement(selEl.id,{color:e.target.value})}
                      style={{ width:30, height:30, border:"none", borderRadius:6, cursor:"pointer" }} title={t("Text color","لون النص")} />
                    <ToolBtn icon={<span style={{fontWeight:700,fontSize:13}}>B</span>} label="" onClick={() => updateElement(selEl.id,{bold:!selEl.bold})} active={selEl.bold} />
                    <ToolBtn icon={<span style={{fontStyle:"italic",fontSize:13}}>I</span>} label="" onClick={() => updateElement(selEl.id,{italic:!selEl.italic})} active={selEl.italic} />
                    <button onClick={() => setLeftTab("fonts")} style={{ fontSize:11, padding:"4px 10px", borderRadius:8,
                      background:`${PASTEL_PURPLE}15`, border:`1px solid ${PASTEL_PURPLE}30`, color:DEEP_PURPLE,
                      cursor:"pointer", fontFamily:"'Quicksand',sans-serif", fontWeight:600 }}>
                      {t("Font","الخط")}
                    </button>
                  </>
                )}
                <ToolBtn icon={<Icon name="arrowup" size={16} color={DARK_PURPLE} />} label={t("Forward","للأمام")} onClick={() => bringForward(selEl.id)} />
                <ToolBtn icon={<Icon name="arrowdown" size={16} color={DARK_PURPLE} />} label={t("Back","للخلف")} onClick={() => sendBackward(selEl.id)} />
                <ToolBtn icon={<Icon name="trash" size={16} color="#e74c3c" />} label={t("Delete","حذف")} onClick={() => removeElement(selEl.id)} danger />
              </>
            )}

            {mode==="ai" && (
              <button onClick={runAI} disabled={aiRunning} style={{
                marginLeft:"auto", padding:"6px 16px", borderRadius:20, fontSize:12, fontWeight:700,
                background: aiRunning ? "#ccc" : `linear-gradient(135deg,${DEEP_PURPLE},#6c3483)`,
                color:"white", border:"none", cursor: aiRunning?"not-allowed":"pointer", fontFamily:"'Quicksand',sans-serif",
                display:"flex", alignItems:"center", gap:6 }}>
                {aiRunning ? t("Generating...","جاري التصميم...") : t("Auto-Arrange","رتّب تلقائياً")}
              </button>
            )}
          </div>

          {aiDone && (
            <div style={{ width:"100%", background:`linear-gradient(90deg,${DEEP_PURPLE},#6c3483)`, color:"white",
              padding:"10px 20px", fontSize:13, fontWeight:600, textAlign:"center" }}>
              ✨ {t("AI has arranged your photos! Edit as needed.","رتّب الذكاء الاصطناعي صورك! عدّل كما تشاء.")}
              <button onClick={() => setAiDone(false)} style={{ marginLeft:12, background:"rgba(255,255,255,0.2)", border:"none", borderRadius:6, padding:"2px 10px", color:"white", cursor:"pointer", fontSize:11 }}>✕</button>
            </div>
          )}

          {exported && (
            <div style={{ width:"100%", background:"linear-gradient(90deg,#27ae60,#1e8449)", color:"white", padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"center", gap:16, flexWrap:"wrap" }}>
              <span style={{ fontSize:13, fontWeight:600 }}>
                ✅ {t("PDF downloaded! Now send it to Layal for printing.","تم تنزيل PDF! أرسله الآن إلى ليال للطباعة.")}
              </span>
              <a href={whatsappPDFLink} target="_blank" rel="noopener noreferrer" style={{
                background:"white", color:"#27ae60", padding:"6px 14px", borderRadius:20, fontSize:12,
                fontWeight:700, textDecoration:"none", display:"flex", alignItems:"center", gap:4 }}>
                💬 {t("Send to Layal via WhatsApp","أرسل إلى ليال عبر واتساب")}
              </a>
              <button onClick={() => setExported(false)} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:6, padding:"2px 10px", color:"white", cursor:"pointer", fontSize:11 }}>✕</button>
            </div>
          )}

          {/* Canvas — Two-page spread view */}
          <div style={{ padding:"32px 24px", display:"flex", justifyContent:"center", alignItems:"flex-start" }}>
            <div style={{ display:"flex", alignItems:"stretch", gap:0,
              boxShadow:"0 12px 48px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.10)",
              borderRadius:6 }}>

              {/* ── Left page (Back cover on spread 0, left interior on others) ── */}
              <div
                ref={canvasRef}
                onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
                onClick={e => {
                  setActiveSide("left");
                  if (e.target.dataset.canvas) setSelected(null);
                }}
                style={{ width:400, height:520,
                  background: leftPage.background||"#ffffff",
                  position:"relative", overflow:"hidden",
                  borderRadius:"6px 0 0 6px",
                  outline: activeSide==="left" ? `3px solid ${DEEP_PURPLE}` : "none",
                  cursor:"default",
                  transition:"outline 0.15s ease" }}
                data-canvas="true">
                {(leftPage.elements||[]).map(el => (
                  <div key={el.id}
                    onMouseDown={e => { setActiveSide("left"); onMouseDownEl(e, el.id); }}
                    style={{ position:"absolute", left:el.x, top:el.y, width:el.w, height:el.h,
                      transform:`rotate(${el.rotation||0}deg)`, cursor:"move", userSelect:"none",
                      outline: activeSide==="left" && selected===el.id ? `2px solid ${DEEP_PURPLE}` : "none",
                      outlineOffset:2 }}>
                    {el.type==="image" && <img src={el.src} alt="" draggable={false} style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:2, display:"block", pointerEvents:"none" }} />}
                    {el.type==="sticker" && <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:Math.min(el.w,el.h)*0.7, lineHeight:1, pointerEvents:"none" }}>{el.content}</div>}
                    {el.type==="text" && (
                      activeSide==="left" && selected===el.id ? (
                        <textarea autoFocus value={el.content} onChange={e => updateElement(el.id,{content:e.target.value})}
                          onMouseDown={e => e.stopPropagation()}
                          style={{ width:"100%", height:"100%", border:"none", background:"transparent", outline:"none", resize:"none",
                            fontFamily:`'${el.font||"Quicksand"}',sans-serif`, fontSize:el.fontSize||18,
                            color:el.color||DARK_PURPLE, fontWeight:el.bold?"bold":"normal", fontStyle:el.italic?"italic":"normal",
                            cursor:"text", textAlign:"center", padding:4 }} />
                      ) : (
                        <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center",
                          fontFamily:`'${el.font||"Quicksand"}',sans-serif`, fontSize:el.fontSize||18,
                          color:el.color||DARK_PURPLE, fontWeight:el.bold?"bold":"normal", fontStyle:el.italic?"italic":"normal",
                          textAlign:"center", padding:4, wordBreak:"break-word", pointerEvents:"none", whiteSpace:"pre-wrap" }}>
                          {el.content}
                        </div>
                      )
                    )}
                    {activeSide==="left" && selected===el.id && (
                      <div onMouseDown={e => onResizeMouseDown(e, el.id)}
                        style={{ position:"absolute", right:-5, bottom:-5, width:14, height:14, borderRadius:"50%", background:DEEP_PURPLE, cursor:"se-resize", border:"2px solid white", zIndex:10 }} />
                    )}
                  </div>
                ))}
                {(leftPage.elements||[]).length === 0 && (
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                    <div style={{ fontSize:24, marginBottom:6, opacity:0.15 }}>{spreadIndex===0?"📖":"📄"}</div>
                    <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.2, textAlign:"center", padding:"0 24px" }}>
                      {spreadIndex===0 ? t("Back Cover","الغلاف الخلفي") : t("Left Page","الصفحة اليسرى")}
                    </div>
                  </div>
                )}
                {/* Page label */}
                <div style={{ position:"absolute", bottom:6, left:0, right:0, textAlign:"center", fontSize:10, color:DARK_PURPLE, opacity:0.3, pointerEvents:"none" }}>
                  {spreadIndex===0 ? t("Back Cover","الغلاف الخلفي") : `${t("Page","ص")} ${leftPageIdx}`}
                </div>
              </div>

              {/* ── Spine ── */}
              <div style={{ width:18, background:"linear-gradient(to right, #d0d0d0, #f5f5f5, #e8e8e8, #f0f0f0, #c8c8c8)", flexShrink:0, position:"relative" }}>
                <div style={{ position:"absolute", top:0, bottom:0, left:0, width:3, background:"linear-gradient(to right, rgba(0,0,0,0.18), transparent)" }} />
                <div style={{ position:"absolute", top:0, bottom:0, right:0, width:3, background:"linear-gradient(to left, rgba(0,0,0,0.18), transparent)" }} />
              </div>

              {/* ── Right page (Front cover on spread 0, right interior on others) ── */}
              <div
                onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
                onClick={e => {
                  setActiveSide("right");
                  if (e.target.dataset.canvas) setSelected(null);
                }}
                style={{ width:400, height:520,
                  background: rightPage.background||"#ffffff",
                  position:"relative", overflow:"hidden",
                  borderRadius:"0 6px 6px 0",
                  outline: activeSide==="right" ? `3px solid ${DEEP_PURPLE}` : "none",
                  cursor:"default",
                  transition:"outline 0.15s ease" }}
                data-canvas="true">
                {(rightPage.elements||[]).map(el => (
                  <div key={el.id}
                    onMouseDown={e => { setActiveSide("right"); onMouseDownEl(e, el.id); }}
                    style={{ position:"absolute", left:el.x, top:el.y, width:el.w, height:el.h,
                      transform:`rotate(${el.rotation||0}deg)`, cursor:"move", userSelect:"none",
                      outline: activeSide==="right" && selected===el.id ? `2px solid ${DEEP_PURPLE}` : "none",
                      outlineOffset:2 }}>
                    {el.type==="image" && <img src={el.src} alt="" draggable={false} style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:2, display:"block", pointerEvents:"none" }} />}
                    {el.type==="sticker" && <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:Math.min(el.w,el.h)*0.7, lineHeight:1, pointerEvents:"none" }}>{el.content}</div>}
                    {el.type==="text" && (
                      activeSide==="right" && selected===el.id ? (
                        <textarea autoFocus value={el.content} onChange={e => updateElement(el.id,{content:e.target.value})}
                          onMouseDown={e => e.stopPropagation()}
                          style={{ width:"100%", height:"100%", border:"none", background:"transparent", outline:"none", resize:"none",
                            fontFamily:`'${el.font||"Quicksand"}',sans-serif`, fontSize:el.fontSize||18,
                            color:el.color||DARK_PURPLE, fontWeight:el.bold?"bold":"normal", fontStyle:el.italic?"italic":"normal",
                            cursor:"text", textAlign:"center", padding:4 }} />
                      ) : (
                        <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center",
                          fontFamily:`'${el.font||"Quicksand"}',sans-serif`, fontSize:el.fontSize||18,
                          color:el.color||DARK_PURPLE, fontWeight:el.bold?"bold":"normal", fontStyle:el.italic?"italic":"normal",
                          textAlign:"center", padding:4, wordBreak:"break-word", pointerEvents:"none", whiteSpace:"pre-wrap" }}>
                          {el.content}
                        </div>
                      )
                    )}
                    {activeSide==="right" && selected===el.id && (
                      <div onMouseDown={e => onResizeMouseDown(e, el.id)}
                        style={{ position:"absolute", right:-5, bottom:-5, width:14, height:14, borderRadius:"50%", background:DEEP_PURPLE, cursor:"se-resize", border:"2px solid white", zIndex:10 }} />
                    )}
                  </div>
                ))}
                {(rightPage.elements||[]).length === 0 && (
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                    <div style={{ fontSize:24, marginBottom:6, opacity:0.15 }}>{spreadIndex===0?"📖":"📄"}</div>
                    <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.2, textAlign:"center", padding:"0 24px" }}>
                      {spreadIndex===0 ? t("Front Cover","الغلاف الأمامي") : t("Right Page","الصفحة اليمنى")}
                    </div>
                  </div>
                )}
                {/* Page label */}
                <div style={{ position:"absolute", bottom:6, left:0, right:0, textAlign:"center", fontSize:10, color:DARK_PURPLE, opacity:0.3, pointerEvents:"none" }}>
                  {spreadIndex===0 ? t("Front Cover","الغلاف الأمامي") : `${t("Page","ص")} ${rightPageIdx}`}
                </div>
              </div>
            </div>
          </div>

          {/* Active page indicator */}
          <div style={{ textAlign:"center", fontSize:12, color:DARK_PURPLE, opacity:0.5, marginBottom:8, marginTop:-16 }}>
            {t("Editing:","تعديل:")} <strong style={{ color:DEEP_PURPLE }}>
              {spreadIndex===0
                ? (activeSide==="left" ? t("Back Cover","الغلاف الخلفي") : t("Front Cover","الغلاف الأمامي"))
                : (activeSide==="left" ? `${t("Page","صفحة")} ${leftPageIdx}` : `${t("Page","صفحة")} ${rightPageIdx}`)}
            </strong> — {t("click the other side to switch","اضغط الجهة الأخرى للتبديل")}
          </div>

          {/* Spread navigation */}
          <div style={{ display:"flex", gap:12, marginBottom:12, alignItems:"center", justifyContent:"center" }}>
            <button disabled={spreadIndex===0} onClick={() => { setCurrentPage(Math.max(0, (spreadIndex-1)*2)); setActiveSide("left"); setSelected(null); }} style={{
              background:`${PASTEL_PURPLE}15`, border:"none", borderRadius:8, padding:"8px 16px",
              cursor:spreadIndex===0?"not-allowed":"pointer", opacity:spreadIndex===0?0.3:1,
              fontSize:13, color:DEEP_PURPLE, fontFamily:"'Quicksand',sans-serif", fontWeight:600 }}>
              ‹ {t("Prev Spread","السابق")}
            </button>
            <span style={{ fontSize:13, fontWeight:600, color:DARK_PURPLE }}>
              {spreadIndex===0 ? t("Cover","الغلاف") : `${t("Spread","وجه")} ${spreadIndex}`} ({spreadIndex+1} / {totalSpreads})
            </span>
            <button disabled={spreadIndex>=totalSpreads-1} onClick={() => { setCurrentPage(Math.min(pages.length-2,(spreadIndex+1)*2)); setActiveSide("left"); setSelected(null); }} style={{
              background:`${PASTEL_PURPLE}15`, border:"none", borderRadius:8, padding:"8px 16px",
              cursor:spreadIndex>=totalSpreads-1?"not-allowed":"pointer", opacity:spreadIndex>=totalSpreads-1?0.3:1,
              fontSize:13, color:DEEP_PURPLE, fontFamily:"'Quicksand',sans-serif", fontWeight:600 }}>
              {t("Next Spread","التالي")} ›
            </button>
          </div>

          {/* ── Hidden off-screen pages for PDF export (html2canvas captures these) ── */}
          <div style={{ position:"absolute", left:-9999, top:0, pointerEvents:"none", zIndex:-1 }}>
            {pages.map((pg, i) => (
              <div key={pg.id} ref={el => { pageExportRefs.current[i] = el; }}
                style={{ width:400, height:520, background:pg.background||"#ffffff", position:"relative", overflow:"hidden", marginBottom:8 }}>
                {(pg.elements||[]).map(el => (
                  <div key={el.id} style={{
                    position:"absolute", left:el.x, top:el.y, width:el.w, height:el.h,
                    transform:`rotate(${el.rotation||0}deg)` }}>
                    {el.type==="image" && (
                      <img src={el.src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:2, display:"block" }} />
                    )}
                    {el.type==="sticker" && (
                      <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:Math.min(el.w,el.h)*0.7, lineHeight:1 }}>{el.content}</div>
                    )}
                    {el.type==="text" && (
                      <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center",
                        fontFamily:`'${el.font||"Quicksand"}',sans-serif`, fontSize:el.fontSize||18,
                        color:el.color||DARK_PURPLE, fontWeight:el.bold?"bold":"normal", fontStyle:el.italic?"italic":"normal",
                        textAlign:"center", padding:4, wordBreak:"break-word", whiteSpace:"pre-wrap" }}>
                        {el.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel: properties ── */}
        {selEl && (
          <div style={{ width:200, background:"white", borderLeft:isRTL?"none":`1px solid ${PASTEL_PURPLE}15`,
            borderRight:isRTL?`1px solid ${PASTEL_PURPLE}15`:"none", padding:16, overflowY:"auto", flexShrink:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:DARK_PURPLE, opacity:0.5, marginBottom:12, textTransform:"uppercase", letterSpacing:1 }}>
              {t("Properties","الخصائص")}
            </div>
            <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.5, marginBottom:4 }}>{t("Position X","الموضع X")}</div>
            <input type="number" value={Math.round(selEl.x)} onChange={e=>updateElement(selEl.id,{x:parseInt(e.target.value)||0})}
              style={{ ...inputStyle, marginBottom:8, fontSize:12, padding:"6px 10px" }} />
            <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.5, marginBottom:4 }}>{t("Position Y","الموضع Y")}</div>
            <input type="number" value={Math.round(selEl.y)} onChange={e=>updateElement(selEl.id,{y:parseInt(e.target.value)||0})}
              style={{ ...inputStyle, marginBottom:8, fontSize:12, padding:"6px 10px" }} />
            <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.5, marginBottom:4 }}>{t("Width","العرض")}</div>
            <input type="number" value={Math.round(selEl.w)} onChange={e=>updateElement(selEl.id,{w:Math.max(20,parseInt(e.target.value)||20)})}
              style={{ ...inputStyle, marginBottom:8, fontSize:12, padding:"6px 10px" }} />
            <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.5, marginBottom:4 }}>{t("Height","الارتفاع")}</div>
            <input type="number" value={Math.round(selEl.h)} onChange={e=>updateElement(selEl.id,{h:Math.max(20,parseInt(e.target.value)||20)})}
              style={{ ...inputStyle, marginBottom:8, fontSize:12, padding:"6px 10px" }} />
            <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.5, marginBottom:4 }}>{t("Rotation","الدوران")}</div>
            <input type="range" min={-180} max={180} value={selEl.rotation||0}
              onChange={e=>updateElement(selEl.id,{rotation:parseInt(e.target.value)})}
              style={{ width:"100%", marginBottom:12, accentColor:DEEP_PURPLE }} />
            <div style={{ fontSize:11, color:DARK_PURPLE, opacity:0.4, textAlign:"center", marginBottom:12 }}>{selEl.rotation||0}°</div>
            <button onClick={() => removeElement(selEl.id)} style={{ width:"100%", padding:"8px", borderRadius:10, fontSize:12,
              background:"#fdf0ef", border:"1px solid #f5b7b1", color:"#e74c3c", cursor:"pointer", fontWeight:700, fontFamily:"'Quicksand',sans-serif" }}>
              🗑️ {t("Delete","حذف")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Toolbar button helper ──────────────────────────────────────────────────────
function ToolBtn({ icon, label, onClick, active, danger }) {
  return (
    <button onClick={onClick} style={{ display:"flex", flexDirection:"column", alignItems:"center",
      padding:"4px 10px", borderRadius:8, border: active ? `1px solid ${DEEP_PURPLE}` : `1px solid ${PASTEL_PURPLE}20`,
      background: active ? `${PASTEL_PURPLE}20` : danger ? "#fdf0ef" : "transparent",
      cursor:"pointer", fontSize:13, color: danger ? "#e74c3c" : active ? DEEP_PURPLE : DARK_PURPLE,
      fontWeight: active ? 700 : 400, fontFamily:"'Quicksand',sans-serif", gap:1, transition:"all 0.15s ease" }}
      onMouseEnter={e => e.currentTarget.style.background=danger?"#fdf0ef":`${PASTEL_PURPLE}10`}
      onMouseLeave={e => e.currentTarget.style.background=active?`${PASTEL_PURPLE}20`:danger?"#fdf0ef":"transparent"}>
      <span style={{ fontSize:16 }}>{icon}</span>
      {label && <span style={{ fontSize:9, opacity:0.7 }}>{label}</span>}
    </button>
  );
}
