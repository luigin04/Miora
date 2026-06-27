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
  miles_memories: {
    src: "data:image/jpeg;base64,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",
    occasion: "Travel",
    title: "Miles & Memories",
    spineBg: "#f5eeee",
    spineText: "#d4a0a8",
  },
  forever_starts: {
    src: "data:image/jpeg;base64,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",
    occasion: "Wedding",
    title: "Forever Starts Here",
    spineBg: "#c8b8a8",
    spineText: "#a89880",
  },
  me_and_you: {
    src: "data:image/jpeg;base64,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",
    occasion: "Anniversary",
    title: "Me & You",
    spineBg: "#8b1a1a",
    spineText: "#6a1010",
  },
  sit_alkol: {
    src: "data:image/jpeg;base64,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",
    occasion: "Family",
    title: "ست الكل",
    spineBg: "#f4c8c8",
    spineText: "#d4a0a0",
  },
  dad_always: {
    src: "data:image/jpeg;base64,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",
    occasion: "Family",
    title: "Dad Always",
    spineBg: "#f0ece0",
    spineText: "#c0b898",
  },
  yearbook_2026: {
    src: "data:image/jpeg;base64,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",
    occasion: "Travel",
    title: "2026 Year Book",
    spineBg: "#f5f0ec",
    spineText: "#d4a0a8",
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
      const scale = 0.22 + Math.random() * 0.12;
      const duration = 10 + Math.random() * 8;
      const delay = Math.random() * 2;
      const tilt = (Math.random() - 0.5) * 16;
      const left = 4 + Math.random() * 88;
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

      {/* Floating Layal's real books — drift upward slowly from the bottom */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden" }}>
        {floatingBooks.map(b => {
          const W = 240 * b.scale;
          const H = 336 * b.scale;
          const SPINE_W = Math.round(28 * b.scale);
          return (
            <div key={b.id} style={{
              position:"absolute", bottom:"-5%", left:`${b.left}%`,
              animation:`bookFloat ${b.duration}s ease ${b.delay}s forwards`,
              opacity:0, transform:`rotate(${b.tilt}deg)`,
              display:"flex", filter:"drop-shadow(0 4px 14px rgba(74,48,104,0.18))" }}>
              {/* Spine */}
              <div style={{ width:SPINE_W, height:H, background:b.book.spineBg,
                borderRadius:`${3*b.scale}px 0 0 ${3*b.scale}px`,
                display:"flex", alignItems:"center", justifyContent:"center",
                flexShrink:0, boxShadow:"inset -2px 0 6px rgba(0,0,0,0.12)" }}>
                <div style={{ writingMode:"vertical-rl", transform:"rotate(180deg)",
                  fontSize:Math.max(5, 7*b.scale), fontWeight:700, letterSpacing:1.5,
                  textTransform:"uppercase", color:b.book.spineText, opacity:0.85,
                  fontFamily:"'Quicksand',sans-serif" }}>
                  {b.book.title}
                </div>
              </div>
              {/* Real cover photo */}
              <img src={b.book.src} alt={b.book.title}
                style={{ width:W, height:H, objectFit:"cover",
                  borderRadius:`0 ${3*b.scale}px ${3*b.scale}px 0`,
                  display:"block" }} />
            </div>
          );
        })}
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
