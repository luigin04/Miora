import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const PASTEL_PURPLE = "#D8C0FF";
const DEEP_PURPLE = "#7B5EA7";
const DARK_PURPLE = "#4A3068";
const LIGHT_BG = "#FAF7FF";
const WARM_WHITE = "#FFFEF9";
const SOFT_PINK = "#F5E6FF";
const GOLD_ACCENT = "#D4A853";

const STORAGE_KEYS = {
  LANG: "miora_lang",
  REVIEWS: "miora_reviews",
  PROJECTS: "miora_projects",
  PAYMENTS: "miora_payments",
};

const PRICING = [
  { pages: "30–40", price: "22–25 JOD" },
  { pages: "41–55", price: "26–29 JOD" },
  { pages: "56–70", price: "34–37 JOD" },
  { pages: "71–85", price: "34–37 JOD" },
  { pages: "86–100", price: "38–41 JOD" },
  { pages: "101–115", price: "42–46 JOD" },
  { pages: "116–130", price: "47–50 JOD" },
  { pages: "131–146", price: "51–55 JOD" },
  { pages: "147–162", price: "56–60 JOD" },
  { pages: "163–178", price: "61–65 JOD" },
];

const OCCASIONS = [
  { name: "Wedding", nameAr: "زفاف", emoji: "💍" },
  { name: "Baby Shower", nameAr: "استقبال مولود", emoji: "🍼" },
  { name: "Birthday", nameAr: "عيد ميلاد", emoji: "🎂" },
  { name: "Graduation", nameAr: "تخرج", emoji: "🎓" },
  { name: "Engagement", nameAr: "خطوبة", emoji: "💐" },
  { name: "Travel", nameAr: "سفر", emoji: "✈️" },
  { name: "Family", nameAr: "عائلة", emoji: "👨‍👩‍👧‍👦" },
  { name: "Anniversary", nameAr: "ذكرى سنوية", emoji: "❤️" },
];

const DEFAULT_REVIEWS = [
  { id: "r1", name: "Sara A.", rating: 5, text: "The album for my wedding was absolutely stunning! Every page was beautifully designed.", nameAr: "سارة أ.", textAr: "ألبوم زفافي كان رائعاً! كل صفحة كانت مصممة بشكل جميل.", date: "2026-04-12" },
  { id: "r2", name: "Rania K.", rating: 5, text: "I used the AI option and was blown away. It arranged 80 photos perfectly!", nameAr: "رانيا ك.", textAr: "استخدمت خيار الذكاء الاصطناعي وكانت النتيجة مذهلة!", date: "2026-03-28" },
  { id: "r3", name: "Ahmad M.", rating: 4, text: "Great quality and fast service. The preset templates saved me so much time.", nameAr: "أحمد م.", textAr: "جودة ممتازة وخدمة سريعة. القوالب الجاهزة وفرت لي الكثير من الوقت.", date: "2026-03-15" },
  { id: "r4", name: "Lina T.", rating: 5, text: "My baby shower album is something I'll treasure forever. Thank you Miora!", nameAr: "لينا ت.", textAr: "ألبوم استقبال المولود سأحتفظ به للأبد. شكراً ميورا!", date: "2026-02-20" },
];

// ─── Storage Helpers ─────────────────────────────────────────────────────────

function loadFromStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Storage save failed:", e);
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function MioraPlatform() {
  const [lang, setLang] = useState(() => loadFromStorage(STORAGE_KEYS.LANG, "en"));
  const [currentView, setCurrentView] = useState("home");
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [paymentProof, setPaymentProof] = useState(null);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [reviewForm, setReviewForm] = useState({ name: "", rating: 5, text: "" });
  const [reviews, setReviews] = useState(() => loadFromStorage(STORAGE_KEYS.REVIEWS, DEFAULT_REVIEWS));
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [projects, setProjects] = useState(() => loadFromStorage(STORAGE_KEYS.PROJECTS, []));
  const [payments, setPayments] = useState(() => loadFromStorage(STORAGE_KEYS.PAYMENTS, []));
  const [scrollY, setScrollY] = useState(0);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [saveToast, setSaveToast] = useState(null);

  const isRTL = lang === "ar";
  const dir = isRTL ? "rtl" : "ltr";
  const t = (en, ar) => (lang === "ar" ? ar : en);

  // Persist lang
  useEffect(() => { saveToStorage(STORAGE_KEYS.LANG, lang); }, [lang]);
  // Persist reviews
  useEffect(() => { saveToStorage(STORAGE_KEYS.REVIEWS, reviews); }, [reviews]);
  // Persist projects
  useEffect(() => { saveToStorage(STORAGE_KEYS.PROJECTS, projects); }, [projects]);
  // Persist payments
  useEffect(() => { saveToStorage(STORAGE_KEYS.PAYMENTS, payments); }, [payments]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (saveToast) {
      const timer = setTimeout(() => setSaveToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [saveToast]);

  const showToast = (msg) => setSaveToast(msg);

  // ─── Project CRUD ──────────────────────────────────────────────────────

  const createProject = (mode, occasion) => {
    const newProject = {
      id: generateId(),
      mode,
      occasion: occasion || "General",
      title: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pages: [{ id: generateId(), elements: [] }],
      selectedImages: [],
      status: "draft",
    };
    setProjects((prev) => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    return newProject.id;
  };

  const updateProject = useCallback((projectId, updates) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, ...updates, updatedAt: new Date().toISOString() }
          : p
      )
    );
    showToast(lang === "ar" ? "تم حفظ التقدم ✓" : "Progress saved ✓");
  }, [lang]);

  const deleteProject = (projectId) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
      setCurrentView("my-projects");
    }
  };

  const addPayment = (paymentData) => {
    setPayments((prev) => [paymentData, ...prev]);
  };

  // ─── Sub-views ──────────────────────────────────────────────────────────

  if (currentView === "my-projects") {
    return (
      <MyProjectsView
        projects={projects}
        onBack={() => setCurrentView("home")}
        onOpen={(id) => {
          const proj = projects.find((p) => p.id === id);
          if (proj) {
            setActiveProjectId(id);
            setCurrentView(`editor-${proj.mode}`);
          }
        }}
        onDelete={deleteProject}
        t={t}
        lang={lang}
        isRTL={isRTL}
      />
    );
  }

  if (currentView === "editor-manual" || currentView === "editor-ai" || currentView === "editor-template") {
    const mode = currentView.replace("editor-", "");
    let projectId = activeProjectId;
    if (!projectId || !projects.find((p) => p.id === projectId)) {
      projectId = createProject(mode);
    }
    const project = projects.find((p) => p.id === projectId);
    return (
      <BookEditorView
        mode={mode}
        project={project}
        onBack={() => { setActiveProjectId(null); setCurrentView("home"); }}
        onUpdate={(updates) => updateProject(projectId, updates)}
        t={t}
        lang={lang}
        isRTL={isRTL}
      />
    );
  }

  if (currentView === "payment") {
    return (
      <PaymentView
        selectedPackage={selectedPackage}
        paymentProof={paymentProof}
        setPaymentProof={setPaymentProof}
        paymentSubmitted={paymentSubmitted}
        setPaymentSubmitted={setPaymentSubmitted}
        addPayment={addPayment}
        onBack={() => { setCurrentView("home"); setPaymentSubmitted(false); setPaymentProof(null); }}
        t={t}
        lang={lang}
        isRTL={isRTL}
      />
    );
  }

  if (currentView === "my-orders") {
    return (
      <MyOrdersView
        payments={payments}
        onBack={() => setCurrentView("home")}
        t={t}
        lang={lang}
        isRTL={isRTL}
      />
    );
  }

  // ─── Home ───────────────────────────────────────────────────────────────

  const savedCount = projects.length;

  return (
    <div dir={dir} style={{ fontFamily: "'Quicksand', 'Noto Sans Arabic', sans-serif", color: DARK_PURPLE, background: WARM_WHITE, minHeight: "100vh", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&family=Noto+Sans+Arabic:wght@300;400;500;600;700&family=Londrina+Solid:wght@400;900&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Save Toast */}
      {saveToast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 200,
          background: DARK_PURPLE, color: "white", padding: "10px 24px", borderRadius: 30,
          fontSize: 13, fontWeight: 600, boxShadow: `0 4px 20px rgba(0,0,0,0.2)`,
          animation: "fadeInUp 0.3s ease-out",
        }}>
          {saveToast}
        </div>
      )}

      {/* ── Navbar ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrollY > 50 ? "rgba(255,254,249,0.95)" : "transparent",
        backdropFilter: scrollY > 50 ? "blur(12px)" : "none",
        borderBottom: scrollY > 50 ? `1px solid ${PASTEL_PURPLE}40` : "none",
        transition: "all 0.3s ease",
        padding: "12px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div onClick={() => setCurrentView("home")} style={{ fontFamily: "'Londrina Solid', cursive", fontSize: 28, color: DEEP_PURPLE, letterSpacing: 2, cursor: "pointer" }}>
          MIORA <span style={{ fontFamily: "'Quicksand'", fontSize: 13, fontWeight: 300, opacity: 0.7, letterSpacing: 1 }}>by Layal</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <NavLinks t={t} isRTL={isRTL} savedCount={savedCount} onMyProjects={() => setCurrentView("my-projects")} onMyOrders={() => setCurrentView("my-orders")} />
          <button onClick={() => setLang(lang === "en" ? "ar" : "en")} style={{
            background: `${PASTEL_PURPLE}30`, border: `1px solid ${PASTEL_PURPLE}60`, borderRadius: 20,
            padding: "6px 14px", cursor: "pointer", fontSize: 13, color: DEEP_PURPLE, fontWeight: 600,
          }}>
            {lang === "en" ? "عربي" : "EN"}
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        textAlign: "center", padding: "120px 24px 60px",
        background: `linear-gradient(180deg, ${SOFT_PINK} 0%, ${WARM_WHITE} 60%, ${WARM_WHITE} 100%)`,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: `${PASTEL_PURPLE}15`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, left: -60, width: 200, height: 200, borderRadius: "50%", background: `${PASTEL_PURPLE}10`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "30%", left: "10%", width: 12, height: 12, borderRadius: "50%", background: `${GOLD_ACCENT}40`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "20%", right: "15%", width: 8, height: 8, borderRadius: "50%", background: `${PASTEL_PURPLE}50`, pointerEvents: "none" }} />

        <div style={{ fontFamily: "'Londrina Solid', cursive", fontSize: "clamp(48px, 10vw, 96px)", color: DEEP_PURPLE, lineHeight: 1, marginBottom: 8, letterSpacing: 4, animation: "fadeInUp 0.8s ease-out" }}>
          MIORA
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(14px, 3vw, 20px)", color: DARK_PURPLE, opacity: 0.6, letterSpacing: 6, textTransform: "uppercase", marginBottom: 32, animation: "fadeInUp 0.8s ease-out 0.2s both" }}>
          by Layal
        </div>
        <p style={{ fontSize: "clamp(16px, 2.5vw, 22px)", maxWidth: 600, lineHeight: 1.7, color: DARK_PURPLE, opacity: 0.8, fontWeight: 300, marginBottom: 40, animation: "fadeInUp 0.8s ease-out 0.4s both" }}>
          {t(
            "Create beautiful photo albums for life's most precious moments. Design your own, let AI create for you, or choose from our curated templates.",
            "أنشئ ألبومات صور جميلة لأغلى لحظات الحياة. صمم بنفسك، دع الذكاء الاصطناعي يصمم لك، أو اختر من قوالبنا المنسقة."
          )}
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", animation: "fadeInUp 0.8s ease-out 0.6s both" }}>
          <HeroButton label={t("Start Creating", "ابدأ التصميم")} primary onClick={() => document.getElementById("create-section")?.scrollIntoView({ behavior: "smooth" })} />
          {savedCount > 0 && (
            <HeroButton label={t(`My Projects (${savedCount})`, `مشاريعي (${savedCount})`)} onClick={() => setCurrentView("my-projects")} />
          )}
          <HeroButton label={t("View Pricing", "عرض الأسعار")} onClick={() => document.getElementById("pricing-section")?.scrollIntoView({ behavior: "smooth" })} />
        </div>
      </section>

      {/* ── Saved Projects Banner (if any) ── */}
      {savedCount > 0 && (
        <section style={{
          padding: "20px 24px", textAlign: "center",
          background: `linear-gradient(90deg, ${PASTEL_PURPLE}15, ${SOFT_PINK}20, ${PASTEL_PURPLE}15)`,
          borderBottom: `1px solid ${PASTEL_PURPLE}15`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: DARK_PURPLE, opacity: 0.7 }}>
              {t(`You have ${savedCount} saved project${savedCount > 1 ? "s" : ""}`, `لديك ${savedCount} مشروع${savedCount > 1 ? "" : ""} محفوظ`)}
            </span>
            <button onClick={() => setCurrentView("my-projects")} style={{
              background: DEEP_PURPLE, color: "white", border: "none", borderRadius: 16,
              padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "'Quicksand', sans-serif",
            }}>
              {t("Continue Working →", "تابع العمل →")}
            </button>
          </div>
        </section>
      )}

      {/* ── Occasions ── */}
      <section style={{ padding: "80px 24px", background: WARM_WHITE, textAlign: "center" }}>
        <SectionTitle title={t("For Every Occasion", "لكل مناسبة")} subtitle={t("Celebrate your milestones with a beautifully crafted album", "احتفل بمناسباتك مع ألبوم مصمم بعناية")} />
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20, maxWidth: 800, margin: "0 auto" }}>
          {OCCASIONS.map((occ, i) => (
            <div key={i} style={{
              background: `linear-gradient(135deg, ${SOFT_PINK}, white)`,
              border: `1px solid ${PASTEL_PURPLE}30`,
              borderRadius: 16, padding: "20px 28px", minWidth: 140,
              transition: "all 0.3s ease", cursor: "pointer",
              boxShadow: `0 2px 12px ${PASTEL_PURPLE}10`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${PASTEL_PURPLE}25`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 2px 12px ${PASTEL_PURPLE}10`; }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{occ.emoji}</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: DARK_PURPLE }}>{t(occ.name, occ.nameAr)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Create Your Book ── */}
      <section id="create-section" style={{ padding: "80px 24px", background: `linear-gradient(180deg, ${WARM_WHITE}, ${SOFT_PINK}30)`, textAlign: "center" }}>
        <SectionTitle title={t("Create Your Album", "أنشئ ألبومك")} subtitle={t("Choose how you'd like to build your photo book", "اختر الطريقة التي تفضلها لإنشاء ألبوم صورك")} />
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24, maxWidth: 1000, margin: "0 auto" }}>
          <CreateOptionCard
            icon="✏️"
            title={t("Design Your Own", "صمم بنفسك")}
            desc={t("Drag & drop your photos, add stickers, text, and decorations. Full creative control.", "اسحب وأفلت صورك، أضف ملصقات ونصوص وزخارف. تحكم إبداعي كامل.")}
            onClick={() => { setActiveProjectId(null); setCurrentView("editor-manual"); }}
            gradient={`linear-gradient(135deg, ${PASTEL_PURPLE}20, ${SOFT_PINK}40)`}
          />
          <CreateOptionCard
            icon="🤖"
            title={t("AI-Powered Design", "تصميم بالذكاء الاصطناعي")}
            desc={t("Upload your photos and let our AI create a stunning layout with stickers and designs automatically.", "ارفع صورك ودع الذكاء الاصطناعي يصمم تخطيطاً مذهلاً مع ملصقات وتصاميم تلقائياً.")}
            onClick={() => { setActiveProjectId(null); setCurrentView("editor-ai"); }}
            gradient={`linear-gradient(135deg, #E8D5FF30, ${PASTEL_PURPLE}25)`}
            badge={t("Popular", "الأكثر طلباً")}
          />
          <CreateOptionCard
            icon="📋"
            title={t("Use a Template", "استخدم قالباً")}
            desc={t("Browse pre-designed album templates by Layal. Just add your photos to the ready-made layout.", "تصفح قوالب ألبومات مصممة مسبقاً من ليال. فقط أضف صورك إلى التخطيط الجاهز.")}
            onClick={() => { setActiveProjectId(null); setCurrentView("editor-template"); }}
            gradient={`linear-gradient(135deg, #FFE8F020, #F5E6FF30)`}
          />
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ padding: "80px 24px", background: WARM_WHITE, textAlign: "center" }}>
        <SectionTitle title={t("How It Works", "كيف يعمل")} subtitle={t("From photos to a printed album in 4 simple steps", "من الصور إلى ألبوم مطبوع في 4 خطوات بسيطة")} />
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 32, maxWidth: 900, margin: "0 auto" }}>
          {[
            { step: 1, icon: "📸", title: t("Upload Photos", "ارفع الصور"), desc: t("Select your favorite photos from any device", "اختر صورك المفضلة من أي جهاز") },
            { step: 2, icon: "🎨", title: t("Design Album", "صمم الألبوم"), desc: t("Create manually, use AI, or pick a template", "صمم يدوياً، استخدم الذكاء الاصطناعي، أو اختر قالباً") },
            { step: 3, icon: "💳", title: t("Pay & Confirm", "ادفع وأكّد"), desc: t("Choose your package and submit payment via CliQ", "اختر الباقة وأرسل الدفع عبر كليك") },
            { step: 4, icon: "📦", title: t("Receive Album", "استلم الألبوم"), desc: t("We print and deliver your beautiful album", "نطبع ونوصل ألبومك الجميل") },
          ].map((s) => (
            <div key={s.step} style={{ flex: "1 1 180px", maxWidth: 200, textAlign: "center" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%", margin: "0 auto 16px",
                background: `linear-gradient(135deg, ${PASTEL_PURPLE}30, ${SOFT_PINK})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, border: `2px solid ${PASTEL_PURPLE}40`,
              }}>
                {s.icon}
              </div>
              <div style={{ fontSize: 12, color: DEEP_PURPLE, fontWeight: 700, marginBottom: 4, opacity: 0.5 }}>{t("Step", "خطوة")} {s.step}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: DARK_PURPLE }}>{s.title}</div>
              <div style={{ fontSize: 13, color: DARK_PURPLE, opacity: 0.6, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing-section" style={{ padding: "80px 24px", background: `linear-gradient(180deg, ${WARM_WHITE}, ${SOFT_PINK}20)`, textAlign: "center" }}>
        <SectionTitle title={t("Pricing", "الأسعار")} subtitle={t("Choose the perfect size for your album", "اختر الحجم المثالي لألبومك")} />
        <div style={{
          maxWidth: 700, margin: "0 auto", background: "white",
          borderRadius: 20, overflow: "hidden",
          border: `1px solid ${PASTEL_PURPLE}25`,
          boxShadow: `0 4px 24px ${PASTEL_PURPLE}10`,
        }}>
          {PRICING.map((p, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "16px 28px",
              borderBottom: i < PRICING.length - 1 ? `1px solid ${PASTEL_PURPLE}15` : "none",
              background: i % 2 === 0 ? "transparent" : `${SOFT_PINK}20`,
              cursor: "pointer", transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = `${PASTEL_PURPLE}15`}
            onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : `${SOFT_PINK}20`}
            onClick={() => { setSelectedPackage(p); setCurrentView("payment"); }}
            >
              <div>
                <span style={{ fontWeight: 600, fontSize: 15, color: DARK_PURPLE }}>{p.pages}</span>
                <span style={{ fontSize: 13, color: DARK_PURPLE, opacity: 0.5, marginLeft: 8 }}>{t("pages", "صفحة")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: DEEP_PURPLE }}>{p.price}</span>
                <span style={{
                  fontSize: 11, background: `${PASTEL_PURPLE}25`, color: DEEP_PURPLE,
                  padding: "4px 10px", borderRadius: 12, fontWeight: 600,
                }}>
                  {t("Select", "اختر")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Reviews ── */}
      <section id="reviews-section" style={{ padding: "80px 24px", background: WARM_WHITE, textAlign: "center" }}>
        <SectionTitle title={t("Customer Reviews", "آراء العملاء")} subtitle={t("What our customers say about their Miora experience", "ماذا يقول عملاؤنا عن تجربتهم مع ميورا")} />
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20, maxWidth: 900, margin: "0 auto 40px" }}>
          {reviews.slice(0, 8).map((r, i) => (
            <div key={r.id || i} style={{
              background: "white", borderRadius: 16, padding: 24, flex: "1 1 240px", maxWidth: 280,
              border: `1px solid ${PASTEL_PURPLE}20`, boxShadow: `0 2px 12px ${PASTEL_PURPLE}08`,
              textAlign: isRTL ? "right" : "left",
            }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 8, justifyContent: isRTL ? "flex-end" : "flex-start" }}>
                {Array.from({ length: 5 }).map((_, si) => (
                  <span key={si} style={{ color: si < r.rating ? GOLD_ACCENT : "#ddd", fontSize: 16 }}>★</span>
                ))}
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: DARK_PURPLE, opacity: 0.75, marginBottom: 12 }}>
                "{t(r.text, r.textAr || r.text)}"
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: DEEP_PURPLE }}>{t(r.name, r.nameAr || r.name)}</div>
                {r.date && <div style={{ fontSize: 11, color: DARK_PURPLE, opacity: 0.35 }}>{r.date}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Review Form */}
        {!reviewSubmitted ? (
          <div style={{
            maxWidth: 480, margin: "0 auto", background: "white", borderRadius: 20, padding: 32,
            border: `1px solid ${PASTEL_PURPLE}20`, boxShadow: `0 4px 20px ${PASTEL_PURPLE}08`,
            textAlign: isRTL ? "right" : "left",
          }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: DARK_PURPLE, marginBottom: 20, textAlign: "center" }}>
              {t("Leave a Review", "اترك تقييماً")}
            </h3>
            <input
              placeholder={t("Your Name", "اسمك")}
              value={reviewForm.name}
              onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })}
              style={inputStyle}
              dir={dir}
            />
            <div style={{ marginBottom: 16, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: DARK_PURPLE, opacity: 0.6, marginBottom: 8 }}>{t("Rating", "التقييم")}</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} onClick={() => setReviewForm({ ...reviewForm, rating: s })}
                    style={{ cursor: "pointer", fontSize: 28, color: s <= reviewForm.rating ? GOLD_ACCENT : "#ddd", transition: "transform 0.2s" }}
                    onMouseEnter={(e) => e.target.style.transform = "scale(1.2)"}
                    onMouseLeave={(e) => e.target.style.transform = "scale(1)"}
                  >★</span>
                ))}
              </div>
            </div>
            <textarea
              placeholder={t("Share your experience...", "شاركنا تجربتك...")}
              value={reviewForm.text}
              onChange={(e) => setReviewForm({ ...reviewForm, text: e.target.value })}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
              dir={dir}
            />
            <button onClick={() => {
              if (reviewForm.name && reviewForm.text) {
                const newReview = {
                  id: generateId(),
                  name: reviewForm.name,
                  rating: reviewForm.rating,
                  text: reviewForm.text,
                  nameAr: reviewForm.name,
                  textAr: reviewForm.text,
                  date: new Date().toISOString().split("T")[0],
                };
                setReviews((prev) => [newReview, ...prev]);
                setReviewSubmitted(true);
                setReviewForm({ name: "", rating: 5, text: "" });
              }
            }} style={primaryBtnStyle}>
              {t("Submit Review", "أرسل التقييم")}
            </button>
          </div>
        ) : (
          <div style={{
            maxWidth: 400, margin: "0 auto", background: `linear-gradient(135deg, ${SOFT_PINK}, white)`,
            borderRadius: 20, padding: 40, textAlign: "center", border: `1px solid ${PASTEL_PURPLE}25`,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💜</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: DEEP_PURPLE, marginBottom: 8 }}>
              {t("Thank you!", "شكراً لك!")}
            </div>
            <div style={{ fontSize: 14, color: DARK_PURPLE, opacity: 0.6 }}>
              {t("Your review has been submitted and saved.", "تم إرسال تقييمك وحفظه.")}
            </div>
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: "40px 24px", background: DARK_PURPLE, color: "white", textAlign: "center" }}>
        <div style={{ fontFamily: "'Londrina Solid', cursive", fontSize: 24, marginBottom: 8, letterSpacing: 2 }}>MIORA</div>
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 16 }}>by Layal</div>
        <div style={{ fontSize: 13, opacity: 0.4, marginBottom: 8 }}>
          {t("Amman, Jordan", "عمّان، الأردن")} • {t("All rights reserved", "جميع الحقوق محفوظة")} © 2026
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 16 }}>
          <a href="#" style={{ color: PASTEL_PURPLE, fontSize: 13, textDecoration: "none", opacity: 0.7 }}>Instagram</a>
          <a href="#" style={{ color: PASTEL_PURPLE, fontSize: 13, textDecoration: "none", opacity: 0.7 }}>WhatsApp</a>
        </div>
        <div style={{ marginTop: 16, fontSize: 11, opacity: 0.25 }}>
          {t("Data saved locally on this device", "البيانات محفوظة محلياً على هذا الجهاز")}
        </div>
      </footer>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        ::selection { background: ${PASTEL_PURPLE}60; }
      `}</style>
    </div>
  );
}

// ─── Shared Styles ───────────────────────────────────────────────────────────

const inputStyle = {
  width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 14,
  border: `1px solid ${PASTEL_PURPLE}30`, background: `${SOFT_PINK}15`,
  outline: "none", marginBottom: 16, fontFamily: "'Quicksand', 'Noto Sans Arabic', sans-serif",
  color: DARK_PURPLE,
};

const primaryBtnStyle = {
  width: "100%", padding: "14px", borderRadius: 14, fontSize: 15, fontWeight: 700,
  background: `linear-gradient(135deg, ${DEEP_PURPLE}, ${DARK_PURPLE})`,
  color: "white", border: "none", cursor: "pointer", fontFamily: "'Quicksand', sans-serif",
  transition: "all 0.3s ease",
};

const pageShell = {
  minHeight: "100vh", fontFamily: "'Quicksand', 'Noto Sans Arabic', sans-serif",
  color: DARK_PURPLE, padding: 24,
};

const fontLink = "https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&family=Noto+Sans+Arabic:wght@300;400;500;600;700&family=Londrina+Solid:wght@400;900&family=Playfair+Display:wght@400;600;700&display=swap";

const backBtnStyle = {
  background: "none", border: "none", color: DEEP_PURPLE, cursor: "pointer",
  fontSize: 14, fontWeight: 600, marginBottom: 24, display: "flex",
  alignItems: "center", gap: 8, fontFamily: "'Quicksand', sans-serif",
};

// ─── NavLinks ────────────────────────────────────────────────────────────────

function NavLinks({ t, isRTL, savedCount, onMyProjects, onMyOrders }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <a href="#create-section" style={{ fontSize: 13, color: DARK_PURPLE, textDecoration: "none", fontWeight: 500, opacity: 0.7 }}>{t("Create", "أنشئ")}</a>
      {savedCount > 0 && (
        <span onClick={onMyProjects} style={{ fontSize: 13, color: DEEP_PURPLE, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          {t("My Projects", "مشاريعي")}
          <span style={{ background: GOLD_ACCENT, color: "white", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>{savedCount}</span>
        </span>
      )}
      <span onClick={onMyOrders} style={{ fontSize: 13, color: DARK_PURPLE, textDecoration: "none", fontWeight: 500, opacity: 0.7, cursor: "pointer" }}>{t("Orders", "الطلبات")}</span>
      <a href="#pricing-section" style={{ fontSize: 13, color: DARK_PURPLE, textDecoration: "none", fontWeight: 500, opacity: 0.7 }}>{t("Pricing", "الأسعار")}</a>
      <a href="#reviews-section" style={{ fontSize: 13, color: DARK_PURPLE, textDecoration: "none", fontWeight: 500, opacity: 0.7 }}>{t("Reviews", "التقييمات")}</a>
    </div>
  );
}

// ─── Section Title ───────────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(24px, 4vw, 36px)", color: DARK_PURPLE, marginBottom: 8 }}>{title}</h2>
      <p style={{ fontSize: 14, color: DARK_PURPLE, opacity: 0.5, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>{subtitle}</p>
      <div style={{ width: 48, height: 3, background: `linear-gradient(90deg, ${PASTEL_PURPLE}, ${GOLD_ACCENT})`, borderRadius: 2, margin: "16px auto 0" }} />
    </div>
  );
}

function HeroButton({ label, primary, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "14px 36px", borderRadius: 30, fontSize: 15, fontWeight: 600,
      background: primary ? `linear-gradient(135deg, ${DEEP_PURPLE}, ${DARK_PURPLE})` : "transparent",
      color: primary ? "white" : DEEP_PURPLE,
      border: primary ? "none" : `2px solid ${PASTEL_PURPLE}60`,
      cursor: "pointer", fontFamily: "'Quicksand', sans-serif",
      transition: "all 0.3s ease", letterSpacing: 0.5,
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 20px ${PASTEL_PURPLE}30`; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {label}
    </button>
  );
}

function CreateOptionCard({ icon, title, desc, onClick, gradient, badge }) {
  return (
    <div onClick={onClick} style={{
      flex: "1 1 260px", maxWidth: 300, background: gradient || "white",
      borderRadius: 20, padding: 32, cursor: "pointer",
      border: `1px solid ${PASTEL_PURPLE}20`, position: "relative",
      transition: "all 0.3s ease", textAlign: "center",
      boxShadow: `0 2px 16px ${PASTEL_PURPLE}08`,
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = `0 12px 32px ${PASTEL_PURPLE}20`; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 2px 16px ${PASTEL_PURPLE}08`; }}
    >
      {badge && (
        <div style={{
          position: "absolute", top: 12, right: 12, background: GOLD_ACCENT,
          color: "white", fontSize: 10, fontWeight: 700, padding: "4px 10px",
          borderRadius: 10, letterSpacing: 0.5,
        }}>{badge}</div>
      )}
      <div style={{ fontSize: 40, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: DARK_PURPLE, marginBottom: 12 }}>{title}</h3>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: DARK_PURPLE, opacity: 0.6 }}>{desc}</p>
      <div style={{ marginTop: 20, fontSize: 13, fontWeight: 700, color: DEEP_PURPLE }}>→</div>
    </div>
  );
}

// ─── My Projects View ────────────────────────────────────────────────────────

function MyProjectsView({ projects, onBack, onOpen, onDelete, t, lang, isRTL }) {
  const [confirmDelete, setConfirmDelete] = useState(null);

  const modeLabels = {
    manual: { en: "Manual Design", ar: "تصميم يدوي", icon: "✏️" },
    ai: { en: "AI Design", ar: "تصميم ذكي", icon: "🤖" },
    template: { en: "Template", ar: "قالب", icon: "📋" },
  };

  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(lang === "ar" ? "ar-JO" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ ...pageShell, background: `linear-gradient(180deg, ${SOFT_PINK}30, ${WARM_WHITE})` }}>
      <link href={fontLink} rel="stylesheet" />
      <button onClick={onBack} style={backBtnStyle}>← {t("Back to Home", "العودة للرئيسية")}</button>

      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, textAlign: "center", marginBottom: 8, color: DARK_PURPLE }}>
          {t("My Saved Projects", "مشاريعي المحفوظة")}
        </h1>
        <p style={{ textAlign: "center", fontSize: 13, color: DARK_PURPLE, opacity: 0.5, marginBottom: 32 }}>
          {t("Your album projects are saved on this device. Pick up where you left off.", "مشاريع ألبوماتك محفوظة على هذا الجهاز. أكمل من حيث توقفت.")}
        </p>

        {projects.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, background: "white", borderRadius: 20, border: `1px solid ${PASTEL_PURPLE}15` }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: DARK_PURPLE, marginBottom: 8 }}>
              {t("No projects yet", "لا توجد مشاريع بعد")}
            </div>
            <div style={{ fontSize: 13, color: DARK_PURPLE, opacity: 0.5 }}>
              {t("Start creating an album and your progress will be saved here.", "ابدأ بإنشاء ألبوم وسيتم حفظ تقدمك هنا.")}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {projects.map((proj) => {
              const ml = modeLabels[proj.mode] || modeLabels.manual;
              return (
                <div key={proj.id} style={{
                  background: "white", borderRadius: 16, padding: "20px 24px",
                  border: `1px solid ${PASTEL_PURPLE}15`,
                  boxShadow: `0 2px 12px ${PASTEL_PURPLE}06`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  gap: 16, flexWrap: "wrap",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 200 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, display: "flex",
                      alignItems: "center", justifyContent: "center", fontSize: 22,
                      background: `${PASTEL_PURPLE}15`,
                    }}>
                      {ml.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: DARK_PURPLE }}>
                        {proj.title || t(ml.en, ml.ar)} — {proj.occasion}
                      </div>
                      <div style={{ fontSize: 12, color: DARK_PURPLE, opacity: 0.45, marginTop: 2 }}>
                        {t("Last edited", "آخر تعديل")}: {formatDate(proj.updatedAt)}
                        {" · "}{proj.pages?.length || 1} {t("pages", "صفحات")}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => onOpen(proj.id)} style={{
                      background: DEEP_PURPLE, color: "white", border: "none", borderRadius: 12,
                      padding: "8px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      fontFamily: "'Quicksand', sans-serif",
                    }}>
                      {t("Continue", "تابع")}
                    </button>
                    {confirmDelete === proj.id ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => { onDelete(proj.id); setConfirmDelete(null); }} style={{
                          background: "#e74c3c", color: "white", border: "none", borderRadius: 10,
                          padding: "8px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                          fontFamily: "'Quicksand', sans-serif",
                        }}>{t("Yes", "نعم")}</button>
                        <button onClick={() => setConfirmDelete(null)} style={{
                          background: `${PASTEL_PURPLE}20`, color: DARK_PURPLE, border: "none",
                          borderRadius: 10, padding: "8px 12px", fontSize: 11, fontWeight: 600,
                          cursor: "pointer", fontFamily: "'Quicksand', sans-serif",
                        }}>{t("No", "لا")}</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(proj.id)} style={{
                        background: `${PASTEL_PURPLE}15`, color: DARK_PURPLE, border: "none",
                        borderRadius: 12, padding: "8px 14px", fontSize: 12, cursor: "pointer",
                        fontFamily: "'Quicksand', sans-serif", opacity: 0.6,
                      }}>
                        {t("Delete", "حذف")}
                      </button>
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

// ─── My Orders View ──────────────────────────────────────────────────────────

function MyOrdersView({ payments, onBack, t, lang, isRTL }) {
  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-JO" : "en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return iso; }
  };

  const statusColors = { pending: GOLD_ACCENT, approved: "#27ae60", rejected: "#e74c3c" };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ ...pageShell, background: `linear-gradient(180deg, ${SOFT_PINK}30, ${WARM_WHITE})` }}>
      <link href={fontLink} rel="stylesheet" />
      <button onClick={onBack} style={backBtnStyle}>← {t("Back to Home", "العودة للرئيسية")}</button>

      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, textAlign: "center", marginBottom: 8, color: DARK_PURPLE }}>
          {t("My Orders", "طلباتي")}
        </h1>
        <p style={{ textAlign: "center", fontSize: 13, color: DARK_PURPLE, opacity: 0.5, marginBottom: 32 }}>
          {t("Track the status of your payment submissions.", "تتبع حالة إثباتات الدفع الخاصة بك.")}
        </p>

        {payments.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, background: "white", borderRadius: 20, border: `1px solid ${PASTEL_PURPLE}15` }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: DARK_PURPLE, marginBottom: 8 }}>
              {t("No orders yet", "لا توجد طلبات بعد")}
            </div>
            <div style={{ fontSize: 13, color: DARK_PURPLE, opacity: 0.5 }}>
              {t("Once you submit a payment proof, it will appear here.", "بمجرد إرسال إثبات دفع، سيظهر هنا.")}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {payments.map((pay, i) => (
              <div key={pay.id || i} style={{
                background: "white", borderRadius: 16, padding: "20px 24px",
                border: `1px solid ${PASTEL_PURPLE}15`, boxShadow: `0 2px 12px ${PASTEL_PURPLE}06`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: DARK_PURPLE }}>
                    {pay.package?.pages || "—"} {t("pages", "صفحة")}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 10,
                    color: "white", background: statusColors[pay.status] || GOLD_ACCENT,
                  }}>
                    {pay.status === "pending" ? t("Pending Review", "قيد المراجعة") :
                     pay.status === "approved" ? t("Approved", "تمت الموافقة") :
                     t("Rejected", "مرفوض")}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: DARK_PURPLE, opacity: 0.5 }}>
                  {pay.package?.price || "—"} · {t("Submitted", "أُرسل")}: {formatDate(pay.date)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Payment View ────────────────────────────────────────────────────────────

function PaymentView({ selectedPackage, paymentProof, setPaymentProof, paymentSubmitted, setPaymentSubmitted, addPayment, onBack, t, lang, isRTL }) {
  const fileInputRef = useRef(null);
  const [proofPreview, setProofPreview] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPaymentProof(file);
      const reader = new FileReader();
      reader.onload = (ev) => setProofPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (paymentProof) {
      addPayment({
        id: generateId(),
        package: selectedPackage,
        status: "pending",
        date: new Date().toISOString(),
        hasProof: true,
      });
      setPaymentSubmitted(true);
    }
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ ...pageShell, background: `linear-gradient(180deg, ${SOFT_PINK}40, ${WARM_WHITE})` }}>
      <link href={fontLink} rel="stylesheet" />
      <button onClick={onBack} style={backBtnStyle}>← {t("Back to Home", "العودة للرئيسية")}</button>

      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, textAlign: "center", marginBottom: 8, color: DARK_PURPLE }}>
          {t("Complete Your Order", "أكمل طلبك")}
        </h1>

        {selectedPackage && (
          <div style={{
            background: "white", borderRadius: 16, padding: 24, marginBottom: 24,
            border: `1px solid ${PASTEL_PURPLE}20`, textAlign: "center",
          }}>
            <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 4 }}>{t("Selected Package", "الباقة المختارة")}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: DEEP_PURPLE }}>{selectedPackage.pages} {t("pages", "صفحة")}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: GOLD_ACCENT, marginTop: 4 }}>{selectedPackage.price}</div>
          </div>
        )}

        {!paymentSubmitted ? (
          <div style={{
            background: "white", borderRadius: 20, padding: 32,
            border: `1px solid ${PASTEL_PURPLE}20`, boxShadow: `0 4px 20px ${PASTEL_PURPLE}08`,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, textAlign: "center", color: DARK_PURPLE }}>
              {t("Payment via CliQ", "الدفع عبر كليك")}
            </h3>

            <div style={{
              background: `${SOFT_PINK}30`, borderRadius: 12, padding: 20, marginBottom: 24,
              border: `1px dashed ${PASTEL_PURPLE}40`, textAlign: isRTL ? "right" : "left",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: DEEP_PURPLE }}>
                {t("Payment Instructions:", "تعليمات الدفع:")}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: DARK_PURPLE, opacity: 0.7 }}>
                1. {t("Open your banking app", "افتح تطبيق البنك الخاص بك")}<br />
                2. {t("Send payment via CliQ to:", "أرسل الدفع عبر كليك إلى:")}<br />
                <span style={{ fontWeight: 700, color: DEEP_PURPLE, fontSize: 15 }}>Miora.Layal</span><br />
                3. {t("Screenshot your payment confirmation", "التقط لقطة شاشة لتأكيد الدفع")}<br />
                4. {t("Upload the screenshot below", "ارفع لقطة الشاشة أدناه")}
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${PASTEL_PURPLE}50`, borderRadius: 16, padding: 32,
                textAlign: "center", cursor: "pointer", marginBottom: 20,
                background: proofPreview ? "transparent" : `${SOFT_PINK}10`,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = DEEP_PURPLE}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = `${PASTEL_PURPLE}50`}
            >
              {proofPreview ? (
                <img src={proofPreview} alt="Payment proof" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8 }} />
              ) : (
                <>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📤</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: DEEP_PURPLE }}>
                    {t("Upload Payment Proof", "ارفع إثبات الدفع")}
                  </div>
                  <div style={{ fontSize: 12, color: DARK_PURPLE, opacity: 0.4, marginTop: 4 }}>
                    {t("Click to select a screenshot", "اضغط لاختيار لقطة الشاشة")}
                  </div>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!paymentProof}
              style={{ ...primaryBtnStyle, opacity: paymentProof ? 1 : 0.4, cursor: paymentProof ? "pointer" : "not-allowed" }}
            >
              {t("Submit Payment Proof", "إرسال إثبات الدفع")}
            </button>
          </div>
        ) : (
          <div style={{
            background: "white", borderRadius: 20, padding: 40, textAlign: "center",
            border: `1px solid ${PASTEL_PURPLE}20`,
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: DARK_PURPLE, marginBottom: 12 }}>
              {t("Payment Proof Submitted!", "تم إرسال إثبات الدفع!")}
            </h3>
            <p style={{ fontSize: 14, color: DARK_PURPLE, opacity: 0.6, lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
              {t(
                "Your payment proof has been sent for review. You'll receive confirmation once the owner approves your payment. This usually takes 1-2 hours.",
                "تم إرسال إثبات الدفع للمراجعة. ستتلقى تأكيداً بمجرد موافقة المالك على الدفع. عادة ما يستغرق ذلك 1-2 ساعة."
              )}
            </p>
            <div style={{
              marginTop: 24, padding: 16, borderRadius: 12,
              background: `${PASTEL_PURPLE}10`, fontSize: 13, color: DEEP_PURPLE,
            }}>
              {t("Status: ", "الحالة: ")}<span style={{ fontWeight: 700, color: GOLD_ACCENT }}>{t("Pending Review", "قيد المراجعة")}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Book Editor View (with auto-save) ───────────────────────────────────────

function BookEditorView({ mode, project, onBack, onUpdate, t, lang, isRTL }) {
  const [title, setTitle] = useState(project?.title || "");
  const [occasion, setOccasion] = useState(project?.occasion || "General");
  const [pages, setPages] = useState(project?.pages || [{ id: generateId(), elements: [] }]);
  const [currentPage, setCurrentPage] = useState(0);
  const [lastSaved, setLastSaved] = useState(null);
  const autoSaveTimer = useRef(null);

  // Auto-save every 3 seconds after changes
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      onUpdate({ title, occasion, pages });
      setLastSaved(new Date());
    }, 3000);
  }, [title, occasion, pages, onUpdate]);

  useEffect(() => { triggerAutoSave(); return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); }; }, [title, occasion, pages, triggerAutoSave]);

  // Save on unmount
  useEffect(() => {
    return () => { onUpdate({ title, occasion, pages }); };
  }, []);

  const addPage = () => {
    setPages((prev) => [...prev, { id: generateId(), elements: [] }]);
    setCurrentPage(pages.length);
  };

  const removePage = (idx) => {
    if (pages.length <= 1) return;
    setPages((prev) => prev.filter((_, i) => i !== idx));
    if (currentPage >= pages.length - 1) setCurrentPage(Math.max(0, pages.length - 2));
  };

  const modeConfig = {
    manual: { icon: "✏️", label: t("Manual Editor", "المحرر اليدوي"), color: DEEP_PURPLE },
    ai: { icon: "🤖", label: t("AI Designer", "المصمم الذكي"), color: "#9b59b6" },
    template: { icon: "📋", label: t("Template Editor", "محرر القوالب"), color: GOLD_ACCENT },
  };
  const mc = modeConfig[mode];

  const formatTime = (d) => {
    if (!d) return "";
    return d.toLocaleTimeString(lang === "ar" ? "ar-JO" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ ...pageShell, background: `linear-gradient(180deg, ${SOFT_PINK}20, ${WARM_WHITE})`, padding: 0 }}>
      <link href={fontLink} rel="stylesheet" />

      {/* ── Top bar ── */}
      <div style={{
        background: "white", borderBottom: `1px solid ${PASTEL_PURPLE}20`,
        padding: "10px 20px", display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => { onUpdate({ title, occasion, pages }); onBack(); }} style={{
            background: "none", border: "none", color: DEEP_PURPLE, cursor: "pointer",
            fontSize: 14, fontWeight: 600, fontFamily: "'Quicksand', sans-serif",
          }}>
            ← {t("Save & Exit", "حفظ وخروج")}
          </button>
          <div style={{
            background: `${PASTEL_PURPLE}15`, borderRadius: 8, padding: "4px 10px",
            fontSize: 12, fontWeight: 600, color: mc.color, display: "flex", alignItems: "center", gap: 4,
          }}>
            {mc.icon} {mc.label}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastSaved && (
            <div style={{ fontSize: 11, color: DARK_PURPLE, opacity: 0.4, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#27ae60", display: "inline-block" }} />
              {t("Saved", "محفوظ")} {formatTime(lastSaved)}
            </div>
          )}
          <button onClick={() => { onUpdate({ title, occasion, pages }); setLastSaved(new Date()); }} style={{
            background: `${PASTEL_PURPLE}20`, border: `1px solid ${PASTEL_PURPLE}40`,
            borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 700,
            color: DEEP_PURPLE, cursor: "pointer", fontFamily: "'Quicksand', sans-serif",
          }}>
            💾 {t("Save Now", "احفظ الآن")}
          </button>
        </div>
      </div>

      {/* ── Editor Body ── */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 52px)" }}>
        {/* Sidebar */}
        <div style={{
          width: 220, background: "white", borderRight: isRTL ? "none" : `1px solid ${PASTEL_PURPLE}15`,
          borderLeft: isRTL ? `1px solid ${PASTEL_PURPLE}15` : "none",
          padding: 16, overflowY: "auto",
        }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: DARK_PURPLE, opacity: 0.5, marginBottom: 4, display: "block" }}>
              {t("Album Title", "عنوان الألبوم")}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("My Album", "ألبومي")}
              style={{ ...inputStyle, marginBottom: 8, fontSize: 13, padding: "8px 12px" }}
              dir={isRTL ? "rtl" : "ltr"}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: DARK_PURPLE, opacity: 0.5, marginBottom: 4, display: "block" }}>
              {t("Occasion", "المناسبة")}
            </label>
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              style={{ ...inputStyle, marginBottom: 0, fontSize: 13, padding: "8px 12px", cursor: "pointer" }}
            >
              <option value="General">{t("General", "عام")}</option>
              {OCCASIONS.map((o) => (
                <option key={o.name} value={o.name}>{t(o.name, o.nameAr)} {o.emoji}</option>
              ))}
            </select>
          </div>

          {/* Page list */}
          <div style={{ fontSize: 11, fontWeight: 700, color: DARK_PURPLE, opacity: 0.5, marginBottom: 8 }}>
            {t("Pages", "الصفحات")} ({pages.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
            {pages.map((pg, i) => (
              <div
                key={pg.id}
                onClick={() => setCurrentPage(i)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                  background: i === currentPage ? `${PASTEL_PURPLE}25` : "transparent",
                  border: i === currentPage ? `1px solid ${PASTEL_PURPLE}40` : `1px solid transparent`,
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: i === currentPage ? 700 : 400, color: DARK_PURPLE }}>
                  {t("Page", "صفحة")} {i + 1}
                </span>
                {pages.length > 1 && (
                  <span onClick={(e) => { e.stopPropagation(); removePage(i); }}
                    style={{ fontSize: 14, cursor: "pointer", color: "#ccc", lineHeight: 1 }}
                    onMouseEnter={(e) => e.target.style.color = "#e74c3c"}
                    onMouseLeave={(e) => e.target.style.color = "#ccc"}
                  >×</span>
                )}
              </div>
            ))}
          </div>
          <button onClick={addPage} style={{
            width: "100%", padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: `${PASTEL_PURPLE}15`, border: `1px dashed ${PASTEL_PURPLE}40`,
            color: DEEP_PURPLE, cursor: "pointer", fontFamily: "'Quicksand', sans-serif",
          }}>
            + {t("Add Page", "أضف صفحة")}
          </button>
        </div>

        {/* Canvas area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: `${SOFT_PINK}08` }}>
          <div style={{
            width: "100%", maxWidth: 560, aspectRatio: "8.5/11",
            background: "white", borderRadius: 4,
            boxShadow: `0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)`,
            border: `1px solid ${PASTEL_PURPLE}15`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
          }}>
            {/* Page content placeholder */}
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>
                {mode === "manual" ? "✏️" : mode === "ai" ? "🤖" : "📋"}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: DARK_PURPLE, opacity: 0.4, marginBottom: 8 }}>
                {t("Page", "صفحة")} {currentPage + 1}
              </div>
              <div style={{ fontSize: 12, color: DARK_PURPLE, opacity: 0.3, lineHeight: 1.6, maxWidth: 300 }}>
                {mode === "manual" && t(
                  "The drag-and-drop canvas with image placement, stickers, text tools, and decorations will be built in the next phase.",
                  "لوحة السحب والإفلات مع وضع الصور والملصقات وأدوات النص والزخارف ستُبنى في المرحلة التالية."
                )}
                {mode === "ai" && t(
                  "Upload your photos and the AI will auto-arrange them with beautiful layouts and stickers.",
                  "ارفع صورك وسيقوم الذكاء الاصطناعي بترتيبها تلقائياً مع تخطيطات وملصقات جميلة."
                )}
                {mode === "template" && t(
                  "Pre-designed templates will appear here. Select one and drop your photos into the layout.",
                  "ستظهر القوالب المصممة مسبقاً هنا. اختر واحداً وأضف صورك إلى التخطيط."
                )}
              </div>
            </div>

            {/* Page number */}
            <div style={{
              position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
              fontSize: 10, color: DARK_PURPLE, opacity: 0.25,
            }}>
              {currentPage + 1} / {pages.length}
            </div>
          </div>

          {/* Page nav */}
          <div style={{ display: "flex", gap: 12, marginTop: 20, alignItems: "center" }}>
            <button disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)} style={{
              background: `${PASTEL_PURPLE}15`, border: "none", borderRadius: 8,
              padding: "8px 16px", cursor: currentPage === 0 ? "not-allowed" : "pointer",
              opacity: currentPage === 0 ? 0.3 : 1, fontSize: 13, color: DEEP_PURPLE,
              fontFamily: "'Quicksand', sans-serif", fontWeight: 600,
            }}>
              ‹ {t("Prev", "السابق")}
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: DARK_PURPLE }}>
              {currentPage + 1} / {pages.length}
            </span>
            <button disabled={currentPage >= pages.length - 1} onClick={() => setCurrentPage((p) => p + 1)} style={{
              background: `${PASTEL_PURPLE}15`, border: "none", borderRadius: 8,
              padding: "8px 16px", cursor: currentPage >= pages.length - 1 ? "not-allowed" : "pointer",
              opacity: currentPage >= pages.length - 1 ? 0.3 : 1, fontSize: 13, color: DEEP_PURPLE,
              fontFamily: "'Quicksand', sans-serif", fontWeight: 600,
            }}>
              {t("Next", "التالي")} ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
