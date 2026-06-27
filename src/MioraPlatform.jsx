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
  dad_always: { src: "data:image/png;base64,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", occasion: "Family", title: "Dad Always" },
  yearbook_2026: { src: "data:image/png;base64,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", occasion: "Travel", title: "2026 Year Book" },
  miles_memories: { src: "data:image/png;base64,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", occasion: "Travel", title: "Miles & Memories" },
  forever_starts: { src: "data:image/png;base64,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", occasion: "Wedding", title: "Forever Starts Here" },
  me_and_you: { src: "data:image/png;base64,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", occasion: "Anniversary", title: "Me & You" },
  sit_alkol: { src: "data:image/png;base64,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", occasion: "Family", title: "ست الكل" },
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
  { key:"forever_starts",  label:"Wedding",       labelAr:"زفاف" },
  { key:"me_and_you",      label:"Anniversary",   labelAr:"ذكرى سنوية" },
  { key:"sit_alkol",       label:"Family",        labelAr:"عائلة" },
  { key:"dad_always",      label:"Family",        labelAr:"عائلة" },
  { key:"miles_memories",  label:"Travel",        labelAr:"سفر" },
  { key:"yearbook_2026",   label:"Year Book",     labelAr:"ألبوم السنة" },
];

function OccasionBooksShowcase({ isMobile, t }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef(null);

  const goTo = (idx, dir) => {
    if (animating) return;
    setAnimating(true);
    setDirection(dir);
    setTimeout(() => { setActiveIdx(idx); setAnimating(false); }, 320);
  };

  const next = () => goTo((activeIdx + 1) % OCCASION_BOOKS.length, 1);
  const prev = () => goTo((activeIdx - 1 + OCCASION_BOOKS.length) % OCCASION_BOOKS.length, -1);

  const resetTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!animating) {
        setAnimating(true);
        setDirection(1);
        setTimeout(() => { setActiveIdx(prev => (prev + 1) % OCCASION_BOOKS.length); setAnimating(false); }, 320);
      }
    }, 3000);
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setAnimating(true);
      setDirection(1);
      setTimeout(() => { setActiveIdx(prev => (prev + 1) % OCCASION_BOOKS.length); setAnimating(false); }, 320);
    }, 3000);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const book = OCCASION_BOOKS[activeIdx];
  const imgData = LAYAL_BOOK_IMAGES[book.key];
  const imgH = isMobile ? 280 : 380;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingBottom:48 }}>

      {/* Book image */}
      <div style={{ height:imgH + 20, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <img
          src={imgData?.src}
          alt={book.label}
          style={{
            height: imgH,
            width: "auto",
            opacity: animating ? 0 : 1,
            transform: animating ? `translateX(${direction * 40}px) scale(0.96)` : "translateX(0) scale(1)",
            transition: animating
              ? "opacity 0.25s ease, transform 0.25s ease"
              : "opacity 0.3s ease 0.05s, transform 0.3s ease 0.05s",
          }}
        />
      </div>

      {/* Controls */}
      <div style={{ display:"flex", alignItems:"center", gap:20, marginTop:8 }}>
        <button onClick={() => { prev(); resetTimer(); }}
          style={{ width:36, height:36, borderRadius:"50%", border:`1.5px solid ${PASTEL_PURPLE}40`,
            background:"white", cursor:"pointer", fontSize:16, color:DEEP_PURPLE,
            display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>

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
            display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
      </div>

      {/* Label */}
      <div style={{ marginTop:16, fontSize:isMobile?13:15, color:DARK_PURPLE, opacity:0.5,
        fontFamily:"'Playfair Display',serif", letterSpacing:1 }}>
        {t(book.label, book.labelAr)}
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
