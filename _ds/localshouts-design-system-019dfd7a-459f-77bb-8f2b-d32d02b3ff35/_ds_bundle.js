/* @ds-bundle: {"format":3,"namespace":"LocalShoutsDesignSystem_019dfd","components":[],"sourceHashes":{"public/App.jsx":"d83c085f09bf","public/Preview.jsx":"ef92c53a447d","ui_kits/admin/Atoms.jsx":"e29ad4dd8caa","ui_kits/admin/Icons.jsx":"20ff770dc2d2","ui_kits/admin/Screens.jsx":"adf1f54ec4b9","ui_kits/admin/Sidebar.jsx":"4cefd57a2490","ui_kits/admin/Wizard.jsx":"5cd5eb233a7f"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.LocalShoutsDesignSystem_019dfd = window.LocalShoutsDesignSystem_019dfd || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// public/App.jsx
try { (() => {
/* LocalShouts — public landing + onboarding orchestrator.
   Sections: Hero (with live preview), Features steps, Free AI Generator,
   Conversion band. Modal: Signup / Onboarding wizard. */

const {
  useState,
  useEffect,
  useMemo,
  useRef
} = React;

// ── Tiny inline icons ──
const I = {
  spark: /*#__PURE__*/React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
  })),
  arrow: /*#__PURE__*/React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14M13 5l7 7-7 7"
  })),
  check: /*#__PURE__*/React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.6,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  })),
  copy: /*#__PURE__*/React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: 9,
    y: 9,
    width: 13,
    height: 13,
    rx: 2
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
  })),
  refresh: /*#__PURE__*/React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "23 4 23 10 17 10"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "1 20 1 14 7 14"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
  })),
  share: /*#__PURE__*/React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: 18,
    cy: 5,
    r: 3
  }), /*#__PURE__*/React.createElement("circle", {
    cx: 6,
    cy: 12,
    r: 3
  }), /*#__PURE__*/React.createElement("circle", {
    cx: 18,
    cy: 19,
    r: 3
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8.59",
    y1: "13.51",
    x2: "15.42",
    y2: "17.49"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "15.41",
    y1: "6.51",
    x2: "8.59",
    y2: "10.49"
  })),
  x: /*#__PURE__*/React.createElement("svg", {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: 18,
    y1: 6,
    x2: 6,
    y2: 18
  }), /*#__PURE__*/React.createElement("line", {
    x1: 6,
    y1: 6,
    x2: 18,
    y2: 18
  })),
  qr: /*#__PURE__*/React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: 3,
    y: 3,
    width: 7,
    height: 7
  }), /*#__PURE__*/React.createElement("rect", {
    x: 14,
    y: 3,
    width: 7,
    height: 7
  }), /*#__PURE__*/React.createElement("rect", {
    x: 3,
    y: 14,
    width: 7,
    height: 7
  }), /*#__PURE__*/React.createElement("line", {
    x1: 14,
    y1: 14,
    x2: 14,
    y2: 14.01
  }), /*#__PURE__*/React.createElement("line", {
    x1: 20,
    y1: 14,
    x2: 20,
    y2: 14.01
  }), /*#__PURE__*/React.createElement("line", {
    x1: 14,
    y1: 20,
    x2: 14,
    y2: 20.01
  }), /*#__PURE__*/React.createElement("line", {
    x1: 20,
    y1: 20,
    x2: 20,
    y2: 20.01
  })),
  card: /*#__PURE__*/React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: 2,
    y: 5,
    width: 20,
    height: 14,
    rx: 2
  }), /*#__PURE__*/React.createElement("line", {
    x1: 2,
    y1: 10,
    x2: 22,
    y2: 10
  })),
  phone: /*#__PURE__*/React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: 5,
    y: 2,
    width: 14,
    height: 20,
    rx: 2
  }), /*#__PURE__*/React.createElement("line", {
    x1: 12,
    y1: 18,
    x2: 12,
    y2: 18.01
  }))
};
const CATEGORIES = ['Cafe', 'Restaurant', 'Salon', 'Dentist', 'Gym', 'Clinic', 'Boutique', 'Bakery', 'Coworking', 'Auto Service', 'Pharmacy', 'Agency', 'Spa', 'Hotel', 'Ecommerce'];
const TONES = [{
  k: 'friendly',
  label: 'Friendly'
}, {
  k: 'professional',
  label: 'Professional'
}, {
  k: 'casual',
  label: 'Casual'
}, {
  k: 'enthusiastic',
  label: 'Enthusiastic'
}, {
  k: 'short',
  label: 'Short & sweet'
}];
const LANGS = [{
  k: 'en',
  label: 'English'
}, {
  k: 'hi',
  label: 'Hindi'
}, {
  k: 'mr',
  label: 'Marathi'
}, {
  k: 'es',
  label: 'Spanish'
}, {
  k: 'fr',
  label: 'French'
}, {
  k: 'de',
  label: 'German'
}];

// ─────────────────────────  TOPBAR  ─────────────────────────
const Topbar = ({
  onOpenSignup,
  onOpenLogin
}) => /*#__PURE__*/React.createElement("header", {
  className: "lp-top"
}, /*#__PURE__*/React.createElement("div", {
  className: "lp-top-inner"
}, /*#__PURE__*/React.createElement("img", {
  src: "../assets/logo.png",
  alt: "LocalShouts",
  className: "logo"
}), /*#__PURE__*/React.createElement("nav", {
  className: "lp-top-nav"
}, /*#__PURE__*/React.createElement("a", {
  href: "#try",
  className: "desktop-only"
}, "Try AI free"), /*#__PURE__*/React.createElement("a", {
  href: "#how",
  className: "desktop-only"
}, "How it works"), /*#__PURE__*/React.createElement("a", {
  href: "#",
  onClick: e => {
    e.preventDefault();
    onOpenLogin();
  },
  className: "desktop-only"
}, "Sign in"), /*#__PURE__*/React.createElement("a", {
  href: "#",
  onClick: e => {
    e.preventDefault();
    onOpenSignup();
  },
  className: "cta"
}, "Get started"))));

// ─────────────────────────  HERO  ─────────────────────────
const Hero = ({
  onOpenSignup,
  biz,
  setBiz,
  view,
  setView
}) => /*#__PURE__*/React.createElement("section", {
  className: "hero"
}, /*#__PURE__*/React.createElement("div", {
  className: "hero-inner"
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
  className: "hero-eyebrow"
}, /*#__PURE__*/React.createElement("span", {
  className: "dot"
}, "\u2726"), " AI-first reviews for local businesses"), /*#__PURE__*/React.createElement("h1", null, "Turn every visit into a ", /*#__PURE__*/React.createElement("span", {
  className: "grad"
}, "5-star review"), " on autopilot"), /*#__PURE__*/React.createElement("p", {
  className: "lead"
}, "LocalShouts uses AI to help your customers write thoughtful reviews in seconds \u2014 straight from a QR sticker on your counter. Set up in 2 minutes. No credit card needed."), /*#__PURE__*/React.createElement("div", {
  className: "hero-cta"
}, /*#__PURE__*/React.createElement("button", {
  className: "btn btn-primary btn-lg",
  onClick: onOpenSignup
}, I.spark, " Start free \u2014 see it live"), /*#__PURE__*/React.createElement("a", {
  href: "#try",
  className: "btn btn-outline btn-lg"
}, "Try the AI generator")), /*#__PURE__*/React.createElement("div", {
  className: "hero-trust"
}, /*#__PURE__*/React.createElement("div", {
  className: "hero-stack"
}, ['M', 'R', 'S', 'A', '+'].map((c, i) => /*#__PURE__*/React.createElement("span", {
  key: i
}, c))), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", {
  style: {
    color: 'var(--fg)'
  }
}, "1,400+"), " local businesses \xB7 240k reviews generated this month"))), /*#__PURE__*/React.createElement("div", {
  className: "hero-preview"
}, /*#__PURE__*/React.createElement("div", {
  className: "hero-preview-tab"
}, /*#__PURE__*/React.createElement("span", {
  style: {
    background: '#ff5f57'
  }
}), /*#__PURE__*/React.createElement("span", {
  style: {
    background: '#febc2e'
  }
}), /*#__PURE__*/React.createElement("span", {
  style: {
    background: '#28c840'
  }
}), /*#__PURE__*/React.createElement("div", {
  className: "url"
}, "localshouts.in/r/", (biz.name || 'your-business').toLowerCase().replace(/\s+/g, '-'))), /*#__PURE__*/React.createElement("div", {
  style: {
    marginBottom: 14,
    display: 'flex',
    justifyContent: 'center'
  }
}, /*#__PURE__*/React.createElement("div", {
  className: "tabs"
}, /*#__PURE__*/React.createElement("button", {
  className: view === 'review' ? 'on' : '',
  onClick: () => setView('review')
}, I.phone, " Review page"), /*#__PURE__*/React.createElement("button", {
  className: view === 'qr' ? 'on' : '',
  onClick: () => setView('qr')
}, I.qr, " QR sticker"), /*#__PURE__*/React.createElement("button", {
  className: view === 'card' ? 'on' : '',
  onClick: () => setView('card')
}, I.card, " Profile"))), /*#__PURE__*/React.createElement("div", {
  className: "phone fade-in",
  key: view + biz.name
}, /*#__PURE__*/React.createElement("div", {
  className: "phone-screen"
}, view === 'review' && /*#__PURE__*/React.createElement(ReviewPagePreview, biz), view === 'qr' && /*#__PURE__*/React.createElement(QRPreview, biz), view === 'card' && /*#__PURE__*/React.createElement(CardPreview, biz))))));

// ─────────────────────────  INTERACTIVE SETUP  ─────────────────────────
const InteractiveSetup = ({
  biz,
  setBiz,
  view,
  setView,
  onOpenSignup
}) => {
  const setKw = k => {
    const has = biz.keywords.includes(k);
    setBiz({
      ...biz,
      keywords: has ? biz.keywords.filter(x => x !== k) : [...biz.keywords, k].slice(0, 8)
    });
  };
  const [kwDraft, setKwDraft] = useState('');
  const addKw = () => {
    const v = kwDraft.trim();
    if (!v || biz.keywords.includes(v)) return;
    setBiz({
      ...biz,
      keywords: [...biz.keywords, v].slice(0, 8)
    });
    setKwDraft('');
  };
  const onLogo = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setBiz({
      ...biz,
      logoUrl: reader.result
    });
    reader.readAsDataURL(f);
  };
  const suggestKw = ['friendly staff', 'clean', 'great service', 'fast', 'cosy', 'best in town', 'recommended', 'value for money'];
  return /*#__PURE__*/React.createElement("section", {
    className: "lp-section",
    id: "how",
    style: {
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "lp-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "Live Preview"), /*#__PURE__*/React.createElement("h2", null, "Type your business \u2192 watch it come to life"), /*#__PURE__*/React.createElement("p", null, "Every change updates the review page, QR sticker and printable profile in real time. No signup required to play.")), /*#__PURE__*/React.createElement("div", {
    className: "live-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Business name"), /*#__PURE__*/React.createElement("input", {
    value: biz.name,
    onChange: e => setBiz({
      ...biz,
      name: e.target.value
    }),
    placeholder: "Mastani Cafe"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Category"), /*#__PURE__*/React.createElement("select", {
    value: biz.category,
    onChange: e => setBiz({
      ...biz,
      category: e.target.value
    })
  }, CATEGORIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c
  }, c)))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Logo (optional)"), /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: onLogo,
    style: {
      padding: '9px 10px',
      fontSize: 13
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "What customers should mention"), /*#__PURE__*/React.createElement("div", {
    className: "kw-input"
  }, /*#__PURE__*/React.createElement("input", {
    value: kwDraft,
    onChange: e => setKwDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addKw();
      }
    },
    placeholder: "e.g. friendly staff, fast service"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: addKw
  }, "Add")), /*#__PURE__*/React.createElement("div", {
    className: "chip-row"
  }, suggestKw.map(k => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: 'chip ' + (biz.keywords.includes(k) ? 'on' : ''),
    onClick: () => setKw(k)
  }, k))), biz.keywords.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "chip-row",
    style: {
      marginTop: 10
    }
  }, biz.keywords.map(k => /*#__PURE__*/React.createElement("span", {
    key: k,
    className: "chip on"
  }, k, " ", /*#__PURE__*/React.createElement("button", {
    onClick: () => setKw(k),
    style: {
      marginLeft: 6,
      background: 'none',
      border: 0,
      color: '#fff',
      cursor: 'pointer'
    }
  }, "\xD7"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: onOpenSignup
  }, I.spark, " Save & continue setup"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => setBiz({
      name: '',
      category: 'Cafe',
      keywords: [],
      logoUrl: null
    })
  }, "Reset"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "tabs"
  }, /*#__PURE__*/React.createElement("button", {
    className: view === 'review' ? 'on' : '',
    onClick: () => setView('review')
  }, I.phone, " Review page"), /*#__PURE__*/React.createElement("button", {
    className: view === 'qr' ? 'on' : '',
    onClick: () => setView('qr')
  }, I.qr, " QR sticker"), /*#__PURE__*/React.createElement("button", {
    className: view === 'card' ? 'on' : '',
    onClick: () => setView('card')
  }, I.card, " Profile")), /*#__PURE__*/React.createElement("div", {
    className: "phone fade-in",
    key: view + biz.name + (biz.logoUrl || '') + biz.keywords.join(',')
  }, /*#__PURE__*/React.createElement("div", {
    className: "phone-screen"
  }, view === 'review' && /*#__PURE__*/React.createElement(ReviewPagePreview, biz), view === 'qr' && /*#__PURE__*/React.createElement(QRPreview, biz), view === 'card' && /*#__PURE__*/React.createElement(CardPreview, biz)))))));
};

// ─────────────────────────  FREE AI GENERATOR  ─────────────────────────
const buildFallback = ({
  subject,
  category,
  tone,
  lang,
  keywords
}) => {
  const kws = keywords.length ? keywords : ['friendly staff', 'great experience', 'will return'];
  const opener = {
    friendly: `Just visited ${subject || 'this ' + category.toLowerCase()} and had to share —`,
    professional: `Recently experienced ${subject || category.toLowerCase()} services and was thoroughly impressed.`,
    casual: `Okay so ${subject || 'this place'} is honestly pretty great.`,
    enthusiastic: `WOW! ${subject || 'This ' + category.toLowerCase()} blew me away!`,
    short: `${subject || 'This ' + category.toLowerCase()} —`
  }[tone] || '';
  const body = `${kws.slice(0, 3).map(k => k).join(', ')} — everything you'd want from a ${category.toLowerCase()}.`;
  const closer = tone === 'short' ? ' Worth it.' : ` Will definitely be back. Highly recommend!`;
  const langTag = lang !== 'en' ? `\n\n(Generated in ${LANGS.find(l => l.k === lang)?.label})` : '';
  return `${opener} ${body}${closer}${langTag}`;
};
const Generator = () => {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Cafe');
  const [tone, setTone] = useState('friendly');
  const [lang, setLang] = useState('en');
  const [keywords, setKeywords] = useState([]);
  const [kwDraft, setKwDraft] = useState('');
  const [out, setOut] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const addKw = () => {
    const v = kwDraft.trim();
    if (!v || keywords.includes(v)) return;
    setKeywords([...keywords, v].slice(0, 6));
    setKwDraft('');
  };
  const removeKw = k => setKeywords(keywords.filter(x => x !== k));
  const generate = async () => {
    setLoading(true);
    setOut('');
    setCopied(false);
    const prompt = `Write a single Google review (3-5 sentences) for ${subject || 'a local ' + category.toLowerCase()}. Category: ${category}. Tone: ${tone}. Language: ${LANGS.find(l => l.k === lang)?.label}. Naturally mention: ${(keywords.length ? keywords : ['friendly staff', 'great experience']).join(', ')}. Sound authentic, like a real customer. Do not use markdown or headers. Output the review text only.`;
    try {
      const text = await window.claude.complete(prompt);
      setOut((text || '').trim() || buildFallback({
        subject,
        category,
        tone,
        lang,
        keywords
      }));
    } catch {
      // fallback so the demo always works
      await new Promise(r => setTimeout(r, 800));
      setOut(buildFallback({
        subject,
        category,
        tone,
        lang,
        keywords
      }));
    } finally {
      setLoading(false);
    }
  };
  const copy = () => {
    navigator.clipboard?.writeText(out);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const share = async () => {
    const data = {
      title: 'AI Review by LocalShouts',
      text: out,
      url: location.href
    };
    try {
      if (navigator.share) await navigator.share(data);else copy();
    } catch {}
  };
  const examples = ['Mastani Cafe', 'GlowUp Salon', 'Dr. Sharma Dental', 'FitZone Gym', 'Aspire IT Agency'];
  return /*#__PURE__*/React.createElement("section", {
    className: "lp-section",
    id: "try"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lp-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow",
    style: {
      background: '#fef3c7',
      color: '#b45309'
    }
  }, "100% Free \xB7 No signup"), /*#__PURE__*/React.createElement("h2", null, "Generate an AI review for anything"), /*#__PURE__*/React.createElement("p", null, "Try the engine that powers LocalShouts. Describe a business, pick a tone & language \u2014 get a natural-sounding review in seconds.")), /*#__PURE__*/React.createElement("div", {
    className: "gen-shell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gen-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Business or thing to review"), /*#__PURE__*/React.createElement("input", {
    value: subject,
    onChange: e => setSubject(e.target.value),
    placeholder: "e.g. Mastani Cafe in Pune"
  }), /*#__PURE__*/React.createElement("div", {
    className: "chip-row",
    style: {
      marginTop: 8
    }
  }, examples.map(ex => /*#__PURE__*/React.createElement("button", {
    key: ex,
    className: "chip",
    onClick: () => setSubject(ex)
  }, ex)))), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Category"), /*#__PURE__*/React.createElement("select", {
    value: category,
    onChange: e => setCategory(e.target.value)
  }, CATEGORIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c
  }, c)))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Language"), /*#__PURE__*/React.createElement("select", {
    value: lang,
    onChange: e => setLang(e.target.value)
  }, LANGS.map(l => /*#__PURE__*/React.createElement("option", {
    key: l.k,
    value: l.k
  }, l.label))))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Tone"), /*#__PURE__*/React.createElement("div", {
    className: "chip-row"
  }, TONES.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.k,
    className: 'chip ' + (tone === t.k ? 'on' : ''),
    onClick: () => setTone(t.k)
  }, t.label)))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Things to mention (optional)"), /*#__PURE__*/React.createElement("div", {
    className: "kw-input"
  }, /*#__PURE__*/React.createElement("input", {
    value: kwDraft,
    onChange: e => setKwDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addKw();
      }
    },
    placeholder: "e.g. friendly staff, great coffee"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: addKw
  }, "Add")), keywords.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "chip-row",
    style: {
      marginTop: 8
    }
  }, keywords.map(k => /*#__PURE__*/React.createElement("span", {
    key: k,
    className: "chip on"
  }, k, " ", /*#__PURE__*/React.createElement("button", {
    onClick: () => removeKw(k),
    style: {
      marginLeft: 6,
      background: 'none',
      border: 0,
      color: '#fff',
      cursor: 'pointer'
    }
  }, "\xD7"))))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary btn-lg",
    onClick: generate,
    disabled: loading,
    style: {
      width: '100%',
      marginTop: 6,
      justifyContent: 'center'
    }
  }, loading ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "ai-typing"
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null)), " Generating\u2026") : /*#__PURE__*/React.createElement(React.Fragment, null, I.spark, " Generate review"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "spread",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 8,
      background: 'var(--brand-purple)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, I.spark), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 14px/1 var(--font-sans)'
    }
  }, "AI-generated review")), out && /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: copy
  }, copied ? I.check : I.copy, " ", copied ? 'Copied' : 'Copy'), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: share
  }, I.share, " Share"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: generate,
    title: "Regenerate"
  }, I.refresh))), /*#__PURE__*/React.createElement("div", {
    className: "review-out",
    style: {
      flex: 1
    }
  }, loading && /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ai-typing"
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null)), /*#__PURE__*/React.createElement("div", null, "Crafting a ", tone, " review\u2026")), !loading && !out && /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 12,
      background: 'var(--brand-purple-100)',
      color: 'var(--brand-purple-700)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4
    }
  }, I.spark), /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--fg)',
      font: '600 14px/1.3 var(--font-sans)'
    }
  }, "Your AI review will appear here"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5
    }
  }, "Fill in the fields and hit Generate.")), !loading && out && /*#__PURE__*/React.createElement("div", {
    className: "out-text fade-in"
  }, [1, 2, 3, 4, 5].map(i => /*#__PURE__*/React.createElement("svg", {
    key: i,
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "#f59e0b",
    style: {
      marginRight: 1
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2l2.6 6.4 6.9.6-5.2 4.6 1.6 6.7L12 16.9 5.9 20.3l1.6-6.7L2.5 9l6.9-.6L12 2z"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, out))), out && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 14,
      background: '#fff',
      border: '1px dashed var(--brand-purple-200)',
      borderRadius: 12
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 14px/1.3 var(--font-sans)',
      color: 'var(--brand-navy)'
    }
  }, "Like what you see?"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 10px',
      font: '400 13.5px/1.5 var(--font-sans)',
      color: 'var(--fg-2)'
    }
  }, "Set up LocalShouts for your business \u2014 your customers get this magic on every visit, automatically."), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary btn-sm",
    onClick: () => document.dispatchEvent(new CustomEvent('open-signup'))
  }, I.spark, " Activate for my business ", I.arrow)))))));
};

// ─────────────────────────  STEPS  ─────────────────────────
const Steps = () => /*#__PURE__*/React.createElement("section", {
  className: "lp-section",
  style: {
    background: '#fbfaf7'
  }
}, /*#__PURE__*/React.createElement("div", {
  className: "lp-wrap"
}, /*#__PURE__*/React.createElement("div", {
  className: "section-h"
}, /*#__PURE__*/React.createElement("span", {
  className: "eyebrow"
}, "How it works"), /*#__PURE__*/React.createElement("h2", null, "Live in 4 simple steps"), /*#__PURE__*/React.createElement("p", null, "From signup to your first 5-star review, in under 10 minutes.")), /*#__PURE__*/React.createElement("div", {
  className: "steps"
}, [{
  n: 1,
  h: 'Create your business',
  p: 'Add your name, category, and a few keywords customers love about you.'
}, {
  n: 2,
  h: 'Get your AI review page',
  p: 'Auto-built and branded with your logo. Hosted on a clean URL.'
}, {
  n: 3,
  h: 'Print your QR sticker',
  p: 'Download a beautiful QR design or order printed stickers shipped to you.'
}, {
  n: 4,
  h: 'Watch reviews roll in',
  p: 'Customers tap the AI helper, post in seconds, your Google ratings climb.'
}].map(s => /*#__PURE__*/React.createElement("div", {
  key: s.n,
  className: "step"
}, /*#__PURE__*/React.createElement("div", {
  className: "n"
}, s.n), /*#__PURE__*/React.createElement("h4", null, s.h), /*#__PURE__*/React.createElement("p", null, s.p))))));

// ─────────────────────────  CTA BAND  ─────────────────────────
const CtaBand = ({
  onOpenSignup
}) => /*#__PURE__*/React.createElement("section", {
  className: "cta-band"
}, /*#__PURE__*/React.createElement("div", {
  className: "cta-band-inner"
}, /*#__PURE__*/React.createElement("h2", null, "Ready for more 5-star reviews?"), /*#__PURE__*/React.createElement("p", null, "Set up LocalShouts in under 2 minutes. No card needed. Cancel anytime."), /*#__PURE__*/React.createElement("button", {
  className: "btn btn-primary btn-lg",
  onClick: onOpenSignup,
  style: {
    background: '#fff',
    color: 'var(--brand-purple)',
    boxShadow: '0 12px 30px -10px rgba(0,0,0,.4)'
  }
}, I.spark, " Start free \u2192")));

// ─────────────────────────  SIGNUP / ONBOARDING MODAL  ─────────────────────────
const SignupModal = ({
  onClose,
  prefill,
  mode = 'signup'
}) => {
  const isSignin = mode === 'signin';
  const [step, setStep] = useState(isSignin ? 'signin' : 'account');
  const [account, setAccount] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [biz, setBiz] = useState({
    name: prefill.name || '',
    category: prefill.category || 'Cafe',
    logoUrl: prefill.logoUrl || null,
    keywords: prefill.keywords || [],
    address: '',
    phone: ''
  });
  const [view, setView] = useState('review');
  if (isSignin) {
    return /*#__PURE__*/React.createElement("div", {
      className: "modal-bg",
      onClick: e => e.target === e.currentTarget && onClose()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal",
      style: {
        maxWidth: 420
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '22px 22px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("strong", {
      style: {
        font: '800 20px/1 var(--font-sans)',
        letterSpacing: '-.01em'
      }
    }, "Welcome back"), /*#__PURE__*/React.createElement("button", {
      onClick: onClose,
      className: "btn btn-ghost btn-sm",
      style: {
        padding: 6
      }
    }, I.x)), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 22
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "field"
    }, /*#__PURE__*/React.createElement("label", null, "Email"), /*#__PURE__*/React.createElement("input", {
      type: "email",
      placeholder: "you@business.com"
    })), /*#__PURE__*/React.createElement("div", {
      className: "field"
    }, /*#__PURE__*/React.createElement("label", null, "Password"), /*#__PURE__*/React.createElement("input", {
      type: "password",
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
    })), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary",
      style: {
        width: '100%',
        justifyContent: 'center'
      }
    }, "Sign in"), /*#__PURE__*/React.createElement("div", {
      className: "center",
      style: {
        marginTop: 14,
        font: '400 13px/1.5 var(--font-sans)',
        color: 'var(--fg-3)'
      }
    }, "New here? ", /*#__PURE__*/React.createElement("a", {
      href: "#",
      onClick: e => {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('open-signup'));
      },
      style: {
        color: 'var(--brand-purple)',
        fontWeight: 600,
        textDecoration: 'none'
      }
    }, "Create an account")))));
  }
  const StepDots = () => {
    const steps = ['account', 'business', 'launch'];
    const idx = steps.indexOf(step);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        padding: '0 0 4px'
      }
    }, steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
      key: s,
      style: {
        flex: 1,
        height: 4,
        borderRadius: 99,
        background: i <= idx ? 'var(--brand-purple)' : 'var(--line)'
      }
    })));
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-bg",
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    style: {
      maxWidth: step === 'launch' ? 720 : 480
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 22px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "spread",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../assets/logo_small.png",
    style: {
      height: 24
    }
  }), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 14px/1 var(--font-sans)',
      color: 'var(--fg-3)'
    }
  }, step === 'account' && 'Create your account', step === 'business' && 'Tell us about your business', step === 'launch' && '🎉 You\'re ready to go!')), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "btn btn-ghost btn-sm",
    style: {
      padding: 6
    }
  }, I.x)), /*#__PURE__*/React.createElement(StepDots, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 22px 22px',
      overflow: 'auto'
    }
  }, step === 'account' && /*#__PURE__*/React.createElement("div", {
    className: "fade-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Your name"), /*#__PURE__*/React.createElement("input", {
    value: account.name,
    onChange: e => setAccount({
      ...account,
      name: e.target.value
    }),
    placeholder: "Aarav Mehta"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Work email"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: account.email,
    onChange: e => setAccount({
      ...account,
      email: e.target.value
    }),
    placeholder: "you@business.com"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Password"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: account.password,
    onChange: e => setAccount({
      ...account,
      password: e.target.value
    }),
    placeholder: "At least 8 characters"
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    style: {
      width: '100%',
      justifyContent: 'center',
      marginTop: 6
    },
    disabled: !account.email || !account.password,
    onClick: () => setStep('business')
  }, "Continue ", I.arrow), /*#__PURE__*/React.createElement("div", {
    className: "center",
    style: {
      marginTop: 14,
      font: '400 12.5px/1.5 var(--font-sans)',
      color: 'var(--fg-3)'
    }
  }, "By continuing you agree to our Terms & Privacy.")), step === 'business' && /*#__PURE__*/React.createElement("div", {
    className: "fade-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Business name"), /*#__PURE__*/React.createElement("input", {
    value: biz.name,
    onChange: e => setBiz({
      ...biz,
      name: e.target.value
    }),
    placeholder: "Mastani Cafe"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Category"), /*#__PURE__*/React.createElement("select", {
    value: biz.category,
    onChange: e => setBiz({
      ...biz,
      category: e.target.value
    })
  }, CATEGORIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c
  }, c)))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Phone"), /*#__PURE__*/React.createElement("input", {
    value: biz.phone,
    onChange: e => setBiz({
      ...biz,
      phone: e.target.value
    }),
    placeholder: "98xxxxxxxx"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Address (optional)"), /*#__PURE__*/React.createElement("input", {
    value: biz.address,
    onChange: e => setBiz({
      ...biz,
      address: e.target.value
    }),
    placeholder: "Koregaon Park, Pune"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Logo"), /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: e => {
      const f = e.target.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => setBiz({
        ...biz,
        logoUrl: r.result
      });
      r.readAsDataURL(f);
    },
    style: {
      padding: '9px 10px',
      fontSize: 13
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      justifyContent: 'space-between',
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => setStep('account')
  }, "\u2190 Back"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    disabled: !biz.name,
    onClick: () => setStep('launch')
  }, "Create my review page ", I.spark))), step === 'launch' && /*#__PURE__*/React.createElement("div", {
    className: "fade-in"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 20,
      alignItems: 'center'
    },
    className: "launch-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-block',
      padding: '4px 10px',
      background: 'var(--success-bg)',
      color: 'var(--success)',
      borderRadius: 99,
      font: '700 11px/1 var(--font-sans)',
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      marginBottom: 12
    }
  }, I.check, " All set"), /*#__PURE__*/React.createElement("h3", {
    style: {
      font: '800 24px/1.1 var(--font-sans)',
      letterSpacing: '-.01em',
      margin: '0 0 10px',
      color: 'var(--brand-navy)'
    }
  }, "Your review page is live"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 14.5px/1.55 var(--font-sans)',
      color: 'var(--fg-2)',
      margin: '0 0 16px'
    }
  }, "We've built a beautiful review page, generated your QR sticker and made you a profile card. Take a look \u2192"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      background: 'var(--bg-alt)',
      borderRadius: 10,
      font: '500 12px/1 var(--font-mono)',
      color: 'var(--fg-2)',
      marginBottom: 14,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, "localshouts.in/r/", (biz.name || 'your-business').toLowerCase().replace(/\s+/g, '-')), /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "../ui_kits/admin/index.html",
    className: "btn btn-primary"
  }, "Open dashboard ", I.arrow), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: () => {
      const v = ['review', 'qr', 'card'];
      setView(v[(v.indexOf(view) + 1) % 3]);
    }
  }, "Cycle preview"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "phone",
    style: {
      width: 240
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "phone-screen"
  }, view === 'review' && /*#__PURE__*/React.createElement(ReviewPagePreview, biz), view === 'qr' && /*#__PURE__*/React.createElement(QRPreview, biz), view === 'card' && /*#__PURE__*/React.createElement(CardPreview, biz)))))))), /*#__PURE__*/React.createElement("style", null, `@media (max-width: 600px){ .launch-grid { grid-template-columns: 1fr !important; } }`));
};

// ─────────────────────────  ROOT APP  ─────────────────────────
const App = () => {
  const [biz, setBiz] = useState({
    name: 'Mastani Cafe',
    category: 'Cafe',
    keywords: ['friendly staff', 'great coffee', 'cosy ambience'],
    logoUrl: null
  });
  const [view, setView] = useState('review');
  const [modal, setModal] = useState(null);
  // listen for in-page CTAs that want to open signup
  useEffect(() => {
    const open = () => setModal('signup');
    document.addEventListener('open-signup', open);
    return () => document.removeEventListener('open-signup', open);
  }, []);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Topbar, {
    onOpenSignup: () => setModal('signup'),
    onOpenLogin: () => setModal('signin')
  }), /*#__PURE__*/React.createElement(Hero, {
    biz: biz,
    setBiz: setBiz,
    view: view,
    setView: setView,
    onOpenSignup: () => setModal('signup')
  }), /*#__PURE__*/React.createElement(InteractiveSetup, {
    biz: biz,
    setBiz: setBiz,
    view: view,
    setView: setView,
    onOpenSignup: () => setModal('signup')
  }), /*#__PURE__*/React.createElement(Generator, null), /*#__PURE__*/React.createElement(Steps, null), /*#__PURE__*/React.createElement(CtaBand, {
    onOpenSignup: () => setModal('signup')
  }), /*#__PURE__*/React.createElement("footer", {
    style: {
      padding: '30px 20px',
      textAlign: 'center',
      color: 'var(--fg-3)',
      font: '500 13px/1.5 var(--font-sans)',
      borderTop: '1px solid var(--line)'
    }
  }, "\xA9 2026 LocalShouts \xB7 ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: 'var(--fg-3)',
      textDecoration: 'none'
    }
  }, "Privacy"), " \xB7 ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: 'var(--fg-3)',
      textDecoration: 'none'
    }
  }, "Terms")), modal && /*#__PURE__*/React.createElement(SignupModal, {
    mode: modal,
    prefill: biz,
    onClose: () => setModal(null)
  }));
};
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "public/App.jsx", error: String((e && e.message) || e) }); }

// public/Preview.jsx
try { (() => {
/* Live previews shown in the hero & during onboarding.
   Three views: review page, QR sticker, business card */

const swatch = name => {
  // deterministic gradient from name
  const seed = (name || 'L').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const palettes = [['#7c3aed', '#a78bfa'], ['#ec4899', '#f472b6'], ['#0ea5e9', '#22d3ee'], ['#16a34a', '#4ade80'], ['#f97316', '#fb923c'], ['#1e1b4b', '#7c3aed']];
  return palettes[seed % palettes.length];
};
const initials = s => (s || '').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'LS';
window.LogoMark = ({
  name,
  logoUrl,
  size = 72,
  radius = 18
}) => {
  const [c1, c2] = swatch(name);
  return logoUrl ? /*#__PURE__*/React.createElement("img", {
    src: logoUrl,
    alt: "",
    style: {
      width: size,
      height: size,
      borderRadius: radius,
      objectFit: 'cover'
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: radius,
      background: `linear-gradient(135deg, ${c1}, ${c2})`,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: `800 ${Math.round(size * 0.36)}px/1 var(--font-sans)`,
      letterSpacing: '-.02em',
      boxShadow: '0 8px 24px -8px rgba(30,27,75,.35)'
    }
  }, initials(name));
};
window.ReviewPagePreview = ({
  name = 'Your Business',
  category = 'Cafe',
  logoUrl,
  keywords = []
}) => {
  const kws = keywords.length ? keywords : ['friendly staff', 'cozy ambience', 'great coffee'];
  const [c1, c2] = swatch(name);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#faf8ff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(160deg, ${c1} 0%, ${c2} 100%)`,
      padding: '28px 18px 56px',
      textAlign: 'center',
      color: '#fff',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    name: name,
    logoUrl: logoUrl,
    size: 56,
    radius: 14
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '800 17px/1.2 var(--font-sans)',
      letterSpacing: '-.01em'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 11px/1.2 var(--font-sans)',
      opacity: .85,
      marginTop: 4
    }
  }, category)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 14px',
      marginTop: -32,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 16,
      padding: 14,
      boxShadow: '0 8px 24px -10px rgba(30,27,75,.18)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11px/1 var(--font-sans)',
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      color: '#7c3aed'
    }
  }, "How was your visit?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      margin: '10px 0 12px',
      justifyContent: 'center'
    }
  }, [1, 2, 3, 4, 5].map(i => /*#__PURE__*/React.createElement("svg", {
    key: i,
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "#f59e0b"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2l2.6 6.4 6.9.6-5.2 4.6 1.6 6.7L12 16.9 5.9 20.3l1.6-6.7L2.5 9l6.9-.6L12 2z"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px/1.4 var(--font-sans)',
      color: '#3f3a5e',
      textAlign: 'center'
    }
  }, "Tap to share your experience \u2014 AI helps you write a great review in seconds.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 10px/1 var(--font-sans)',
      letterSpacing: '.05em',
      textTransform: 'uppercase',
      color: '#6b6880',
      marginBottom: 8
    }
  }, "Mention what you loved"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 5
    }
  }, kws.slice(0, 6).map((k, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      padding: '5px 9px',
      background: '#ede9fe',
      color: '#5b21b6',
      borderRadius: 999,
      font: '600 10.5px/1 var(--font-sans)'
    }
  }, k)))), /*#__PURE__*/React.createElement("button", {
    style: {
      marginTop: 18,
      width: '100%',
      padding: '12px',
      background: `linear-gradient(135deg, ${c1}, ${c2})`,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      font: '700 13px/1 var(--font-sans)',
      boxShadow: '0 6px 16px -4px rgba(124,58,237,.4)'
    }
  }, "\u2728 Write my review with AI")));
};
window.QRPreview = ({
  name = 'Your Business',
  logoUrl
}) => {
  const [c1, c2] = swatch(name);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      background: `linear-gradient(180deg, ${c1}10, ${c2}20)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 240,
      background: '#fff',
      borderRadius: 18,
      padding: 18,
      textAlign: 'center',
      boxShadow: '0 12px 30px -10px rgba(30,27,75,.18)',
      border: `2px solid ${c1}30`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 24px/1 var(--font-script)',
      color: c1,
      marginBottom: 4,
      letterSpacing: '.01em'
    }
  }, "Review Us On"), /*#__PURE__*/React.createElement("img", {
    src: "../assets/google_g.png",
    alt: "Google",
    style: {
      height: 22,
      marginBottom: 10
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 140,
      height: 140,
      margin: '0 auto',
      borderRadius: 10,
      padding: 8,
      background: `linear-gradient(135deg, ${c1}, ${c2})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      background: '#fff',
      borderRadius: 6,
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 21 21",
    width: "100%",
    height: "100%",
    style: {
      display: 'block'
    }
  }, [...Array(21)].map((_, r) => [...Array(21)].map((_, c) => {
    const s = (r * 31 + c * 17 + name.length) % 5;
    return s < 2 ? /*#__PURE__*/React.createElement("rect", {
      key: `${r}-${c}`,
      x: c,
      y: r,
      width: 1,
      height: 1,
      fill: "#1e1b4b"
    }) : null;
  })), [[0, 0], [14, 0], [0, 14]].map(([x, y], i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("rect", {
    x: x,
    y: y,
    width: 7,
    height: 7,
    fill: "#1e1b4b"
  }), /*#__PURE__*/React.createElement("rect", {
    x: x + 1,
    y: y + 1,
    width: 5,
    height: 5,
    fill: "#fff"
  }), /*#__PURE__*/React.createElement("rect", {
    x: x + 2,
    y: y + 2,
    width: 3,
    height: 3,
    fill: "#1e1b4b"
  })))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      font: '700 13px/1.2 var(--font-sans)',
      color: '#1e1b4b'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 10px/1.2 var(--font-sans)',
      color: '#6b6880',
      marginTop: 3
    }
  }, "Scan to leave a review")));
};
window.CardPreview = ({
  name = 'Your Business',
  category = 'Cafe',
  logoUrl
}) => {
  const [c1, c2] = swatch(name);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      background: '#fbfaf7'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 240,
      aspectRatio: '1.6/1',
      background: '#fff',
      borderRadius: 14,
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 12px 30px -10px rgba(30,27,75,.18)',
      border: '1px solid #ececec'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -30,
      right: -30,
      width: 120,
      height: 120,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${c1}, ${c2})`,
      opacity: .18
    }
  }), /*#__PURE__*/React.createElement(LogoMark, {
    name: name,
    logoUrl: logoUrl,
    size: 36,
    radius: 10
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      font: '800 16px/1.1 var(--font-sans)',
      color: '#1e1b4b',
      letterSpacing: '-.01em'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 11px/1 var(--font-sans)',
      color: '#6b6880',
      marginTop: 4
    }
  }, category), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 14,
      left: 16,
      right: 16,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 9px/1 var(--font-sans)',
      color: '#9b97ad',
      textTransform: 'uppercase',
      letterSpacing: '.08em',
      marginBottom: 3
    }
  }, "Powered by"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 11px/1 var(--font-sans)',
      color: c1
    }
  }, "LocalShouts AI")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 18px/1 var(--font-script)',
      color: c1
    }
  }, "Review Us"))));
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "public/Preview.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/Atoms.jsx
try { (() => {
// StatCard, Pill, Toggle, MiniBars, MiniArea — small reusable atoms.

window.StatCard = ({
  icon,
  tint = 'purple',
  label,
  value,
  delta,
  deltaType = 'neutral'
}) => /*#__PURE__*/React.createElement("div", {
  className: "stat"
}, /*#__PURE__*/React.createElement("span", {
  className: 'stat-icon ' + tint
}, /*#__PURE__*/React.createElement(Icon, {
  name: icon,
  size: 18
})), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  className: "stat-label"
}, label), /*#__PURE__*/React.createElement("div", {
  className: "stat-value"
}, value)), delta && /*#__PURE__*/React.createElement("span", {
  className: 'stat-delta ' + deltaType
}, deltaType === 'up' && /*#__PURE__*/React.createElement(Icon, {
  name: "arrow-up",
  size: 11,
  strokeWidth: 2.4
}), deltaType === 'dn' && /*#__PURE__*/React.createElement(Icon, {
  name: "arrow-down",
  size: 11,
  strokeWidth: 2.4
}), delta));
window.Pill = ({
  kind = 'neutral',
  dot,
  children
}) => /*#__PURE__*/React.createElement("span", {
  className: 'pill ' + kind
}, dot && /*#__PURE__*/React.createElement("span", {
  className: "dot"
}), children);
window.Toggle = ({
  on,
  onChange
}) => /*#__PURE__*/React.createElement("span", {
  className: 'toggle-switch ' + (on ? 'on' : ''),
  onClick: () => onChange && onChange(!on),
  role: "switch",
  "aria-checked": on
});

// Tiny inline charts (no chart lib). Pure SVG for crispness.
window.MiniArea = ({
  data = [12, 18, 15, 24, 22, 30, 28, 36, 34, 42, 38, 50],
  height = 80,
  color = 'var(--brand-purple)'
}) => {
  const w = 320,
    h = height,
    max = Math.max(...data);
  const step = w / (data.length - 1);
  const pts = data.map((d, i) => `${i * step},${h - d / max * (h - 8) - 4}`).join(' ');
  const fill = `M0,${h} L${pts.split(' ').join(' L')} L${w},${h} Z`;
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${w} ${h}`,
    preserveAspectRatio: "none",
    style: {
      width: '100%',
      height,
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "ma-grad",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: color,
    stopOpacity: "0.18"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: color,
    stopOpacity: "0"
  }))), /*#__PURE__*/React.createElement("path", {
    d: fill,
    fill: "url(#ma-grad)"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: pts,
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
};
window.MiniBars = ({
  data = [4, 7, 5, 9, 6, 11, 8, 12, 10, 14, 13, 16],
  height = 80,
  color = 'var(--brand-purple)'
}) => {
  const w = 320,
    h = height,
    max = Math.max(...data);
  const bw = w / data.length - 4;
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${w} ${h}`,
    preserveAspectRatio: "none",
    style: {
      width: '100%',
      height,
      display: 'block'
    }
  }, data.map((d, i) => {
    const bh = d / max * (h - 6);
    return /*#__PURE__*/React.createElement("rect", {
      key: i,
      x: i * (w / data.length) + 2,
      y: h - bh,
      width: bw,
      height: bh,
      rx: 2,
      fill: color,
      opacity: 0.85
    });
  }));
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/Atoms.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/Icons.jsx
try { (() => {
// Lucide-style icon set used across the admin UI kit. Stroke only; currentColor fill.
window.Icon = ({
  name,
  size = 16,
  strokeWidth = 2,
  ...rest
}) => {
  const sw = strokeWidth;
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: sw,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...rest
  };
  const paths = {
    'layout-grid': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "3",
      width: "7",
      height: "7"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "14",
      y: "3",
      width: "7",
      height: "7"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "14",
      y: "14",
      width: "7",
      height: "7"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "14",
      width: "7",
      height: "7"
    })),
    'store': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M3 9l1-5h16l1 5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9 21v-6h6v6"
    })),
    'sparkles': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8L12 2z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19 17l.7 2.1L22 20l-2.3.9L19 23l-.7-2.1L16 20l2.3-.9L19 17z"
    })),
    'qr': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "3",
      width: "7",
      height: "7"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "14",
      y: "3",
      width: "7",
      height: "7"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "14",
      width: "7",
      height: "7"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "14",
      y1: "14",
      x2: "14",
      y2: "21"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "14",
      y1: "14",
      x2: "21",
      y2: "14"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "17",
      y1: "17",
      x2: "21",
      y2: "17"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "17",
      y1: "17",
      x2: "17",
      y2: "21"
    })),
    'wallet': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "1",
      x2: "12",
      y2: "23"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
    })),
    'users': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "9",
      cy: "7",
      r: "4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M23 21v-2a4 4 0 0 0-3-3.87"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M16 3.13a4 4 0 0 1 0 7.75"
    })),
    'card': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "2",
      y: "5",
      width: "20",
      height: "14",
      rx: "2"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "2",
      y1: "10",
      x2: "22",
      y2: "10"
    })),
    'plus': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "5",
      x2: "12",
      y2: "19"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "5",
      y1: "12",
      x2: "19",
      y2: "12"
    })),
    'search': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "8"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "21",
      y1: "21",
      x2: "16.65",
      y2: "16.65"
    })),
    'edit': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
    })),
    'trash': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
      points: "3 6 5 6 21 6"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
    })),
    'copy': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "9",
      y: "9",
      width: "13",
      height: "13",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
    })),
    'download': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "7 10 12 15 17 10"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "15",
      x2: "12",
      y2: "3"
    })),
    'refresh': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
      points: "23 4 23 10 17 10"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "1 20 1 14 7 14"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
    })),
    'menu': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: "3",
      y1: "6",
      x2: "21",
      y2: "6"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "3",
      y1: "12",
      x2: "21",
      y2: "12"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "3",
      y1: "18",
      x2: "21",
      y2: "18"
    })),
    'x': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: "18",
      y1: "6",
      x2: "6",
      y2: "18"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "6",
      y1: "6",
      x2: "18",
      y2: "18"
    })),
    'check': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
      points: "20 6 9 17 4 12"
    })),
    'arrow-right': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: "5",
      y1: "12",
      x2: "19",
      y2: "12"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "12 5 19 12 12 19"
    })),
    'arrow-up': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "19",
      x2: "12",
      y2: "5"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "5 12 12 5 19 12"
    })),
    'arrow-down': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "5",
      x2: "12",
      y2: "19"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "19 12 12 19 5 12"
    })),
    'clock': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "10"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "12 6 12 12 16 14"
    })),
    'alert-triangle': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "9",
      x2: "12",
      y2: "13"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "17",
      x2: "12.01",
      y2: "17"
    })),
    'gift': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
      points: "20 12 20 22 4 22 4 12"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "2",
      y: "7",
      width: "20",
      height: "5"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "22",
      x2: "12",
      y2: "7"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"
    })),
    'building': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M3 9l1-5h16l1 5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"
    })),
    'star': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polygon", {
      points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
    })),
    'settings': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
    })),
    'log-out': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "16 17 21 12 16 7"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "21",
      y1: "12",
      x2: "9",
      y2: "12"
    })),
    'eye': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "3"
    })),
    'send': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: "22",
      y1: "2",
      x2: "11",
      y2: "13"
    }), /*#__PURE__*/React.createElement("polygon", {
      points: "22 2 15 22 11 13 2 9 22 2"
    })),
    'pen': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M12 19l7-7 3 3-7 7-3-3z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M2 2l7.586 7.586"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "2"
    })),
    'circle-dot': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "10"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "3"
    }))
  };
  return /*#__PURE__*/React.createElement("svg", props, paths[name] || null);
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/Icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/Screens.jsx
try { (() => {
// Screens.jsx — five core admin screens (Dashboard, Businesses, AI Reviews, QR, Plans/Payments)
// Plus modals + new-business wizard. Kept loose & display-focused; not production code.

const SAMPLE_BIZ = [{
  id: 1,
  name: 'Apple Cafe',
  sub: 'Apple',
  category: 'Cafe',
  city: 'Nashik',
  expiry: '3 Nov 2026',
  expiryDays: 180,
  left: 100,
  total: 100,
  status: 'ok',
  ai: true,
  ambassador: true,
  active: true
}, {
  id: 2,
  name: 'Bagga',
  sub: 'Ice Cream',
  category: 'Cafe',
  city: 'Nashik',
  expiry: '3 Nov 2026',
  expiryDays: 180,
  left: 99,
  total: 100,
  status: 'ok',
  ai: true,
  ambassador: true,
  active: true
}, {
  id: 3,
  name: 'PromptTest Marketing',
  sub: 'results',
  category: 'Digital Marketing',
  city: 'Pune',
  expiry: '7 May 2027',
  expiryDays: 365,
  left: 34,
  total: 100,
  status: 'ok',
  ai: true,
  ambassador: true,
  active: true
}, {
  id: 4,
  name: 'LocalShouts',
  sub: 'Localshouts',
  category: 'Digital Marketing',
  city: 'India',
  expiry: '1 Nov 2026',
  expiryDays: 178,
  left: 100,
  total: 100,
  status: 'ok',
  ai: true,
  ambassador: true,
  active: true
}, {
  id: 5,
  name: 'Tone Test Salon',
  sub: 'clean',
  category: 'Salon',
  city: 'Pune',
  expiry: '5 May 2027',
  expiryDays: 363,
  left: 60,
  total: 100,
  status: 'ok',
  ai: true,
  ambassador: true,
  active: true
}, {
  id: 6,
  name: 'Glow Skin Clinic',
  sub: 'flagship',
  category: 'Health / Wellness',
  city: 'Mumbai',
  expiry: '16 May 2026',
  expiryDays: 9,
  left: 28,
  total: 250,
  status: 'warn',
  ai: true,
  ambassador: false,
  active: true
}, {
  id: 7,
  name: 'Kalyan Tax Advisors',
  sub: 'tax',
  category: 'Professional Services',
  city: 'Chennai',
  expiry: '30 Apr 2026',
  expiryDays: -7,
  left: 0,
  total: 100,
  status: 'dgr',
  ai: false,
  ambassador: false,
  active: false
}];
const PLANS = [{
  name: 'Starter',
  price: 999,
  reviews: 100,
  days: 180,
  popular: false
}, {
  name: 'Pro',
  price: 2000,
  reviews: 250,
  days: 365,
  popular: true
}, {
  name: 'Enterprise',
  price: 4500,
  reviews: 600,
  days: 365,
  popular: false
}];

// ─────────────────────────────────────────────  DASHBOARD
window.DashboardScreen = ({
  openWizard
}) => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
  className: "page-header"
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Dashboard"), /*#__PURE__*/React.createElement("div", {
  style: {
    font: '400 14px/1.4 var(--font-sans)',
    color: 'var(--fg-3)',
    marginTop: 4
  }
}, "Good morning, Aarav. Here's what's moving today.")), /*#__PURE__*/React.createElement("div", {
  className: "actions"
}, /*#__PURE__*/React.createElement("button", {
  className: "btn btn-outline btn-sm desktop-only"
}, /*#__PURE__*/React.createElement(Icon, {
  name: "download"
}), " Export"), /*#__PURE__*/React.createElement("button", {
  className: "btn btn-primary",
  onClick: openWizard
}, /*#__PURE__*/React.createElement(Icon, {
  name: "plus"
}), " Add business"))), /*#__PURE__*/React.createElement("div", {
  className: "stat-grid"
}, /*#__PURE__*/React.createElement(StatCard, {
  icon: "wallet",
  tint: "green",
  label: "Revenue (30d)",
  value: "\u20B94,82,500",
  delta: "\u2191 12.4%",
  deltaType: "up"
}), /*#__PURE__*/React.createElement(StatCard, {
  icon: "store",
  tint: "purple",
  label: "Active businesses",
  value: "147",
  delta: "\u2191 8 this week",
  deltaType: "up"
}), /*#__PURE__*/React.createElement(StatCard, {
  icon: "clock",
  tint: "amber",
  label: "Expiring (7d)",
  value: "12",
  delta: "needs attention",
  deltaType: "neutral"
}), /*#__PURE__*/React.createElement(StatCard, {
  icon: "sparkles",
  tint: "blue",
  label: "AI reviews used",
  value: "8,412",
  delta: "\u2191 22.0%",
  deltaType: "up"
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: 16,
    marginBottom: 16
  },
  className: "dash-row"
}, /*#__PURE__*/React.createElement("div", {
  className: "card"
}, /*#__PURE__*/React.createElement("div", {
  className: "card-head"
}, /*#__PURE__*/React.createElement("h3", {
  className: "card-title"
}, "Revenue"), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 6
  }
}, ['7d', '30d', '90d'].map((p, i) => /*#__PURE__*/React.createElement("button", {
  key: p,
  className: "btn btn-sm",
  style: {
    background: i === 1 ? 'var(--brand-purple-100)' : 'transparent',
    color: i === 1 ? 'var(--brand-purple-700)' : 'var(--fg-3)',
    border: 0,
    fontWeight: 600
  }
}, p)))), /*#__PURE__*/React.createElement(MiniArea, {
  height: 180,
  data: [120, 180, 160, 210, 240, 200, 260, 290, 280, 340, 380, 360, 420, 460, 440, 500, 540, 520, 580]
})), /*#__PURE__*/React.createElement("div", {
  className: "card"
}, /*#__PURE__*/React.createElement("div", {
  className: "card-head"
}, /*#__PURE__*/React.createElement("h3", {
  className: "card-title"
}, "New businesses")), /*#__PURE__*/React.createElement(MiniBars, {
  height: 180,
  data: [2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9],
  color: "var(--brand-purple)"
}), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 8,
    font: '500 11px/1 var(--font-mono)',
    color: 'var(--fg-4)'
  }
}, /*#__PURE__*/React.createElement("span", null, "Jan"), /*#__PURE__*/React.createElement("span", null, "Apr"), /*#__PURE__*/React.createElement("span", null, "Jul"), /*#__PURE__*/React.createElement("span", null, "Oct"), /*#__PURE__*/React.createElement("span", null, "Dec")))), /*#__PURE__*/React.createElement("div", {
  className: "card"
}, /*#__PURE__*/React.createElement("div", {
  className: "card-head"
}, /*#__PURE__*/React.createElement("h3", {
  className: "card-title"
}, "Needs attention"), /*#__PURE__*/React.createElement("a", {
  className: "btn btn-ghost btn-sm"
}, "View all ", /*#__PURE__*/React.createElement(Icon, {
  name: "arrow-right"
}))), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'grid',
    gap: 10
  }
}, SAMPLE_BIZ.filter(b => b.status !== 'ok').map(b => /*#__PURE__*/React.createElement("div", {
  key: b.id,
  style: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    background: 'var(--surface-2)',
    borderRadius: 10
  }
}, /*#__PURE__*/React.createElement("span", {
  className: 'stat-icon ' + (b.status === 'warn' ? 'amber' : 'red'),
  style: {
    width: 32,
    height: 32
  }
}, /*#__PURE__*/React.createElement(Icon, {
  name: b.status === 'warn' ? 'clock' : 'alert-triangle',
  size: 16
})), /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1,
    minWidth: 0
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    font: '600 14px/1.2 var(--font-sans)',
    color: 'var(--fg)'
  }
}, b.name), /*#__PURE__*/React.createElement("div", {
  style: {
    font: '400 12px/1.4 var(--font-sans)',
    color: 'var(--fg-3)'
  }
}, b.expiryDays < 0 ? `Expired ${Math.abs(b.expiryDays)}d ago` : `Expires in ${b.expiryDays} days`, " \xB7 ", b.left, " reviews left \xB7 ", b.payment === 'overdue' ? 'Payment overdue' : 'Pending payment')), /*#__PURE__*/React.createElement("button", {
  className: "btn btn-outline btn-sm"
}, "Renew"))))));

// ─────────────────────────────────────────────  BUSINESSES
// Operational dashboard — every required control preserved:
// name+sub, category, ambassador badge, AI badge, area, expiry, status,
// reviews-left, QR preview/copy/download, active toggle, refresh, edit, delete,
// search, filters (category, status, ambassador), Add CTA + optimistic-create row.
window.BusinessesScreen = ({
  openWizard,
  openBiz,
  justAddedBiz,
  clearJustAdded
}) => {
  const [q, setQ] = React.useState('');
  const [cat, setCat] = React.useState('all');
  const [statusF, setStatusF] = React.useState('all');
  const [ambF, setAmbF] = React.useState('all');
  const [items, setItems] = React.useState(SAMPLE_BIZ);
  const [pendingId, setPendingId] = React.useState(null);
  const [pendingPhase, setPendingPhase] = React.useState('Creating');

  // Optimistic add: when wizard reports a new biz, prepend with loading flag,
  // run a mock background job through 3 phases, then settle.
  React.useEffect(() => {
    if (!justAddedBiz) return;
    const id = Date.now();
    const stub = {
      id,
      name: justAddedBiz.name || 'New Business',
      sub: justAddedBiz.sub || '',
      category: justAddedBiz.category || 'Cafe',
      city: justAddedBiz.city || 'Nashik',
      expiry: justAddedBiz.expiry || '—',
      expiryDays: 365,
      left: justAddedBiz.total || 100,
      total: justAddedBiz.total || 100,
      status: 'ok',
      ai: true,
      ambassador: !!justAddedBiz.ambassador,
      active: true,
      _new: true
    };
    setItems(prev => [stub, ...prev]);
    setPendingId(id);
    clearJustAdded && clearJustAdded();
    const t1 = setTimeout(() => setPendingPhase('Generating QR'), 900);
    const t2 = setTimeout(() => setPendingPhase('Activating'), 1900);
    const t3 = setTimeout(() => {
      setPendingId(null);
      setPendingPhase('Creating');
    }, 2900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [justAddedBiz]);
  const cats = ['all', ...Array.from(new Set(SAMPLE_BIZ.map(b => b.category)))];
  const list = items.filter(b => {
    if (cat !== 'all' && b.category !== cat) return false;
    if (statusF === 'active' && b.status !== 'ok') return false;
    if (statusF === 'expiring' && b.status !== 'warn') return false;
    if (statusF === 'expired' && b.status !== 'dgr') return false;
    if (ambF === 'yes' && !b.ambassador) return false;
    if (ambF === 'no' && b.ambassador) return false;
    if (q && !b.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-header"
  }, /*#__PURE__*/React.createElement("h1", null, "Businesses ", /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 14px/1 var(--font-sans)',
      color: 'var(--fg-4)',
      marginLeft: 8,
      verticalAlign: 'middle'
    }
  }, items.length)), /*#__PURE__*/React.createElement("div", {
    className: "actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline desktop-only"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 14
  }), " Export"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: openWizard
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), " Add business"))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 12,
      marginBottom: 14,
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "search-box",
    style: {
      flex: '1 1 260px',
      maxWidth: 380,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search"
  }), /*#__PURE__*/React.createElement("input", {
    placeholder: "Search businesses\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Sel, {
    value: cat,
    onChange: setCat,
    label: "Category",
    opts: cats.map(c => [c, c === 'all' ? 'All categories' : c])
  }), /*#__PURE__*/React.createElement(Sel, {
    value: statusF,
    onChange: setStatusF,
    label: "Status",
    opts: [['all', 'All status'], ['active', 'Active'], ['expiring', 'Expiring'], ['expired', 'Expired']]
  }), /*#__PURE__*/React.createElement(Sel, {
    value: ambF,
    onChange: setAmbF,
    label: "Ambassador",
    opts: [['all', 'All'], ['yes', 'Ambassador'], ['no', 'Paid']]
  }))), /*#__PURE__*/React.createElement("div", {
    className: "table-card desktop-only"
  }, /*#__PURE__*/React.createElement("table", {
    className: "data-table biz-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: {
      width: '26%'
    }
  }, "Business"), /*#__PURE__*/React.createElement("th", null, "Category"), /*#__PURE__*/React.createElement("th", null, "Area"), /*#__PURE__*/React.createElement("th", null, "Expiry"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "Reviews left"), /*#__PURE__*/React.createElement("th", null, "QR / Link"), /*#__PURE__*/React.createElement("th", null, "Active"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", null, list.map(b => {
    const isPending = b.id === pendingId;
    return /*#__PURE__*/React.createElement("tr", {
      key: b.id,
      onClick: () => !isPending && openBiz && openBiz(b),
      style: {
        cursor: isPending ? 'wait' : 'pointer',
        position: 'relative',
        background: b._new ? 'linear-gradient(90deg,var(--brand-purple-50),transparent 60%)' : undefined
      }
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: 10,
        background: 'var(--brand-purple-100)',
        color: 'var(--brand-purple-700)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: '700 13px/1 var(--font-sans)'
      }
    }, b.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("strong", null, b.name), isPending && /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 999,
        background: 'var(--brand-purple-100)',
        color: 'var(--brand-purple-700)',
        font: '600 10px/1 var(--font-sans)',
        letterSpacing: '.04em',
        textTransform: 'uppercase'
      }
    }, /*#__PURE__*/React.createElement(Spinner, {
      size: 9
    }), pendingPhase)), b.sub && /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 12px/1.3 var(--font-sans)',
        color: 'var(--fg-3)',
        marginTop: 2
      }
    }, b.sub), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        marginTop: 6,
        flexWrap: 'wrap'
      }
    }, b.ambassador && /*#__PURE__*/React.createElement(Pill, {
      kind: "info"
    }, /*#__PURE__*/React.createElement("span", {
      className: "dot",
      style: {
        background: 'var(--info)'
      }
    }), "Ambassador"), b.ai && /*#__PURE__*/React.createElement(Pill, {
      kind: "ok"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "sparkles",
      size: 10
    }), "AI"))))), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Pill, {
      kind: "brand"
    }, b.category)), /*#__PURE__*/React.createElement("td", null, b.city), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", null, b.expiry), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 11px/1.3 var(--font-sans)',
        color: b.expiryDays < 0 ? 'var(--danger)' : b.expiryDays < 14 ? 'var(--warning)' : 'var(--fg-4)'
      }
    }, b.expiryDays < 0 ? `${Math.abs(b.expiryDays)}d ago` : `in ${b.expiryDays}d`)), /*#__PURE__*/React.createElement("td", null, b.status === 'ok' && /*#__PURE__*/React.createElement(Pill, {
      kind: "ok",
      dot: true
    }, "Active"), b.status === 'warn' && /*#__PURE__*/React.createElement(Pill, {
      kind: "warn",
      dot: true
    }, "Expiring"), b.status === 'dgr' && /*#__PURE__*/React.createElement(Pill, {
      kind: "dgr",
      dot: true
    }, "Expired")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 48,
        height: 6,
        background: 'var(--bg-alt)',
        borderRadius: 999,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: `${b.left / b.total * 100}%`,
        height: '100%',
        background: b.left / b.total > .3 ? 'var(--success)' : b.left / b.total > .1 ? 'var(--warning)' : 'var(--danger)',
        borderRadius: 999,
        transition: 'width 400ms'
      }
    })), /*#__PURE__*/React.createElement("strong", {
      style: {
        fontVariantNumeric: 'tabular-nums',
        font: '600 13px/1 var(--font-sans)'
      }
    }, b.left, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--fg-4)',
        fontWeight: 400
      }
    }, "/", b.total)))), /*#__PURE__*/React.createElement("td", {
      onClick: e => e.stopPropagation()
    }, isPending ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--fg-4)',
        font: '500 12px/1 var(--font-sans)'
      }
    }, /*#__PURE__*/React.createElement(Spinner, {
      size: 11
    }), "Pending") : /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("a", {
      className: "btn btn-ghost btn-sm",
      style: {
        padding: '2px 0',
        height: 'auto'
      }
    }, "Preview ", /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-up",
      size: 10,
      style: {
        transform: 'rotate(45deg)'
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Copy link",
      style: {
        width: 28,
        height: 28
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "copy",
      size: 13
    })), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Download QR",
      style: {
        width: 28,
        height: 28
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "download",
      size: 13
    }))))), /*#__PURE__*/React.createElement("td", {
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement(Toggle, {
      on: b.active,
      onChange: v => setItems(it => it.map(x => x.id === b.id ? {
        ...x,
        active: v
      } : x))
    })), /*#__PURE__*/React.createElement("td", {
      onClick: e => e.stopPropagation(),
      style: {
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'inline-flex',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Regenerate",
      style: {
        width: 30,
        height: 30
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "refresh",
      size: 13
    })), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Edit",
      style: {
        width: 30,
        height: 30
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "edit",
      size: 13
    })), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn danger",
      title: "Delete",
      style: {
        width: 30,
        height: 30
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "trash",
      size: 13
    })))));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "mobile-only",
    style: {
      display: 'grid',
      gap: 12
    }
  }, list.map(b => {
    const isPending = b.id === pendingId;
    return /*#__PURE__*/React.createElement("div", {
      key: b.id,
      className: "card",
      onClick: () => !isPending && openBiz && openBiz(b),
      style: {
        padding: 16,
        gap: 12,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        borderColor: b._new ? 'var(--brand-purple-200)' : 'var(--line)'
      }
    }, isPending && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: 'var(--brand-purple-100)',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        width: '40%',
        background: 'var(--brand-purple)',
        animation: 'biz-pending 1.4s linear infinite'
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flexShrink: 0,
        width: 38,
        height: 38,
        borderRadius: 10,
        background: 'var(--brand-purple-100)',
        color: 'var(--brand-purple-700)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: '700 13px/1 var(--font-sans)'
      }
    }, b.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("strong", {
      style: {
        font: '700 16px/1.2 var(--font-sans)'
      }
    }, b.name), isPending && /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 999,
        background: 'var(--brand-purple-100)',
        color: 'var(--brand-purple-700)',
        font: '600 10px/1 var(--font-sans)',
        letterSpacing: '.04em',
        textTransform: 'uppercase'
      }
    }, /*#__PURE__*/React.createElement(Spinner, {
      size: 9
    }), pendingPhase)), b.sub && /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 12px/1.2 var(--font-sans)',
        color: 'var(--fg-3)',
        marginTop: 2
      }
    }, b.sub))), /*#__PURE__*/React.createElement(Toggle, {
      on: b.active,
      onChange: v => setItems(it => it.map(x => x.id === b.id ? {
        ...x,
        active: v
      } : x))
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      kind: "brand"
    }, b.category), b.status === 'ok' && /*#__PURE__*/React.createElement(Pill, {
      kind: "ok",
      dot: true
    }, "Active"), b.status === 'warn' && /*#__PURE__*/React.createElement(Pill, {
      kind: "warn",
      dot: true
    }, "Expiring"), b.status === 'dgr' && /*#__PURE__*/React.createElement(Pill, {
      kind: "dgr",
      dot: true
    }, "Expired"), b.ambassador && /*#__PURE__*/React.createElement(Pill, {
      kind: "info"
    }, /*#__PURE__*/React.createElement("span", {
      className: "dot",
      style: {
        background: 'var(--info)'
      }
    }), "Ambassador"), b.ai && /*#__PURE__*/React.createElement(Pill, {
      kind: "ok"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "sparkles",
      size: 10
    }), "AI")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 8,
        padding: 12,
        background: 'var(--surface-2)',
        borderRadius: 10,
        font: '500 13px/1.3 var(--font-sans)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--fg-3)'
      }
    }, "Area"), /*#__PURE__*/React.createElement("strong", null, b.city)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--fg-3)'
      }
    }, "Expiry"), /*#__PURE__*/React.createElement("strong", null, b.expiry, " ", /*#__PURE__*/React.createElement("span", {
      style: {
        font: '400 11px/1 var(--font-sans)',
        color: b.expiryDays < 0 ? 'var(--danger)' : b.expiryDays < 14 ? 'var(--warning)' : 'var(--fg-4)'
      }
    }, "\xB7 ", b.expiryDays < 0 ? `${Math.abs(b.expiryDays)}d ago` : `in ${b.expiryDays}d`))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--fg-3)'
      }
    }, "Reviews left"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 60,
        height: 6,
        background: 'var(--bg-alt)',
        borderRadius: 999,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: `${b.left / b.total * 100}%`,
        height: '100%',
        background: b.left / b.total > .3 ? 'var(--success)' : b.left / b.total > .1 ? 'var(--warning)' : 'var(--danger)',
        borderRadius: 999
      }
    })), /*#__PURE__*/React.createElement("strong", {
      style: {
        fontVariantNumeric: 'tabular-nums'
      }
    }, b.left, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--fg-4)',
        fontWeight: 400
      }
    }, "/", b.total))))), /*#__PURE__*/React.createElement("div", {
      onClick: e => e.stopPropagation(),
      style: {
        display: 'flex',
        gap: 8,
        paddingTop: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        gap: 4,
        padding: 4,
        background: 'var(--bg-alt)',
        borderRadius: 10
      }
    }, /*#__PURE__*/React.createElement("a", {
      className: "btn btn-sm",
      style: {
        flex: 1,
        justifyContent: 'center',
        background: 'var(--surface)',
        color: 'var(--brand-purple)',
        boxShadow: 'var(--shadow-xs)',
        border: 0
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "eye",
      size: 12
    }), " Preview"), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Copy link",
      style: {
        width: 32,
        height: 32,
        border: 0,
        background: 'transparent'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "copy",
      size: 14
    })), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Download QR",
      style: {
        width: 32,
        height: 32,
        border: 0,
        background: 'transparent'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "download",
      size: 14
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        padding: 4,
        background: 'var(--bg-alt)',
        borderRadius: 10
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Regenerate",
      style: {
        border: 0,
        background: 'transparent'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "refresh",
      size: 14
    })), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Edit",
      style: {
        border: 0,
        background: 'transparent'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "edit",
      size: 14
    })), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn danger",
      title: "Delete",
      style: {
        border: 0,
        background: 'transparent'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "trash",
      size: 14
    })))));
  })), /*#__PURE__*/React.createElement("style", null, `
        @keyframes biz-pending { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }
        .biz-table td { vertical-align: middle; }
        .biz-table tr:has(td .spinner) td { background: linear-gradient(90deg, var(--brand-purple-50), transparent 60%) !important; }
      `));
};
const Sel = ({
  value,
  onChange,
  label,
  opts
}) => /*#__PURE__*/React.createElement("select", {
  value: value,
  onChange: e => onChange(e.target.value),
  className: "filter-sel",
  "aria-label": label
}, opts.map(([v, l]) => /*#__PURE__*/React.createElement("option", {
  key: v,
  value: v
}, l)));
const Spinner = ({
  size = 12
}) => /*#__PURE__*/React.createElement("span", {
  className: "spinner",
  style: {
    display: 'inline-block',
    width: size,
    height: size,
    borderRadius: '50%',
    border: `${Math.max(1, size / 6)}px solid currentColor`,
    borderRightColor: 'transparent',
    animation: 'spin 700ms linear infinite',
    opacity: .8
  }
}, /*#__PURE__*/React.createElement("style", null, `@keyframes spin { to { transform: rotate(360deg); } }`));

// ─────────────────────────────────────────────  AI REVIEWS
window.AIReviewsScreen = () => {
  const samples = [{
    id: 1,
    biz: 'Sunset Cafe',
    text: 'Spent a lazy Sunday morning here — the cortado was just right and their sourdough toast had this gorgeous crust. Staff remembered our name on the second visit. Already planning to bring my parents next weekend.',
    tone: 'Casual',
    length: 'Medium',
    when: '2 min ago'
  }, {
    id: 2,
    biz: 'Sunset Cafe',
    text: 'Cosy spot with great brunch. Coffee was excellent and the avocado toast was fresh and well-plated. Friendly staff. Will definitely come back.',
    tone: 'Casual',
    length: 'Short',
    when: '4 min ago'
  }, {
    id: 3,
    biz: 'Glow Skin Clinic',
    text: 'Visited Glow Skin Clinic last week for a hydrafacial. Dr. Mehra took time to explain my skin type and recommended exactly what I needed. The results showed up within two days. Highly recommend for anyone wanting honest, science-backed skincare.',
    tone: 'Professional',
    length: 'Long',
    when: '12 min ago'
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-header"
  }, /*#__PURE__*/React.createElement("h1", null, "AI Reviews")), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "card-title"
  }, "Generate a new review")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 14
    },
    className: "form-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Business"), /*#__PURE__*/React.createElement("select", null, /*#__PURE__*/React.createElement("option", null, "Sunset Cafe"), /*#__PURE__*/React.createElement("option", null, "Glow Skin Clinic"), /*#__PURE__*/React.createElement("option", null, "Hairloom Salon"))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Tone"), /*#__PURE__*/React.createElement("select", null, /*#__PURE__*/React.createElement("option", null, "Casual"), /*#__PURE__*/React.createElement("option", null, "Professional"), /*#__PURE__*/React.createElement("option", null, "Enthusiastic"), /*#__PURE__*/React.createElement("option", null, "Reserved"))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Length"), /*#__PURE__*/React.createElement("select", null, /*#__PURE__*/React.createElement("option", null, "Short (40-60 words)"), /*#__PURE__*/React.createElement("option", null, "Medium (80-120 words)"), /*#__PURE__*/React.createElement("option", null, "Long (140-200 words)")))), /*#__PURE__*/React.createElement("div", {
    className: "field",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("label", null, "Prompt keywords ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg-4)',
      fontWeight: 400
    }
  }, "\xB7 optional")), /*#__PURE__*/React.createElement("input", {
    placeholder: "cozy, brunch, specialty coffee, sourdough"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline"
  }, "Reset"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles"
  }), " Generate 3 reviews"))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "card-title"
  }, "Recent generations"), /*#__PURE__*/React.createElement("a", {
    className: "btn btn-ghost btn-sm"
  }, "View all ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 10
    }
  }, samples.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    style: {
      padding: 14,
      border: '1px solid var(--line)',
      borderRadius: 12,
      display: 'flex',
      gap: 12,
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    kind: "brand"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 11
  }), "AI"), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '600 14px/1.2 var(--font-sans)'
    }
  }, s.biz), /*#__PURE__*/React.createElement(Pill, {
    kind: "neutral"
  }, s.tone), /*#__PURE__*/React.createElement(Pill, {
    kind: "neutral"
  }, s.length), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 12px/1 var(--font-sans)',
      color: 'var(--fg-4)',
      marginLeft: 'auto'
    }
  }, s.when)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px/1.55 var(--font-sans)',
      color: 'var(--fg-2)'
    }
  }, s.text), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "copy",
    size: 13
  }), " Copy"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "refresh",
    size: 13
  }), " Regenerate"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary btn-sm"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "send",
    size: 13
  }), " Use")))))));
};

// ─────────────────────────────────────────────  QR MANAGER (redesign)
// Premium SaaS surface: sticky action bar, status cards w/ bulk select,
// search + multi-filter, quick actions menu, batch assign/print/download.
const QR_SAMPLES = [{
  id: 'QR-0001',
  biz: 'Mastani Cafe',
  city: 'Pune',
  status: 'active',
  printed: true,
  assigned: true,
  scans: 248,
  when: '2 days ago'
}, {
  id: 'QR-0002',
  biz: 'Glow Skin',
  city: 'Mumbai',
  status: 'active',
  printed: true,
  assigned: true,
  scans: 132,
  when: '4 days ago'
}, {
  id: 'QR-0003',
  biz: 'Hairloom Salon',
  city: 'Pune',
  status: 'active',
  printed: false,
  assigned: true,
  scans: 0,
  when: 'today'
}, {
  id: 'QR-0004',
  biz: null,
  city: '—',
  status: 'unassigned',
  printed: false,
  assigned: false,
  scans: 0,
  when: '—'
}, {
  id: 'QR-0005',
  biz: null,
  city: '—',
  status: 'unassigned',
  printed: false,
  assigned: false,
  scans: 0,
  when: '—'
}, {
  id: 'QR-0006',
  biz: 'Aspire IT',
  city: 'Bangalore',
  status: 'inactive',
  printed: true,
  assigned: true,
  scans: 64,
  when: '3 weeks ago'
}, {
  id: 'QR-0007',
  biz: 'Sprout Pediatrics',
  city: 'Delhi',
  status: 'active',
  printed: true,
  assigned: true,
  scans: 412,
  when: '1 week ago'
}, {
  id: 'QR-0008',
  biz: 'Forge Coworking',
  city: 'Gurugram',
  status: 'active',
  printed: false,
  assigned: true,
  scans: 18,
  when: '1 day ago'
}];
window.QRScreen = () => {
  const [q, setQ] = React.useState('');
  const [statusF, setStatusF] = React.useState('all');
  const [printF, setPrintF] = React.useState('all');
  const [sel, setSel] = React.useState(new Set());
  const [items] = React.useState(QR_SAMPLES);
  const [openMenu, setOpenMenu] = React.useState(null);
  React.useEffect(() => {
    const close = () => setOpenMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  const list = items.filter(b => {
    if (statusF !== 'all' && b.status !== statusF) return false;
    if (printF === 'printed' && !b.printed) return false;
    if (printF === 'unprinted' && b.printed) return false;
    if (q && !((b.biz || '').toLowerCase() + b.id.toLowerCase()).includes(q.toLowerCase())) return false;
    return true;
  });
  const totals = {
    all: items.length,
    active: items.filter(i => i.status === 'active').length,
    unassigned: items.filter(i => i.status === 'unassigned').length,
    unprinted: items.filter(i => !i.printed && i.assigned).length
  };
  const toggleSel = id => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);else next.add(id);
    setSel(next);
  };
  const toggleAll = () => sel.size === list.length ? setSel(new Set()) : setSel(new Set(list.map(x => x.id)));
  const allSelected = list.length > 0 && sel.size === list.length;
  const Stat = ({
    s
  }) => s === 'active' ? /*#__PURE__*/React.createElement(Pill, {
    kind: "ok"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "Active") : s === 'inactive' ? /*#__PURE__*/React.createElement(Pill, {
    kind: "neutral"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "Inactive") : s === 'unassigned' ? /*#__PURE__*/React.createElement(Pill, {
    kind: "warn"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "Unassigned") : null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-header"
  }, /*#__PURE__*/React.createElement("h1", null, "QR Codes ", /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 14px/1 var(--font-sans)',
      color: 'var(--fg-4)',
      marginLeft: 8,
      verticalAlign: 'middle'
    }
  }, items.length)), /*#__PURE__*/React.createElement("div", {
    className: "actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline desktop-only"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), " Batch create"), /*#__PURE__*/React.createElement("a", {
    className: "btn btn-outline",
    href: "print.html"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 14
  }), " Print workspace"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), " New QR"))), /*#__PURE__*/React.createElement("div", {
    className: "stat-grid",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    icon: "qr",
    tint: "purple",
    label: "Total QR codes",
    value: totals.all
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "check",
    tint: "green",
    label: "Active",
    value: totals.active
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "alert-triangle",
    tint: "amber",
    label: "Unassigned",
    value: totals.unassigned
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "download",
    tint: "blue",
    label: "Awaiting print",
    value: totals.unprinted
  })), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 12,
      marginBottom: 14,
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "search-box",
    style: {
      flex: '1 1 260px',
      maxWidth: 360,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search"
  }), /*#__PURE__*/React.createElement("input", {
    placeholder: "Search by code or business\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Sel, {
    value: statusF,
    onChange: setStatusF,
    label: "Status",
    opts: [['all', 'All status'], ['active', 'Active'], ['inactive', 'Inactive'], ['unassigned', 'Unassigned']]
  }), /*#__PURE__*/React.createElement(Sel, {
    value: printF,
    onChange: setPrintF,
    label: "Print",
    opts: [['all', 'All'], ['printed', 'Printed'], ['unprinted', 'Not printed']]
  })), sel.size > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      flexBasis: '100%',
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      padding: '10px 12px',
      background: 'var(--brand-purple-50)',
      borderRadius: 10,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '600 13px/1 var(--font-sans)',
      color: 'var(--brand-purple-700)'
    }
  }, sel.size, " selected"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("a", {
    className: "btn btn-outline btn-sm",
    href: "print.html"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 13
  }), " Print ", sel.size), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "users",
    size: 13
  }), " Assign"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    style: {
      color: 'var(--danger)',
      borderColor: 'var(--danger-border)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash",
    size: 13
  }), " Delete"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    onClick: () => setSel(new Set())
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 13
  })))), /*#__PURE__*/React.createElement("div", {
    className: "table-card desktop-only"
  }, /*#__PURE__*/React.createElement("table", {
    className: "data-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: {
      width: 36,
      paddingRight: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: allSelected,
    onChange: toggleAll
  })), /*#__PURE__*/React.createElement("th", {
    style: {
      width: '12%'
    }
  }, "Code"), /*#__PURE__*/React.createElement("th", null, "Business"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "Printed"), /*#__PURE__*/React.createElement("th", null, "Scans"), /*#__PURE__*/React.createElement("th", null, "Last activity"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", null, list.map(b => /*#__PURE__*/React.createElement("tr", {
    key: b.id,
    style: {
      background: sel.has(b.id) ? 'var(--brand-purple-50)' : undefined
    }
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: sel.has(b.id),
    onChange: () => toggleSel(b.id)
  })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 8,
      background: '#fff',
      border: '1px solid var(--line)',
      backgroundImage: 'repeating-linear-gradient(45deg,var(--brand-navy) 0 2.5px,transparent 2.5px 5px),repeating-linear-gradient(-45deg,var(--brand-navy) 0 2.5px,transparent 2.5px 5px)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: 'var(--font-mono)',
      font: '600 12.5px/1 var(--font-mono)',
      color: 'var(--brand-purple-700)'
    }
  }, b.id))), /*#__PURE__*/React.createElement("td", null, b.biz ? /*#__PURE__*/React.createElement("strong", null, b.biz) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg-4)',
      fontStyle: 'italic'
    }
  }, "Unassigned"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px/1.2 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: 2
    }
  }, b.city)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Stat, {
    s: b.status
  })), /*#__PURE__*/React.createElement("td", null, b.printed ? /*#__PURE__*/React.createElement(Pill, {
    kind: "brand"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 11,
    strokeWidth: 2.6
  }), "Printed") : /*#__PURE__*/React.createElement(Pill, {
    kind: "neutral"
  }, "Not yet")), /*#__PURE__*/React.createElement("td", {
    style: {
      fontVariantNumeric: 'tabular-nums'
    }
  }, /*#__PURE__*/React.createElement("strong", null, b.scans)), /*#__PURE__*/React.createElement("td", {
    style: {
      color: 'var(--fg-3)'
    }
  }, b.when), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: 'right',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "Preview",
    style: {
      width: 30,
      height: 30
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "eye",
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "Download",
    style: {
      width: 30,
      height: 30
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "More",
    style: {
      width: 30,
      height: 30
    },
    onClick: e => {
      e.stopPropagation();
      setOpenMenu(openMenu === b.id ? null : b.id);
    }
  }, "\u22EF")), openMenu === b.id && /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      right: 0,
      top: '100%',
      marginTop: 4,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 10,
      boxShadow: 'var(--shadow-lg)',
      padding: 6,
      minWidth: 180,
      zIndex: 10,
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    style: {
      width: '100%',
      justifyContent: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "copy",
    size: 13
  }), " Copy link"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    style: {
      width: '100%',
      justifyContent: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "users",
    size: 13
  }), " ", b.assigned ? 'Reassign' : 'Assign'), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    style: {
      width: '100%',
      justifyContent: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "refresh",
    size: 13
  }), " Regenerate"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--line)',
      margin: '4px 0'
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    style: {
      width: '100%',
      justifyContent: 'flex-start',
      color: 'var(--danger)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash",
    size: 13
  }), " Delete")))))))), /*#__PURE__*/React.createElement("div", {
    className: "mobile-only",
    style: {
      display: 'grid',
      gap: 10
    }
  }, list.map(b => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    className: "card",
    style: {
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      position: 'relative',
      borderColor: sel.has(b.id) ? 'var(--brand-purple)' : 'var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: sel.has(b.id),
    onChange: () => toggleSel(b.id),
    style: {
      marginTop: 4
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 8,
      background: '#fff',
      border: '1px solid var(--line)',
      backgroundImage: 'repeating-linear-gradient(45deg,var(--brand-navy) 0 3px,transparent 3px 6px),repeating-linear-gradient(-45deg,var(--brand-navy) 0 3px,transparent 3px 6px)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: 'var(--font-mono)',
      font: '600 12px/1 var(--font-mono)',
      color: 'var(--brand-purple-700)'
    }
  }, b.id), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 15px/1.2 var(--font-sans)',
      marginTop: 4
    }
  }, b.biz || /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg-4)',
      fontStyle: 'italic',
      fontWeight: 400
    }
  }, "Unassigned")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.2 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: 2
    }
  }, b.city, " \xB7 ", b.scans, " scans"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    s: b.status
  }), b.printed ? /*#__PURE__*/React.createElement(Pill, {
    kind: "brand"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 11,
    strokeWidth: 2.6
  }), "Printed") : /*#__PURE__*/React.createElement(Pill, {
    kind: "neutral"
  }, "Not printed")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    style: {
      flex: 1,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "eye",
    size: 13
  }), " Preview"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    style: {
      flex: 1,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 13
  }), " Download"), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    style: {
      width: 34,
      height: 34
    }
  }, "\u22EF"))))));
};

// ─────────────────────────────────────────────  PLANS (CRUD: subscription + refill)
window.PlansScreen = () => {
  const [tab, setTab] = React.useState('sub');
  const [editing, setEditing] = React.useState(null); // null | 'new' | plan
  const [subs, setSubs] = React.useState([{
    id: 1,
    name: 'Test Plan',
    price: 999,
    reviews: 100,
    days: 30,
    active: false
  }, {
    id: 2,
    name: 'Pro',
    price: 3999,
    reviews: 500,
    days: 365,
    active: true
  }, {
    id: 3,
    name: 'Mini',
    price: 2499,
    reviews: 250,
    days: 365,
    active: true
  }, {
    id: 4,
    name: 'Starter',
    price: 1999,
    reviews: 100,
    days: 180,
    active: true
  }]);
  const [refills, setRefills] = React.useState([{
    id: 1,
    name: 'Refill 50',
    price: 999,
    reviews: 50,
    days: 90,
    active: true
  }, {
    id: 2,
    name: 'Refill 100',
    price: 1799,
    reviews: 100,
    days: 180,
    active: true
  }, {
    id: 3,
    name: 'Refill 250',
    price: 3999,
    reviews: 250,
    days: 365,
    active: false
  }]);
  const rows = tab === 'sub' ? subs : refills;
  const setRows = tab === 'sub' ? setSubs : setRefills;
  const toggle = id => setRows(r => r.map(p => p.id === id ? {
    ...p,
    active: !p.active
  } : p));
  const remove = id => setRows(r => r.filter(p => p.id !== id));
  const save = p => {
    if (p.id) setRows(r => r.map(x => x.id === p.id ? p : x));else setRows(r => [...r, {
      ...p,
      id: Date.now()
    }]);
    setEditing(null);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-header"
  }, /*#__PURE__*/React.createElement("h1", null, "Plans"), /*#__PURE__*/React.createElement("div", {
    className: "actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => setEditing('new')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), " Add Plan"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0,
      borderBottom: '1px solid var(--line)',
      marginBottom: 16
    }
  }, [['sub', 'Subscription Plans', subs.length], ['refill', 'Refill Plans', refills.length]].map(([k, l, c]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setTab(k),
    style: {
      padding: '12px 4px',
      marginRight: 24,
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      font: '600 14px/1 var(--font-sans)',
      color: tab === k ? 'var(--brand-purple)' : 'var(--fg-3)',
      borderBottom: '2px solid ' + (tab === k ? 'var(--brand-purple)' : 'transparent'),
      marginBottom: -1,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, l, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 12px/1 var(--font-sans)',
      color: 'var(--fg-4)'
    }
  }, c)))), /*#__PURE__*/React.createElement("div", {
    className: "table-card desktop-only"
  }, /*#__PURE__*/React.createElement("table", {
    className: "data-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: {
      width: '30%'
    }
  }, "Plan name"), /*#__PURE__*/React.createElement("th", null, "Price"), /*#__PURE__*/React.createElement("th", null, "Reviews"), /*#__PURE__*/React.createElement("th", null, "Validity"), /*#__PURE__*/React.createElement("th", null, "Active"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", null, rows.map(p => /*#__PURE__*/React.createElement("tr", {
    key: p.id,
    style: {
      opacity: p.active ? 1 : 0.55
    }
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 14px/1.2 var(--font-sans)'
    }
  }, p.name)), /*#__PURE__*/React.createElement("td", {
    style: {
      fontVariantNumeric: 'tabular-nums'
    }
  }, "\u20B9", p.price.toLocaleString('en-IN')), /*#__PURE__*/React.createElement("td", {
    style: {
      fontVariantNumeric: 'tabular-nums'
    }
  }, p.reviews), /*#__PURE__*/React.createElement("td", null, p.days, " days"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Toggle, {
    on: p.active,
    onChange: () => toggle(p.id)
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "Edit",
    onClick: () => setEditing(p),
    style: {
      width: 30,
      height: 30
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "edit",
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn danger",
    title: "Delete",
    onClick: () => remove(p.id),
    style: {
      width: 30,
      height: 30
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash",
    size: 13
  }))))))))), /*#__PURE__*/React.createElement("div", {
    className: "mobile-only",
    style: {
      display: 'grid',
      gap: 10
    }
  }, rows.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    className: "card",
    style: {
      padding: 14,
      opacity: p.active ? 1 : 0.6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 16px/1.2 var(--font-sans)'
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 20px/1 var(--font-sans)',
      color: 'var(--brand-purple)',
      marginTop: 4,
      letterSpacing: '-.01em'
    }
  }, "\u20B9", p.price.toLocaleString('en-IN'))), /*#__PURE__*/React.createElement(Toggle, {
    on: p.active,
    onChange: () => toggle(p.id)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      marginTop: 10,
      paddingTop: 10,
      borderTop: '1px solid var(--line)',
      font: '500 13px/1 var(--font-sans)',
      color: 'var(--fg-3)'
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--fg)'
    }
  }, p.reviews), " reviews"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--fg)'
    }
  }, p.days), " days validity")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 10,
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: () => setEditing(p)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "edit",
    size: 12
  }), " Edit"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: () => remove(p.id),
    style: {
      color: 'var(--danger)',
      borderColor: 'var(--danger-border)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash",
    size: 12
  }), " Delete"))))), editing && /*#__PURE__*/React.createElement(PlanEditor, {
    plan: editing === 'new' ? null : editing,
    kind: tab,
    onClose: () => setEditing(null),
    onSave: save
  }));
};
const PlanEditor = ({
  plan,
  kind,
  onClose,
  onSave
}) => {
  const [d, setD] = React.useState(plan || {
    name: '',
    price: '',
    reviews: '',
    days: '',
    active: true
  });
  const set = (k, v) => setD(s => ({
    ...s,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-bg",
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    style: {
      maxWidth: 480,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '700 20px/1.2 var(--font-sans)',
      margin: 0
    }
  }, plan ? 'Edit plan' : 'Add ' + (kind === 'sub' ? 'subscription' : 'refill') + ' plan'), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px/1.4 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: 2
    }
  }, kind === 'sub' ? 'Recurring plans owners pick during signup' : 'Top-up packs for businesses that ran out of reviews')), /*#__PURE__*/React.createElement("button", {
    className: "modal-close",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Plan name *"), /*#__PURE__*/React.createElement("input", {
    value: d.name,
    onChange: e => set('name', e.target.value),
    placeholder: "e.g. Pro",
    autoFocus: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    },
    className: "form-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Price (\u20B9) *"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: d.price,
    onChange: e => set('price', +e.target.value),
    placeholder: "3999"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Reviews *"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: d.reviews,
    onChange: e => set('reviews', +e.target.value),
    placeholder: "500"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Validity (days) *"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: d.days,
    onChange: e => set('days', +e.target.value),
    placeholder: "365"
  })), d.price && d.reviews ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      background: 'var(--brand-purple-50)',
      borderRadius: 8,
      font: '500 12px/1.4 var(--font-sans)',
      color: 'var(--brand-purple-700)'
    }
  }, "\u2248 \u20B9", (d.price / d.reviews).toFixed(1), " per review") : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      padding: '10px 12px',
      background: 'var(--surface-2)',
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: d.active,
    onChange: v => set('active', v)
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px/1.2 var(--font-sans)'
    }
  }, "Active"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.4 var(--font-sans)',
      color: 'var(--fg-3)'
    }
  }, "Inactive plans are hidden from the signup wizard")))), /*#__PURE__*/React.createElement("div", {
    className: "modal-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => onSave(d)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14,
    strokeWidth: 2.6
  }), " ", plan ? 'Save changes' : 'Create plan'))));
};

// ─────────────────────────────────────────────  PAYMENTS
// Day-grouped ledger with sticky date headers, day totals, expandable rows
// (commission breakdown + invoice links), outstanding payouts band, and
// a Commission Payouts side-tray for batch settling.
window.PaymentsScreen = () => {
  const [q, setQ] = React.useState('');
  const [typeF, setTypeF] = React.useState('all');
  const [statusF, setStatusF] = React.useState('all');
  const [recOpen, setRecOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [payoutOpen, setPayoutOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(null);
  const [items, setItems] = React.useState([{
    id: 1,
    biz: 'Mastani Cafe',
    type: 'subscription',
    plan: 'Pro',
    amt: 3999,
    date: '4/28/2026',
    status: 'paid',
    method: 'UPI',
    ref: 'UPI-9F3A201',
    affiliate: 'Bagga',
    comm: 1799,
    commPct: 45,
    commStatus: 'pending'
  }, {
    id: 2,
    biz: 'Mastani Cafe',
    type: 'subscription',
    plan: 'Pro',
    amt: 3999,
    date: '4/28/2026',
    status: 'paid',
    method: 'UPI',
    ref: 'UPI-9F3A188',
    affiliate: 'Bagga',
    comm: 1799,
    commPct: 45,
    commStatus: 'pending'
  }, {
    id: 3,
    biz: 'Gunmeet house',
    type: 'subscription',
    plan: 'Test',
    amt: 999,
    date: '4/28/2026',
    status: 'paid',
    method: 'Cashfree',
    ref: 'CF-7TX0991',
    affiliate: 'Bagga',
    comm: 449,
    commPct: 45,
    commStatus: 'pending'
  }, {
    id: 4,
    biz: 'Gunmeet house',
    type: 'subscription',
    plan: 'Test',
    amt: 999,
    date: '4/28/2026',
    status: 'paid',
    method: 'Cashfree',
    ref: 'CF-7TX0902',
    affiliate: 'Bagga',
    comm: 449,
    commPct: 45,
    commStatus: 'pending'
  }, {
    id: 5,
    biz: 'Gunmeet house',
    type: 'subscription',
    plan: 'Test',
    amt: 999,
    date: '4/28/2026',
    status: 'paid',
    method: 'Cash',
    ref: '—',
    affiliate: 'Bagga',
    comm: 449,
    commPct: 45,
    commStatus: 'pending'
  }, {
    id: 6,
    biz: 'QAS',
    type: 'refill',
    plan: 'Refill 50',
    amt: 499,
    date: '4/22/2026',
    status: 'paid',
    method: 'UPI',
    ref: 'UPI-8B2C019',
    affiliate: null,
    comm: 0,
    commPct: 0,
    commStatus: 'none'
  }, {
    id: 7,
    biz: 'Prashant cafe',
    type: 'refill',
    plan: 'Refill 50',
    amt: 499,
    date: '4/22/2026',
    status: 'pending',
    method: 'Cashfree',
    ref: 'CF-PEND-71',
    affiliate: null,
    comm: 0,
    commPct: 0,
    commStatus: 'none'
  }, {
    id: 8,
    biz: 'Aspire IT',
    type: 'subscription',
    plan: 'Test',
    amt: 999,
    date: '4/20/2026',
    status: 'paid',
    method: 'Bank',
    ref: 'BANK-44820',
    affiliate: 'Gunmeet',
    comm: 449,
    commPct: 45,
    commStatus: 'paid'
  }]);
  const list = items.filter(t => {
    if (typeF !== 'all' && t.type !== typeF) return false;
    if (statusF !== 'all' && t.status !== statusF) return false;
    if (q && !(t.biz + (t.affiliate || '') + (t.ref || '')).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  // group by date, preserve order of first occurrence
  const groups = list.reduce((acc, t) => {
    const g = acc.find(x => x.date === t.date);
    if (g) g.rows.push(t);else acc.push({
      date: t.date,
      rows: [t]
    });
    return acc;
  }, []);
  const totals = {
    total: items.reduce((s, t) => s + (t.status === 'paid' ? t.amt : 0), 0),
    pending: items.filter(t => t.status === 'pending').length,
    pendingAmt: items.filter(t => t.status === 'pending').reduce((s, t) => s + t.amt, 0),
    commPaid: items.reduce((s, t) => s + (t.commStatus === 'paid' ? t.comm : 0), 0),
    commPending: items.reduce((s, t) => s + (t.commStatus === 'pending' ? t.comm : 0), 0)
  };
  // build payout buckets per affiliate for the side-tray
  const payouts = items.filter(t => t.commStatus === 'pending').reduce((acc, t) => {
    const a = acc.find(x => x.affiliate === t.affiliate);
    if (a) {
      a.amount += t.comm;
      a.count += 1;
    } else acc.push({
      affiliate: t.affiliate,
      amount: t.comm,
      count: 1
    });
    return acc;
  }, []);
  const TypePill = ({
    t
  }) => t === 'subscription' ? /*#__PURE__*/React.createElement(Pill, {
    kind: "brand"
  }, "Subscription") : /*#__PURE__*/React.createElement(Pill, {
    kind: "ok"
  }, "Refill");
  const StatPill = ({
    s
  }) => s === 'paid' ? /*#__PURE__*/React.createElement(Pill, {
    kind: "ok"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 11,
    strokeWidth: 2.6
  }), "Paid") : s === 'pending' ? /*#__PURE__*/React.createElement(Pill, {
    kind: "warn"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 11
  }), "Pending") : s === 'failed' ? /*#__PURE__*/React.createElement(Pill, {
    kind: "dgr"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alert-triangle",
    size: 11
  }), "Failed") : /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg-4)'
    }
  }, "\u2014");
  const initials = s => s.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const settleAll = () => setItems(it => it.map(x => x.commStatus === 'pending' ? {
    ...x,
    commStatus: 'paid'
  } : x));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-header"
  }, /*#__PURE__*/React.createElement("h1", null, "Payments ", /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 14px/1 var(--font-sans)',
      color: 'var(--fg-4)',
      marginLeft: 8,
      verticalAlign: 'middle'
    }
  }, items.length)), /*#__PURE__*/React.createElement("div", {
    className: "actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: () => setLinkOpen(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "send",
    size: 14
  }), " Send Payment Link"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => setRecOpen(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), " Record Payment"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 12,
      marginBottom: 14
    },
    className: "stat-grid"
  }, /*#__PURE__*/React.createElement(StatCard, {
    icon: "wallet",
    tint: "purple",
    label: "Collected this month",
    value: `₹${totals.total.toLocaleString('en-IN')}`,
    delta: "\u2191 18%",
    deltaType: "up"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "clock",
    tint: "amber",
    label: "Payments pending",
    value: totals.pending,
    delta: `₹${totals.pendingAmt.toLocaleString('en-IN')}`,
    deltaType: "neutral"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "gift",
    tint: "green",
    label: "Commission paid",
    value: `₹${totals.commPaid.toLocaleString('en-IN')}`
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "alert-triangle",
    tint: "red",
    label: "Commission to pay",
    value: `₹${totals.commPending.toLocaleString('en-IN')}`
  })), totals.commPending > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'linear-gradient(135deg, var(--brand-purple-50), var(--brand-purple-100))',
      border: '1px solid var(--brand-purple-200)',
      borderRadius: 14,
      padding: '14px 18px',
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 10,
      background: 'var(--brand-purple)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      boxShadow: 'var(--shadow-purple)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gift",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 15px/1.2 var(--font-sans)',
      color: 'var(--brand-purple-900)'
    }
  }, "\u20B9", totals.commPending.toLocaleString('en-IN'), " owed to ", payouts.length, " affiliate", payouts.length === 1 ? '' : 's'), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.4 var(--font-sans)',
      color: 'var(--brand-purple-700)',
      marginTop: 2
    }
  }, "Settle in batch \u2014 accruing since the last payout cycle")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: () => setPayoutOpen(true),
    style: {
      background: '#fff',
      borderColor: 'var(--brand-purple-200)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "eye",
    size: 13
  }), " Review"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary btn-sm",
    onClick: settleAll
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13,
    strokeWidth: 2.6
  }), " Settle all")), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 12,
      marginBottom: 14,
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "search-box",
    style: {
      flex: '1 1 260px',
      maxWidth: 380,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search"
  }), /*#__PURE__*/React.createElement("input", {
    placeholder: "Search business, affiliate, txn ref\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginLeft: 'auto',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Sel, {
    value: typeF,
    onChange: setTypeF,
    label: "Type",
    opts: [['all', 'All types'], ['subscription', 'Subscription'], ['refill', 'Refill']]
  }), /*#__PURE__*/React.createElement(Sel, {
    value: statusF,
    onChange: setStatusF,
    label: "Status",
    opts: [['all', 'All status'], ['paid', 'Paid'], ['pending', 'Pending'], ['failed', 'Failed']]
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 13
  }), " Export CSV"))), /*#__PURE__*/React.createElement("div", {
    className: "desktop-only",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, groups.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 48,
      textAlign: 'center',
      color: 'var(--fg-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 32
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px/1.3 var(--font-sans)',
      color: 'var(--fg-2)',
      marginTop: 10
    }
  }, "No payments match your filters"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px/1.4 var(--font-sans)',
      marginTop: 4
    }
  }, "Try clearing the search or status filter.")), groups.map(g => {
    const dayTotal = g.rows.reduce((s, r) => s + (r.status === 'paid' ? r.amt : 0), 0);
    const dayPending = g.rows.filter(r => r.status === 'pending').length;
    return /*#__PURE__*/React.createElement("div", {
      key: g.date,
      className: "card",
      style: {
        padding: 0,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 40,
        height: 40,
        borderRadius: 10,
        background: 'var(--bg-alt)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: '1px solid var(--line)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 9px/1 var(--font-sans)',
        color: 'var(--fg-3)',
        textTransform: 'uppercase',
        letterSpacing: '.06em'
      }
    }, ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(g.date.split('/')[0]) - 1]), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '700 15px/1 var(--font-sans)',
        color: 'var(--fg)',
        marginTop: 2
      }
    }, g.date.split('/')[1])), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '700 14px/1.2 var(--font-sans)',
        color: 'var(--fg)'
      }
    }, g.date), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 12px/1.3 var(--font-sans)',
        color: 'var(--fg-3)',
        marginTop: 2,
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", null, g.rows.length, " txn", g.rows.length === 1 ? '' : 's'), dayPending > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--warning)'
      }
    }, "\xB7 ", dayPending, " pending"))), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 10px/1 var(--font-sans)',
        color: 'var(--fg-3)',
        textTransform: 'uppercase',
        letterSpacing: '.04em',
        marginBottom: 4
      }
    }, "Day total"), /*#__PURE__*/React.createElement("strong", {
      style: {
        font: '700 18px/1 var(--font-sans)',
        color: 'var(--brand-purple)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-.01em'
      }
    }, "\u20B9", dayTotal.toLocaleString('en-IN')))), /*#__PURE__*/React.createElement("div", null, g.rows.map((t, idx) => {
      const open = expanded === t.id;
      return /*#__PURE__*/React.createElement("div", {
        key: t.id,
        style: {
          borderTop: idx === 0 ? 'none' : '1px solid var(--line)'
        }
      }, /*#__PURE__*/React.createElement("div", {
        onClick: () => setExpanded(open ? null : t.id),
        style: {
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr .9fr 1.2fr 1.2fr .8fr 36px',
          gap: 14,
          alignItems: 'center',
          padding: '14px 18px',
          cursor: 'pointer',
          background: open ? 'var(--surface-2)' : 'transparent',
          transition: 'background 120ms'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'var(--brand-purple-100)',
          color: 'var(--brand-purple-700)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '700 12px/1 var(--font-sans)',
          flexShrink: 0
        }
      }, initials(t.biz)), /*#__PURE__*/React.createElement("div", {
        style: {
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          font: '600 14px/1.2 var(--font-sans)',
          color: 'var(--fg)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      }, t.biz), /*#__PURE__*/React.createElement("div", {
        style: {
          font: '400 11px/1.2 var(--font-sans)',
          color: 'var(--fg-4)',
          marginTop: 3,
          fontFamily: 'var(--font-mono)'
        }
      }, t.ref))), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          flexWrap: 'wrap'
        }
      }, /*#__PURE__*/React.createElement(TypePill, {
        t: t.type
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          font: '500 12px/1 var(--font-sans)',
          color: 'var(--fg-3)'
        }
      }, t.plan)), /*#__PURE__*/React.createElement("strong", {
        style: {
          font: '700 15px/1 var(--font-sans)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-.01em'
        }
      }, "\u20B9", t.amt.toLocaleString('en-IN')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(StatPill, {
        s: t.status
      })), /*#__PURE__*/React.createElement("div", null, t.commPct > 0 ? /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          flexDirection: 'column'
        }
      }, /*#__PURE__*/React.createElement("strong", {
        style: {
          font: '600 13px/1 var(--font-sans)',
          fontVariantNumeric: 'tabular-nums'
        }
      }, "\u20B9", t.comm.toLocaleString('en-IN')), /*#__PURE__*/React.createElement("span", {
        style: {
          font: '400 11px/1 var(--font-sans)',
          color: 'var(--fg-4)',
          marginTop: 3
        }
      }, t.affiliate, " \xB7 ", t.commPct, "%")) : /*#__PURE__*/React.createElement("span", {
        style: {
          font: '400 12px/1 var(--font-sans)',
          color: 'var(--fg-4)',
          fontStyle: 'italic'
        }
      }, "No affiliate")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(StatPill, {
        s: t.commStatus
      })), /*#__PURE__*/React.createElement("div", {
        style: {
          textAlign: 'right'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 24,
          height: 24,
          borderRadius: 6,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--fg-3)',
          transition: 'transform 200ms',
          transform: open ? 'rotate(180deg)' : 'none'
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "chevron-down",
        size: 14
      })))), open && /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '0 18px 16px 18px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--line)'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 14
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          padding: 14,
          background: 'var(--surface)',
          borderRadius: 10,
          border: '1px solid var(--line)'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          font: '400 10px/1 var(--font-sans)',
          color: 'var(--fg-3)',
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          marginBottom: 10
        }
      }, "Transaction details"), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap: 14,
          font: '500 13px/1.3 var(--font-sans)'
        }
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          font: '400 11px/1 var(--font-sans)',
          color: 'var(--fg-3)',
          marginBottom: 4
        }
      }, "Method"), /*#__PURE__*/React.createElement("strong", null, t.method)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          font: '400 11px/1 var(--font-sans)',
          color: 'var(--fg-3)',
          marginBottom: 4
        }
      }, "Reference"), /*#__PURE__*/React.createElement("strong", {
        style: {
          fontFamily: 'var(--font-mono)',
          fontSize: 12
        }
      }, t.ref)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          font: '400 11px/1 var(--font-sans)',
          color: 'var(--fg-3)',
          marginBottom: 4
        }
      }, "Plan"), /*#__PURE__*/React.createElement("strong", null, t.plan)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          font: '400 11px/1 var(--font-sans)',
          color: 'var(--fg-3)',
          marginBottom: 4
        }
      }, "Date"), /*#__PURE__*/React.createElement("strong", null, t.date)))), t.commPct > 0 ? /*#__PURE__*/React.createElement("div", {
        style: {
          padding: 14,
          background: 'var(--brand-purple-50)',
          borderRadius: 10,
          border: '1px solid var(--brand-purple-200)'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          font: '400 10px/1 var(--font-sans)',
          color: 'var(--brand-purple-700)',
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          marginBottom: 10
        }
      }, "Commission breakdown"), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          font: '400 12px/1.3 var(--font-sans)',
          color: 'var(--fg-2)',
          marginBottom: 6
        }
      }, /*#__PURE__*/React.createElement("span", null, "Affiliate"), /*#__PURE__*/React.createElement("strong", {
        style: {
          color: 'var(--fg)'
        }
      }, t.affiliate)), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          font: '400 12px/1.3 var(--font-sans)',
          color: 'var(--fg-2)',
          marginBottom: 6
        }
      }, /*#__PURE__*/React.createElement("span", null, "Rate"), /*#__PURE__*/React.createElement("strong", {
        style: {
          color: 'var(--fg)'
        }
      }, t.commPct, "% of \u20B9", t.amt.toLocaleString('en-IN'))), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 8,
          marginTop: 8,
          borderTop: '1px solid var(--brand-purple-200)'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          font: '600 13px/1 var(--font-sans)',
          color: 'var(--brand-purple-900)'
        }
      }, "Owed"), /*#__PURE__*/React.createElement("strong", {
        style: {
          font: '700 18px/1 var(--font-sans)',
          color: 'var(--brand-purple)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-.01em'
        }
      }, "\u20B9", t.comm.toLocaleString('en-IN')))) : /*#__PURE__*/React.createElement("div", {
        style: {
          padding: 14,
          background: 'var(--bg-alt)',
          borderRadius: 10,
          border: '1px dashed var(--line-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--fg-3)',
          font: '400 13px/1.4 var(--font-sans)',
          textAlign: 'center'
        }
      }, "Direct sale \u2014 no affiliate commission")), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          gap: 8,
          marginTop: 12,
          justifyContent: 'flex-end',
          flexWrap: 'wrap'
        }
      }, t.status === 'pending' && /*#__PURE__*/React.createElement("button", {
        className: "btn btn-outline btn-sm"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "send",
        size: 13
      }), " Resend payment link"), t.commStatus === 'pending' && /*#__PURE__*/React.createElement("button", {
        className: "btn btn-outline btn-sm",
        onClick: e => {
          e.stopPropagation();
          setItems(it => it.map(x => x.id === t.id ? {
            ...x,
            commStatus: 'paid'
          } : x));
        },
        style: {
          borderColor: 'var(--brand-purple-200)',
          color: 'var(--brand-purple)'
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "check",
        size: 13,
        strokeWidth: 2.6
      }), " Mark commission paid"), /*#__PURE__*/React.createElement("button", {
        className: "btn btn-outline btn-sm"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "eye",
        size: 13
      }), " View invoice"), /*#__PURE__*/React.createElement("button", {
        className: "btn btn-outline btn-sm"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "download",
        size: 13
      }), " Download PDF"))));
    })));
  })), /*#__PURE__*/React.createElement("div", {
    className: "mobile-only",
    style: {
      display: 'grid',
      gap: 10
    }
  }, list.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    className: "card",
    style: {
      padding: 14,
      gap: 10,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 8,
      background: 'var(--brand-purple-100)',
      color: 'var(--brand-purple-700)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '700 13px/1 var(--font-sans)',
      flexShrink: 0
    }
  }, t.biz.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 15px/1.2 var(--font-sans)'
    }
  }, t.biz), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.2 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: 2
    }
  }, t.date))), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 16px/1 var(--font-sans)',
      color: 'var(--brand-purple)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, "\u20B9", t.amt.toLocaleString('en-IN'))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(TypePill, {
    t: t.type
  }), /*#__PURE__*/React.createElement(StatPill, {
    s: t.status
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 10,
      background: 'var(--surface-2)',
      borderRadius: 10,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      font: '500 13px/1 var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px/1 var(--font-sans)',
      color: 'var(--fg-3)',
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: '.04em'
    }
  }, "Commission"), t.commPct > 0 ? /*#__PURE__*/React.createElement("strong", {
    style: {
      fontVariantNumeric: 'tabular-nums'
    }
  }, "\u20B9", t.comm.toLocaleString('en-IN'), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg-4)',
      fontWeight: 400
    }
  }, "(", t.commPct, "%)")) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg-4)'
    }
  }, "No affiliate")), /*#__PURE__*/React.createElement(StatPill, {
    s: t.commStatus
  }))))), linkOpen && /*#__PURE__*/React.createElement(SendPaymentLink, {
    onClose: () => setLinkOpen(false)
  }), recOpen && /*#__PURE__*/React.createElement(RecordPayment, {
    onClose: () => setRecOpen(false),
    onSave: p => {
      setItems(it => [{
        ...p,
        id: Date.now()
      }, ...it]);
      setRecOpen(false);
    }
  }), payoutOpen && /*#__PURE__*/React.createElement("div", {
    className: "modal-bg",
    onClick: e => e.target === e.currentTarget && setPayoutOpen(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    style: {
      maxWidth: 520,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '700 20px/1.2 var(--font-sans)',
      margin: 0
    }
  }, "Commission payouts"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px/1.4 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: 2
    }
  }, "Pending balances grouped by affiliate")), /*#__PURE__*/React.createElement("button", {
    className: "modal-close",
    onClick: () => setPayoutOpen(false)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    className: "modal-body",
    style: {
      gap: 8
    }
  }, payouts.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.affiliate || '—',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      background: 'var(--surface-2)',
      borderRadius: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: 'var(--brand-purple-100)',
      color: 'var(--brand-purple-700)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '700 12px/1 var(--font-sans)'
    }
  }, (p.affiliate || '?').slice(0, 2).toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '600 14px/1.2 var(--font-sans)'
    }
  }, p.affiliate || 'Unassigned'), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.3 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: 2
    }
  }, p.count, " transaction", p.count === 1 ? '' : 's')), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 16px/1 var(--font-sans)',
      color: 'var(--brand-purple)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, "\u20B9", p.amount.toLocaleString('en-IN')))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '12px 14px',
      marginTop: 4,
      borderTop: '2px solid var(--line)',
      font: '700 15px/1 var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Total to settle"), /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--brand-purple)',
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: '-.01em'
    }
  }, "\u20B9", totals.commPending.toLocaleString('en-IN')))), /*#__PURE__*/React.createElement("div", {
    className: "modal-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: () => setPayoutOpen(false)
  }, "Close"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => {
      settleAll();
      setPayoutOpen(false);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14,
    strokeWidth: 2.6
  }), " Settle all \u20B9", totals.commPending.toLocaleString('en-IN'))))));
};
const SendPaymentLink = ({
  onClose
}) => {
  const [biz, setBiz] = React.useState('');
  const [amt, setAmt] = React.useState('');
  const [type, setType] = React.useState('subscription');
  const [note, setNote] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const generate = () => setSent(true);
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-bg",
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    style: {
      maxWidth: 480,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '700 20px/1.2 var(--font-sans)',
      margin: 0
    }
  }, "Send Payment Link"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px/1.4 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: 2
    }
  }, "Generate a Cashfree payment link and send it to the business owner.")), /*#__PURE__*/React.createElement("button", {
    className: "modal-close",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, !sent ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Business *"), /*#__PURE__*/React.createElement("select", {
    value: biz,
    onChange: e => setBiz(e.target.value),
    className: "filter-sel",
    style: {
      width: '100%',
      padding: '10px 32px 10px 12px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 Select business \u2014"), /*#__PURE__*/React.createElement("option", null, "Mastani Cafe"), /*#__PURE__*/React.createElement("option", null, "Gunmeet house"), /*#__PURE__*/React.createElement("option", null, "QAS"), /*#__PURE__*/React.createElement("option", null, "Prashant cafe"), /*#__PURE__*/React.createElement("option", null, "Aspire IT"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    },
    className: "form-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Type"), /*#__PURE__*/React.createElement("select", {
    value: type,
    onChange: e => setType(e.target.value),
    className: "filter-sel",
    style: {
      width: '100%',
      padding: '10px 32px 10px 12px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "subscription"
  }, "Subscription"), /*#__PURE__*/React.createElement("option", {
    value: "refill"
  }, "Refill"))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Amount (\u20B9) *"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: amt,
    onChange: e => setAmt(e.target.value),
    placeholder: "3999"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Note ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg-4)',
      fontWeight: 400
    }
  }, "\xB7 optional")), /*#__PURE__*/React.createElement("input", {
    value: note,
    onChange: e => setNote(e.target.value),
    placeholder: "e.g. Pro plan renewal \u2014 May 2026"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      background: 'var(--brand-purple-50)',
      borderRadius: 8,
      font: '500 12px/1.4 var(--font-sans)',
      color: 'var(--brand-purple-700)',
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "circle-dot",
    size: 12
  }), " Owner will receive an SMS + WhatsApp with a one-tap Cashfree link.")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      alignItems: 'center',
      padding: '12px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: 'var(--success-bg)',
      color: 'var(--success)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 24,
    strokeWidth: 3
  })), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 16px/1.2 var(--font-sans)'
    }
  }, "Link sent to ", biz || 'owner'), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 10,
      background: 'var(--bg-alt)',
      borderRadius: 8,
      font: '500 12px/1 var(--font-mono)',
      color: 'var(--brand-purple-700)',
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      width: '100%',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("code", {
    style: {
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, "cashfree.com/pl/X9F3-", amt || '0000'), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    style: {
      width: 28,
      height: 28
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "copy",
    size: 12
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "modal-foot"
  }, !sent ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: onClose
  }, "Close"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: generate,
    disabled: !biz || !amt
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "send",
    size: 14
  }), " Generate Link")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: onClose
  }, "Done"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => setSent(false)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), " Send another")))));
};
const RecordPayment = ({
  onClose,
  onSave
}) => {
  const [d, setD] = React.useState({
    biz: '',
    type: 'subscription',
    amt: '',
    date: new Date().toLocaleDateString('en-US'),
    method: 'UPI',
    status: 'paid',
    comm: 0,
    commPct: 0,
    commStatus: 'none'
  });
  const set = (k, v) => setD(s => ({
    ...s,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-bg",
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    style: {
      maxWidth: 520,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '700 20px/1.2 var(--font-sans)',
      margin: 0
    }
  }, "Record Payment"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px/1.4 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: 2
    }
  }, "Manually log a payment received outside Cashfree (cash, bank transfer, etc.)")), /*#__PURE__*/React.createElement("button", {
    className: "modal-close",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Business *"), /*#__PURE__*/React.createElement("select", {
    value: d.biz,
    onChange: e => set('biz', e.target.value),
    className: "filter-sel",
    style: {
      width: '100%',
      padding: '10px 32px 10px 12px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 Select business \u2014"), /*#__PURE__*/React.createElement("option", null, "Mastani Cafe"), /*#__PURE__*/React.createElement("option", null, "Gunmeet house"), /*#__PURE__*/React.createElement("option", null, "QAS"), /*#__PURE__*/React.createElement("option", null, "Prashant cafe"), /*#__PURE__*/React.createElement("option", null, "Aspire IT"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    },
    className: "form-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Type *"), /*#__PURE__*/React.createElement("select", {
    value: d.type,
    onChange: e => set('type', e.target.value),
    className: "filter-sel",
    style: {
      width: '100%',
      padding: '10px 32px 10px 12px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "subscription"
  }, "Subscription"), /*#__PURE__*/React.createElement("option", {
    value: "refill"
  }, "Refill"))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Amount (\u20B9) *"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: d.amt,
    onChange: e => set('amt', +e.target.value),
    placeholder: "3999"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    },
    className: "form-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Payment date *"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: d.date,
    onChange: e => set('date', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Method"), /*#__PURE__*/React.createElement("select", {
    value: d.method,
    onChange: e => set('method', e.target.value),
    className: "filter-sel",
    style: {
      width: '100%',
      padding: '10px 32px 10px 12px'
    }
  }, /*#__PURE__*/React.createElement("option", null, "UPI"), /*#__PURE__*/React.createElement("option", null, "Bank transfer"), /*#__PURE__*/React.createElement("option", null, "Cash"), /*#__PURE__*/React.createElement("option", null, "Card"), /*#__PURE__*/React.createElement("option", null, "Cheque")))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Reference / Txn ID ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg-4)',
      fontWeight: 400
    }
  }, "\xB7 optional")), /*#__PURE__*/React.createElement("input", {
    placeholder: "UPI ref, bank txn id, etc."
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      background: 'var(--success-bg)',
      borderRadius: 8,
      font: '500 12px/1.4 var(--font-sans)',
      color: 'var(--success)',
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12,
    strokeWidth: 2.6
  }), " Recording marks the payment as Paid; affiliate commission (if any) will accrue automatically.")), /*#__PURE__*/React.createElement("div", {
    className: "modal-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => onSave(d),
    disabled: !d.biz || !d.amt
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14,
    strokeWidth: 2.6
  }), " Record Payment"))));
};

// ─────────────────────────────────────────────  AFFILIATES
// Fields: name, email, phone, commission %, businesses count, total earned,
// referral code, status (active toggle), edit action. Search + Add CTA.
window.AffiliatesScreen = () => {
  const [q, setQ] = React.useState('');
  const [statusF, setStatusF] = React.useState('all');
  const [items, setItems] = React.useState([{
    id: 1,
    name: '',
    email: 'o',
    phone: '',
    comm: 30,
    businesses: 0,
    earned: 0,
    code: 'AFF-3D3D2C0E',
    active: true
  }, {
    id: 2,
    name: '',
    email: 'manager',
    phone: '',
    comm: 30,
    businesses: 0,
    earned: 0,
    code: 'AFF-B5F6A506',
    active: false
  }, {
    id: 3,
    name: 'Bagga',
    email: 'bagga',
    phone: '9370111955',
    comm: 45,
    businesses: 12,
    earned: 5394,
    code: 'AFF-934CCAD6',
    active: true
  }, {
    id: 4,
    name: 'Gunmeet',
    email: 'gunmeet@test.com',
    phone: '+919876543210',
    comm: 30,
    businesses: 0,
    earned: 0,
    code: 'AFF-5BF06B48',
    active: true
  }]);
  const [editing, setEditing] = React.useState(null);
  const toggle = id => setItems(it => it.map(x => x.id === id ? {
    ...x,
    active: !x.active
  } : x));
  const save = a => {
    if (a.id) setItems(it => it.map(x => x.id === a.id ? a : x));else setItems(it => [{
      ...a,
      id: Date.now(),
      code: 'AFF-' + Math.random().toString(16).slice(2, 10).toUpperCase()
    }, ...it]);
    setEditing(null);
  };
  const list = items.filter(a => {
    if (statusF === 'active' && !a.active) return false;
    if (statusF === 'inactive' && a.active) return false;
    if (q && !(a.name + a.email + a.code).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const totals = {
    active: items.filter(i => i.active).length,
    earned: items.reduce((s, i) => s + i.earned, 0),
    biz: items.reduce((s, i) => s + i.businesses, 0)
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-header"
  }, /*#__PURE__*/React.createElement("h1", null, "Affiliates ", /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 14px/1 var(--font-sans)',
      color: 'var(--fg-4)',
      marginLeft: 8,
      verticalAlign: 'middle'
    }
  }, items.length)), /*#__PURE__*/React.createElement("div", {
    className: "actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => setEditing('new')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), " Add Affiliate"))), /*#__PURE__*/React.createElement("div", {
    className: "stat-grid",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    icon: "users",
    tint: "purple",
    label: "Active affiliates",
    value: totals.active
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "building",
    tint: "blue",
    label: "Businesses referred",
    value: totals.biz
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "wallet",
    tint: "green",
    label: "Total commission paid",
    value: `₹${totals.earned.toLocaleString('en-IN')}`
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "gift",
    tint: "amber",
    label: "Top affiliate",
    value: items.slice().sort((a, b) => b.earned - a.earned)[0]?.name || '—',
    delta: `₹${items.slice().sort((a, b) => b.earned - a.earned)[0]?.earned.toLocaleString('en-IN') || 0}`,
    deltaType: "neutral"
  })), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 12,
      marginBottom: 14,
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "search-box",
    style: {
      flex: '1 1 260px',
      maxWidth: 380,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search"
  }), /*#__PURE__*/React.createElement("input", {
    placeholder: "Search affiliates by name, email, code\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Sel, {
    value: statusF,
    onChange: setStatusF,
    label: "Status",
    opts: [['all', 'All status'], ['active', 'Active'], ['inactive', 'Inactive']]
  }))), /*#__PURE__*/React.createElement("div", {
    className: "table-card desktop-only"
  }, /*#__PURE__*/React.createElement("table", {
    className: "data-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: {
      width: '18%'
    }
  }, "Name"), /*#__PURE__*/React.createElement("th", null, "Email"), /*#__PURE__*/React.createElement("th", null, "Phone"), /*#__PURE__*/React.createElement("th", null, "Commission"), /*#__PURE__*/React.createElement("th", null, "Businesses"), /*#__PURE__*/React.createElement("th", null, "Total earned"), /*#__PURE__*/React.createElement("th", null, "Referral code"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", null, list.map(a => /*#__PURE__*/React.createElement("tr", {
    key: a.id,
    style: {
      opacity: a.active ? 1 : 0.55
    }
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: 'var(--brand-purple-100)',
      color: 'var(--brand-purple-700)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '700 12px/1 var(--font-sans)',
      flexShrink: 0
    }
  }, (a.name || a.email || '?').slice(0, 2).toUpperCase()), /*#__PURE__*/React.createElement("strong", null, a.name || /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg-4)',
      fontWeight: 400,
      fontStyle: 'italic'
    }
  }, "Unnamed")))), /*#__PURE__*/React.createElement("td", {
    style: {
      color: a.email ? 'var(--fg)' : 'var(--fg-4)'
    }
  }, a.email || '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      fontVariantNumeric: 'tabular-nums',
      color: a.phone ? 'var(--fg)' : 'var(--fg-4)'
    }
  }, a.phone || '—'), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Pill, {
    kind: "brand"
  }, a.comm, "%")), /*#__PURE__*/React.createElement("td", {
    style: {
      fontVariantNumeric: 'tabular-nums'
    }
  }, a.businesses), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", {
    style: {
      fontVariantNumeric: 'tabular-nums'
    }
  }, "\u20B9", a.earned.toLocaleString('en-IN'))), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      gap: 4,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: 'var(--font-mono)',
      font: '500 12px/1 var(--font-mono)',
      color: 'var(--fg-2)',
      background: 'var(--bg-alt)',
      padding: '4px 8px',
      borderRadius: 6
    }
  }, a.code), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "Copy code",
    style: {
      width: 26,
      height: 26
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "copy",
    size: 12
  })))), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Toggle, {
    on: a.active,
    onChange: () => toggle(a.id)
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "Edit",
    onClick: () => setEditing(a),
    style: {
      width: 30,
      height: 30
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "edit",
    size: 13
  })))))))), /*#__PURE__*/React.createElement("div", {
    className: "mobile-only",
    style: {
      display: 'grid',
      gap: 10
    }
  }, list.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    className: "card",
    style: {
      padding: 14,
      opacity: a.active ? 1 : 0.6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: 'var(--brand-purple-100)',
      color: 'var(--brand-purple-700)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '700 13px/1 var(--font-sans)',
      flexShrink: 0
    }
  }, (a.name || a.email || '?').slice(0, 2).toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 15px/1.2 var(--font-sans)'
    }
  }, a.name || 'Unnamed'), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.3 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: 2,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, a.email || '—', " \xB7 ", a.phone || '—'))), /*#__PURE__*/React.createElement(Toggle, {
    on: a.active,
    onChange: () => toggle(a.id)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: 'var(--font-mono)',
      font: '500 12px/1 var(--font-mono)',
      color: 'var(--brand-purple-700)',
      background: 'var(--brand-purple-50)',
      padding: '4px 8px',
      borderRadius: 6,
      flex: 1
    }
  }, a.code), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "Copy code",
    style: {
      width: 30,
      height: 30
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "copy",
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "Edit",
    onClick: () => setEditing(a),
    style: {
      width: 30,
      height: 30
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "edit",
    size: 13
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 8,
      padding: 10,
      background: 'var(--surface-2)',
      borderRadius: 10,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 10px/1 var(--font-sans)',
      color: 'var(--fg-3)',
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: '.04em'
    }
  }, "Commission"), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 14px/1 var(--font-sans)',
      color: 'var(--brand-purple)'
    }
  }, a.comm, "%")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 10px/1 var(--font-sans)',
      color: 'var(--fg-3)',
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: '.04em'
    }
  }, "Businesses"), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 14px/1 var(--font-sans)'
    }
  }, a.businesses)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 10px/1 var(--font-sans)',
      color: 'var(--fg-3)',
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: '.04em'
    }
  }, "Earned"), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 14px/1 var(--font-sans)'
    }
  }, "\u20B9", a.earned.toLocaleString('en-IN'))))))), editing && /*#__PURE__*/React.createElement(AffiliateEditor, {
    affiliate: editing === 'new' ? null : editing,
    onClose: () => setEditing(null),
    onSave: save
  }));
};
const AffiliateEditor = ({
  affiliate,
  onClose,
  onSave
}) => {
  const [d, setD] = React.useState(affiliate || {
    name: '',
    email: '',
    phone: '',
    comm: 30,
    businesses: 0,
    earned: 0,
    active: true
  });
  const set = (k, v) => setD(s => ({
    ...s,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-bg",
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    style: {
      maxWidth: 520,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '700 20px/1.2 var(--font-sans)',
      margin: 0
    }
  }, affiliate ? 'Edit affiliate' : 'Add affiliate'), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px/1.4 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: 2
    }
  }, affiliate ? 'Update commission, contact, or status' : 'A unique referral code will be generated automatically')), /*#__PURE__*/React.createElement("button", {
    className: "modal-close",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Name *"), /*#__PURE__*/React.createElement("input", {
    value: d.name,
    onChange: e => set('name', e.target.value),
    placeholder: "e.g. Priya Sharma",
    autoFocus: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    },
    className: "form-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Email *"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: d.email,
    onChange: e => set('email', e.target.value),
    placeholder: "name@company.com"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Phone"), /*#__PURE__*/React.createElement("input", {
    value: d.phone,
    onChange: e => set('phone', e.target.value),
    placeholder: "+91 98765 43210"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Commission % *"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "60",
    step: "5",
    value: d.comm,
    onChange: e => set('comm', +e.target.value),
    style: {
      flex: 1,
      accentColor: 'var(--brand-purple)'
    }
  }), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 18px/1 var(--font-sans)',
      color: 'var(--brand-purple)',
      minWidth: 50,
      textAlign: 'right'
    }
  }, d.comm, "%"))), affiliate && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      padding: 12,
      background: 'var(--surface-2)',
      borderRadius: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px/1 var(--font-sans)',
      color: 'var(--fg-3)',
      marginBottom: 4
    }
  }, "Referral code"), /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: 'var(--font-mono)',
      font: '600 13px/1 var(--font-mono)',
      color: 'var(--brand-purple-700)'
    }
  }, affiliate.code)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px/1 var(--font-sans)',
      color: 'var(--fg-3)',
      marginBottom: 4
    }
  }, "Total earned"), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 14px/1 var(--font-sans)'
    }
  }, "\u20B9", affiliate.earned.toLocaleString('en-IN')))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      padding: '10px 12px',
      background: 'var(--surface-2)',
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: d.active,
    onChange: v => set('active', v)
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px/1.2 var(--font-sans)'
    }
  }, "Active"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.4 var(--font-sans)',
      color: 'var(--fg-3)'
    }
  }, "Inactive affiliates can't earn Renewal commissions")))), /*#__PURE__*/React.createElement("div", {
    className: "modal-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => onSave(d)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14,
    strokeWidth: 2.6
  }), " ", affiliate ? 'Save changes' : 'Create affiliate'))));
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/Screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/Sidebar.jsx
try { (() => {
// Sidebar.jsx — admin sidebar nav with role-aware items + bottom user pill.
const NAV_ADMIN = [{
  key: 'dash',
  label: 'Dashboard',
  icon: 'layout-grid'
}, {
  key: 'biz',
  label: 'Businesses',
  icon: 'store'
}, {
  key: 'qr',
  label: 'QR Codes',
  icon: 'qr'
}];
const NAV_ADMIN_SECONDARY = [{
  key: 'plans',
  label: 'Plans',
  icon: 'card'
}, {
  key: 'affiliates',
  label: 'Affiliates',
  icon: 'users'
}, {
  key: 'payments',
  label: 'Payments',
  icon: 'wallet'
}];
window.Sidebar = ({
  tab,
  setTab,
  open,
  onClose,
  user = {
    name: 'Aarav Mehta',
    email: 'aarav@localshouts.in'
  }
}) => {
  return /*#__PURE__*/React.createElement(React.Fragment, null, open && /*#__PURE__*/React.createElement("div", {
    className: "sidebar-overlay mobile-only",
    onClick: onClose
  }), /*#__PURE__*/React.createElement("aside", {
    className: 'sidebar ' + (open ? 'open' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "sidebar-brand"
  }, /*#__PURE__*/React.createElement("img", {
    src: window.__resources && window.__resources.logoMain || "../../assets/logo.png",
    alt: "LocalShouts"
  })), /*#__PURE__*/React.createElement("nav", {
    className: "sidebar-nav"
  }, NAV_ADMIN.map(n => /*#__PURE__*/React.createElement("a", {
    key: n.key,
    className: 'sidebar-item ' + (tab === n.key ? 'active' : ''),
    onClick: () => {
      setTab(n.key);
      onClose && onClose();
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: n.icon
  }), " ", n.label)), /*#__PURE__*/React.createElement("div", {
    className: "sidebar-group"
  }, "Admin"), NAV_ADMIN_SECONDARY.map(n => /*#__PURE__*/React.createElement("a", {
    key: n.key,
    className: 'sidebar-item ' + (tab === n.key ? 'active' : ''),
    onClick: () => {
      setTab(n.key);
      onClose && onClose();
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: n.icon
  }), " ", n.label))), /*#__PURE__*/React.createElement("div", {
    className: "sidebar-bottom"
  }, /*#__PURE__*/React.createElement("div", {
    className: "user-pill"
  }, /*#__PURE__*/React.createElement("div", {
    className: "user-avatar"
  }, user.name?.[0]?.toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "user-name"
  }, user.name), /*#__PURE__*/React.createElement("div", {
    className: "user-email",
    style: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, user.email))), /*#__PURE__*/React.createElement("a", {
    className: "sidebar-item"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings"
  }), " Settings"), /*#__PURE__*/React.createElement("a", {
    className: "sidebar-item",
    style: {
      color: 'var(--fg-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "log-out"
  }), " Logout"))));
};
window.MobileTopbar = ({
  onMenu
}) => /*#__PURE__*/React.createElement("div", {
  className: "mobile-topbar mobile-only"
}, /*#__PURE__*/React.createElement("button", {
  className: "hamburger",
  onClick: onMenu,
  "aria-label": "Menu"
}, /*#__PURE__*/React.createElement(Icon, {
  name: "menu",
  size: 22
})), /*#__PURE__*/React.createElement("img", {
  src: window.__resources && window.__resources.logoSmall || "../../assets/logo_small.png",
  alt: "LocalShouts"
}));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/Wizard.jsx
try { (() => {
// Wizard.jsx — Add Business 4-step modal wizard.
// Faithful to existing flow: Business Info → Branding → Select Plan → Summary & Payment
// Creative additions:
//  - Live preview of the Google review card on every step (the thing buyers actually see)
//  - Smart Google URL parsing/validation with paste-detection
//  - Logo drag-drop with auto color extraction (mocked)
//  - Tone preview: shows a one-line sample review in chosen tone
//  - Keyword chips with suggested keywords pulled from the chosen category
//  - Plan picker: shows per-review cost + best-value badge, slider for review volume
//  - Summary: collapsible "what's included" detail + countdown to instant activation
//  - Ambassador toggle has inline benefit chips when on
//  - Pay/Save split persists across steps; sticky payment summary on step 4

const TONE_SAMPLES = {
  Friendly: 'Loved the vibe — staff were warm and the food was banging. Definitely coming back!',
  Professional: 'Excellent service, well-priced, and the quality was consistent throughout the visit.',
  Enthusiastic: 'WOW. Best experience I\'ve had in months — every single detail was on point!',
  Casual: 'Solid spot. Good food, no fuss. Would recommend to a friend.',
  Reserved: 'A pleasant experience overall. Service was attentive and the offering was as described.'
};
const CATEGORY_KEYWORDS = {
  'Restaurant / Cafe': ['cozy', 'specialty coffee', 'brunch', 'great vibes', 'fast service'],
  'Beauty / Salon': ['relaxing', 'skilled staff', 'clean space', 'great results', 'reasonable'],
  'Health / Wellness': ['professional', 'knowledgeable', 'clean', 'caring', 'effective treatment'],
  'Clinic': ['empathetic', 'thorough', 'clean', 'on-time', 'helpful staff'],
  'Professional Services': ['responsive', 'expert advice', 'transparent', 'reliable', 'value'],
  'Office / Coworking': ['fast wifi', 'quiet', 'well-lit', 'great location', 'friendly']
};
const PLANS_W = [{
  name: 'Starter',
  price: 1999,
  reviews: 100,
  days: 180
}, {
  name: 'Mini',
  price: 2499,
  reviews: 250,
  days: 365,
  value: true
}, {
  name: 'Pro',
  price: 3999,
  reviews: 500,
  days: 365,
  popular: true
}];
window.Wizard = ({
  onClose
}) => {
  const [step, setStep] = React.useState(1);
  const total = 4;
  const [d, setD] = React.useState({
    name: '',
    category: 'Restaurant / Cafe',
    sub: '',
    area: '',
    url: '',
    logo: null,
    tone: 'Friendly',
    lang: 'English',
    keywords: [],
    services: '',
    plan: 'Mini',
    owner: '',
    phone: '',
    email: '',
    ambassador: false
  });
  const set = (k, v) => setD(s => ({
    ...s,
    [k]: v
  }));
  const plan = PLANS_W.find(p => p.name === d.plan);
  const submit = () => onClose({
    name: d.name || 'New Business',
    sub: d.sub,
    category: d.category,
    city: d.area || 'Nashik',
    expiry: '—',
    total: plan.reviews,
    ambassador: d.ambassador
  });
  const next = () => step < total ? setStep(step + 1) : submit();
  const back = () => step > 1 ? setStep(step - 1) : onClose();
  const stepTitles = ['Business Info', 'Branding', 'Select Plan', 'Summary & Payment'];
  const stepSubs = ['Tell us about your business', 'Make reviews sound like you', 'Pick the right size pool', 'Review and complete payment'];
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-bg",
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    style: {
      maxWidth: step === 4 ? 720 : 640,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 24px 0',
      background: 'var(--surface)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, [1, 2, 3, 4].map(i => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 999,
      background: i < step ? 'var(--brand-purple)' : i === step ? 'var(--brand-purple)' : 'var(--bg-alt)',
      color: i <= step ? '#fff' : 'var(--fg-4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '600 11px/1 var(--font-sans)',
      boxShadow: i === step ? 'var(--shadow-purple-soft)' : 'none',
      transition: 'all 200ms'
    }
  }, i < step ? /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 11,
    strokeWidth: 3
  }) : i), i < 4 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 2,
      background: i < step ? 'var(--brand-purple)' : 'var(--bg-alt)',
      transition: 'background 200ms'
    }
  })))), /*#__PURE__*/React.createElement("button", {
    className: "modal-close",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 3,
      background: 'var(--bg-alt)',
      borderRadius: 999,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${step / total * 100}%`,
      background: 'var(--brand-purple)',
      transition: 'width 320ms var(--ease-out)',
      borderRadius: 999
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 24px 4px'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '700 22px/1.2 var(--font-sans)',
      margin: '0 0 4px',
      letterSpacing: '-.01em'
    }
  }, stepTitles[step - 1]), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px/1.4 var(--font-sans)',
      color: 'var(--fg-3)'
    }
  }, stepSubs[step - 1])), /*#__PURE__*/React.createElement("div", {
    className: "modal-body",
    style: {
      paddingTop: 14
    }
  }, step === 1 && /*#__PURE__*/React.createElement(Step1, {
    d: d,
    set: set
  }), step === 2 && /*#__PURE__*/React.createElement(Step2, {
    d: d,
    set: set
  }), step === 3 && /*#__PURE__*/React.createElement(Step3, {
    d: d,
    set: set
  }), step === 4 && /*#__PURE__*/React.createElement(Step4, {
    d: d,
    set: set,
    plan: plan
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-foot",
    style: {
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline",
    onClick: back
  }, step === 1 ? 'Cancel' : /*#__PURE__*/React.createElement(React.Fragment, null, "\u2190 Back")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, step === 4 && !d.ambassador && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline"
  }, "Save & pay later"), step < total ? /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: next
  }, "Continue ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 14
  })) : d.ambassador ? /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: submit,
    style: {
      background: 'var(--warning)',
      boxShadow: '0 4px 12px -2px rgba(217,119,6,.35)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gift",
    size: 14
  }), " Activate Free Access") : /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: submit
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14,
    strokeWidth: 2.6
  }), " Pay \u20B9", plan.price.toLocaleString('en-IN'))))));
};

// ── Step 1 ────────────────────────────────────────
const Step1 = ({
  d,
  set
}) => {
  const urlOk = d.url.includes('g.page') || d.url.includes('maps.app.goo') || d.url.includes('maps.google');
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    },
    className: "form-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Business name *"), /*#__PURE__*/React.createElement("input", {
    placeholder: "e.g. Sunset Cafe",
    value: d.name,
    onChange: e => set('name', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Category *"), /*#__PURE__*/React.createElement("select", {
    value: d.category,
    onChange: e => set('category', e.target.value)
  }, Object.keys(CATEGORY_KEYWORDS).map(c => /*#__PURE__*/React.createElement("option", {
    key: c
  }, c)))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Sub-category"), /*#__PURE__*/React.createElement("input", {
    placeholder: "e.g. Specialty coffee",
    value: d.sub,
    onChange: e => set('sub', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Service area"), /*#__PURE__*/React.createElement("input", {
    placeholder: "e.g. Bangalore, KA",
    value: d.area,
    onChange: e => set('area', e.target.value)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("label", null, "Google Review URL *"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "https://g.page/r/...",
    value: d.url,
    onChange: e => set('url', e.target.value),
    style: {
      paddingRight: d.url ? 90 : 12,
      borderColor: d.url ? urlOk ? 'var(--success)' : 'var(--danger)' : 'var(--line-strong)'
    }
  }), d.url && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'inline-flex',
      gap: 5,
      alignItems: 'center',
      font: '600 12px/1 var(--font-sans)',
      color: urlOk ? 'var(--success)' : 'var(--danger)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: urlOk ? 'check' : 'alert-triangle',
    size: 13,
    strokeWidth: 2.4
  }), urlOk ? 'Looks good' : 'Invalid')), /*#__PURE__*/React.createElement("small", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center',
      color: 'var(--fg-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "circle-dot",
    size: 12
  }), " Google Maps \u2192 Your business \u2192 Share \u2192 \"Ask for reviews\" \u2192 copy link")));
};

// ── Step 2 ────────────────────────────────────────
const Step2 = ({
  d,
  set
}) => {
  const [kw, setKw] = React.useState('');
  const addKw = k => {
    k = k.trim();
    if (k && !d.keywords.includes(k)) set('keywords', [...d.keywords, k]);
    setKw('');
  };
  const removeKw = k => set('keywords', d.keywords.filter(x => x !== k));
  const suggestions = (CATEGORY_KEYWORDS[d.category] || []).filter(s => !d.keywords.includes(s));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Logo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: 12,
      background: 'var(--bg-alt)',
      border: '1px dashed var(--line-strong)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--fg-4)',
      font: '500 11px/1.2 var(--font-sans)',
      textAlign: 'center'
    }
  }, d.logo ? /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 22
  }) : 'No logo'), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: () => set('logo', 'set')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 13,
    style: {
      transform: 'rotate(180deg)'
    }
  }), " Upload logo"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.4 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: 6
    }
  }, "PNG or SVG \xB7 we'll auto-extract a brand color for your QR card.")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14,
      marginTop: 14
    },
    className: "form-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Tone"), /*#__PURE__*/React.createElement("select", {
    value: d.tone,
    onChange: e => set('tone', e.target.value)
  }, Object.keys(TONE_SAMPLES).map(t => /*#__PURE__*/React.createElement("option", {
    key: t
  }, t)))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Language"), /*#__PURE__*/React.createElement("select", {
    value: d.lang,
    onChange: e => set('lang', e.target.value)
  }, /*#__PURE__*/React.createElement("option", null, "English"), /*#__PURE__*/React.createElement("option", null, "Hindi"), /*#__PURE__*/React.createElement("option", null, "Hinglish"), /*#__PURE__*/React.createElement("option", null, "Marathi"), /*#__PURE__*/React.createElement("option", null, "Tamil"), /*#__PURE__*/React.createElement("option", null, "Kannada")))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      background: 'var(--brand-purple-50)',
      border: '1px solid var(--brand-purple-200)',
      borderRadius: 12,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      width: 24,
      height: 24,
      borderRadius: 8,
      background: 'var(--brand-purple)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 13
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11px/1 var(--font-sans)',
      color: 'var(--brand-purple-700)',
      letterSpacing: '.04em',
      textTransform: 'uppercase',
      marginBottom: 4
    }
  }, "Sample in this tone"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px/1.5 var(--font-sans)',
      color: 'var(--fg)',
      fontStyle: 'italic'
    }
  }, "\"", TONE_SAMPLES[d.tone], "\""))), /*#__PURE__*/React.createElement("div", {
    className: "field",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("label", null, "Keywords ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg-4)',
      fontWeight: 400
    }
  }, "\xB7 what makes you special")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      padding: '8px 10px',
      border: '1px solid var(--line-strong)',
      borderRadius: 8,
      background: 'var(--surface)',
      minHeight: 42
    }
  }, d.keywords.map(k => /*#__PURE__*/React.createElement("span", {
    key: k,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 4px 3px 10px',
      background: 'var(--brand-purple-100)',
      color: 'var(--brand-purple-700)',
      borderRadius: 999,
      font: '500 12px/1.2 var(--font-sans)'
    }
  }, k, /*#__PURE__*/React.createElement("button", {
    onClick: () => removeKw(k),
    style: {
      background: 'none',
      border: 0,
      color: 'inherit',
      cursor: 'pointer',
      padding: '2px 4px',
      display: 'inline-flex',
      borderRadius: 999
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 11
  })))), /*#__PURE__*/React.createElement("input", {
    value: kw,
    onChange: e => setKw(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addKw(kw);
      }
    },
    placeholder: d.keywords.length ? '' : 'Type & press Enter…',
    style: {
      border: 0,
      outline: 0,
      flex: 1,
      minWidth: 120,
      font: '400 13px/1.4 var(--font-sans)',
      background: 'transparent'
    }
  })), suggestions.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11px/1.6 var(--font-sans)',
      color: 'var(--fg-4)'
    }
  }, "Suggested:"), suggestions.map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    onClick: () => addKw(s),
    style: {
      padding: '3px 9px',
      background: 'var(--surface)',
      border: '1px dashed var(--line-strong)',
      borderRadius: 999,
      font: '500 12px/1.2 var(--font-sans)',
      color: 'var(--fg-2)',
      cursor: 'pointer'
    }
  }, "+ ", s)))), /*#__PURE__*/React.createElement("div", {
    className: "field",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("label", null, "Services / Products ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg-4)',
      fontWeight: 400
    }
  }, "\xB7 optional")), /*#__PURE__*/React.createElement("input", {
    placeholder: "e.g. Haircut, Hair color, Pedicure",
    value: d.services,
    onChange: e => set('services', e.target.value)
  }), /*#__PURE__*/React.createElement("small", null, "When set, the review pool is split across services and customers can filter by service on the review page.")));
};

// ── Step 3 ────────────────────────────────────────
const Step3 = ({
  d,
  set
}) => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,1fr)',
    gap: 12
  },
  className: "form-row"
}, PLANS_W.map(p => {
  const sel = d.plan === p.name;
  const perReview = (p.price / p.reviews).toFixed(1);
  return /*#__PURE__*/React.createElement("div", {
    key: p.name,
    onClick: () => set('plan', p.name),
    style: {
      position: 'relative',
      border: '1px solid ' + (sel ? 'var(--brand-purple)' : 'var(--line)'),
      background: sel ? 'var(--brand-purple-50)' : 'var(--surface)',
      borderRadius: 14,
      padding: 16,
      cursor: 'pointer',
      boxShadow: sel ? 'var(--shadow-purple)' : 'var(--shadow-xs)',
      transition: 'all 200ms',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, p.popular && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -10,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--brand-purple)',
      color: '#fff',
      padding: '3px 10px',
      borderRadius: 999,
      font: '600 10px/1 var(--font-sans)',
      letterSpacing: '.04em',
      textTransform: 'uppercase'
    }
  }, "Most popular"), p.value && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -10,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--success)',
      color: '#fff',
      padding: '3px 10px',
      borderRadius: 999,
      font: '600 10px/1 var(--font-sans)',
      letterSpacing: '.04em',
      textTransform: 'uppercase'
    }
  }, "Best value"), sel && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 20,
      height: 20,
      borderRadius: 999,
      background: 'var(--brand-purple)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 11,
    strokeWidth: 3
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px/1 var(--font-sans)',
      color: 'var(--fg)'
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 28px/1 var(--font-sans)',
      color: 'var(--brand-purple)',
      letterSpacing: '-.02em'
    }
  }, "\u20B9", p.price.toLocaleString('en-IN')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 6,
      paddingTop: 10,
      borderTop: '1px solid ' + (sel ? 'var(--brand-purple-200)' : 'var(--line)'),
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 10px/1 var(--font-sans)',
      color: 'var(--fg-3)',
      marginBottom: 3
    }
  }, "Reviews"), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '600 13px/1 var(--font-sans)'
    }
  }, p.reviews)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 10px/1 var(--font-sans)',
      color: 'var(--fg-3)',
      marginBottom: 3
    }
  }, "Validity"), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '600 13px/1 var(--font-sans)'
    }
  }, p.days, "d"))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 11px/1 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: 4
    }
  }, "\u2248 \u20B9", perReview, " / review"));
})), /*#__PURE__*/React.createElement("div", {
  style: {
    padding: 14,
    background: 'var(--surface-2)',
    borderRadius: 12,
    marginTop: 16,
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start'
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: 'var(--success-bg)',
    color: 'var(--success)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement(Icon, {
  name: "check",
  size: 16,
  strokeWidth: 2.6
})), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    font: '600 13px/1.3 var(--font-sans)',
    color: 'var(--fg)'
  }
}, "Every plan includes"), /*#__PURE__*/React.createElement("div", {
  style: {
    font: '400 12px/1.5 var(--font-sans)',
    color: 'var(--fg-3)',
    marginTop: 2
  }
}, "Unlimited QR generation \xB7 AI tone variations \xB7 Multi-language reviews \xB7 Customer-side analytics"))));

// ── Step 4 ────────────────────────────────────────
const Step4 = ({
  d,
  set,
  plan
}) => {
  const validity = new Date(Date.now() + plan.days * 24 * 3600 * 1000).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      background: 'var(--brand-purple-50)',
      border: '1px solid var(--brand-purple-200)',
      borderRadius: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px/1 var(--font-sans)',
      color: 'var(--brand-purple-700)'
    }
  }, "Business details"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    style: {
      padding: '2px 8px'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "edit",
    size: 12
  }), " Edit")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 10,
      background: 'var(--surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--brand-purple)',
      boxShadow: 'var(--shadow-xs)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "store",
    size: 22
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 16px/1.2 var(--font-sans)'
    }
  }, d.name || 'Apple Cafe'), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.2 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: 2
    }
  }, d.category, " \xB7 ", d.area || 'Nashik'))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 8,
      paddingTop: 12,
      borderTop: '1px dashed var(--brand-purple-200)'
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    icon: "building",
    label: "Plan",
    value: plan.name
  }), /*#__PURE__*/React.createElement(Stat, {
    icon: "star",
    label: "Reviews",
    value: plan.reviews
  }), /*#__PURE__*/React.createElement(Stat, {
    icon: "clock",
    label: "Validity",
    value: validity
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 10,
      marginTop: 14
    },
    className: "form-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Owner name"), /*#__PURE__*/React.createElement("input", {
    value: d.owner,
    onChange: e => set('owner', e.target.value),
    placeholder: "Business owner"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Phone *"), /*#__PURE__*/React.createElement("input", {
    value: d.phone,
    onChange: e => set('phone', e.target.value),
    placeholder: "+91 98765 43210"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Email"), /*#__PURE__*/React.createElement("input", {
    value: d.email,
    onChange: e => set('email', e.target.value),
    placeholder: "owner@business.com"
  }))), /*#__PURE__*/React.createElement("small", {
    style: {
      font: '400 12px/1.4 var(--font-sans)',
      color: 'var(--fg-3)',
      marginTop: -4
    }
  }, "Payment SMS / email will be sent to these contacts."), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      border: '1px solid var(--warning-border)',
      borderRadius: 12,
      background: 'var(--warning-bg)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--warning)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gift",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px/1.2 var(--font-sans)',
      color: 'var(--warning)'
    }
  }, "Ambassador access ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 500
    }
  }, "\xB7 Free")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.4 var(--font-sans)',
      color: '#704c00'
    }
  }, "Get special access and benefits as an ambassador.")), /*#__PURE__*/React.createElement("span", {
    className: 'toggle-switch ' + (d.ambassador ? 'on' : ''),
    onClick: () => set('ambassador', !d.ambassador),
    role: "switch"
  })), d.ambassador && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      paddingTop: 10,
      borderTop: '1px dashed var(--warning-border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      color: '#704c00'
    }
  }, "Expiry date"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    defaultValue: "2026-11-03",
    style: {
      background: '#fff',
      borderColor: 'var(--warning-border)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      color: '#704c00'
    }
  }, "Review limit"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    defaultValue: "100",
    style: {
      background: '#fff',
      borderColor: 'var(--warning-border)'
    }
  })))), !d.ambassador ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      border: '1px solid var(--line)',
      borderRadius: 14,
      background: 'var(--surface)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px/1 var(--font-sans)',
      color: 'var(--fg)',
      marginBottom: 10
    }
  }, "Payment summary"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement(Row, {
    k: "Plan",
    v: plan.name
  }), /*#__PURE__*/React.createElement(Row, {
    k: "Reviews",
    v: plan.reviews
  }), /*#__PURE__*/React.createElement(Row, {
    k: "Validity",
    v: `${plan.days} days`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--line)',
      margin: '4px 0'
    }
  }), /*#__PURE__*/React.createElement(Row, {
    k: "Total payable",
    v: /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 22px/1 var(--font-sans)',
        color: 'var(--brand-purple)',
        letterSpacing: '-.01em'
      }
    }, "\u20B9", plan.price.toLocaleString('en-IN')),
    bold: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      marginTop: 12,
      padding: '10px 12px',
      background: 'var(--brand-purple-50)',
      borderRadius: 8,
      font: '500 12px/1 var(--font-sans)',
      color: 'var(--brand-purple-700)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 5,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12,
    strokeWidth: 2.6
  }), " Instant activation"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 5,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12,
    strokeWidth: 2.6
  }), " No hidden charges"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 5,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12,
    strokeWidth: 2.6
  }), " Refund within 7 days"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      border: '1px solid var(--success-border)',
      borderRadius: 14,
      background: 'var(--success-bg)',
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 10,
      background: '#fff',
      color: 'var(--success)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gift",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 15px/1.2 var(--font-sans)',
      color: 'var(--success)'
    }
  }, "This account is free ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 500,
      color: '#0e6c45'
    }
  }, "\xB7 no payment required")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.4 var(--font-sans)',
      color: '#0e6c45',
      marginTop: 2
    }
  }, "Ambassador-granted access. Activates instantly when you click below.")), /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '700 22px/1 var(--font-sans)',
      color: 'var(--success)',
      letterSpacing: '-.01em'
    }
  }, "\u20B90")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      font: '400 11px/1.4 var(--font-sans)',
      color: 'var(--fg-4)',
      display: 'flex',
      gap: 5,
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "circle-dot",
    size: 11
  }), " ", d.ambassador ? 'Granted via ambassador program' : 'Secure payment powered by trusted partners'));
};
const Stat = ({
  icon,
  label,
  value
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 8,
    alignItems: 'center'
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    width: 24,
    height: 24,
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--brand-purple)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement(Icon, {
  name: icon,
  size: 13
})), /*#__PURE__*/React.createElement("div", {
  style: {
    minWidth: 0
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    font: '400 10px/1 var(--font-sans)',
    color: 'var(--fg-3)',
    marginBottom: 2
  }
}, label), /*#__PURE__*/React.createElement("strong", {
  style: {
    font: '600 13px/1.2 var(--font-sans)',
    color: 'var(--fg)'
  }
}, value)));
const Row = ({
  k,
  v,
  bold
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    font: bold ? '600 14px/1 var(--font-sans)' : '500 13px/1 var(--font-sans)',
    color: bold ? 'var(--fg)' : 'var(--fg-2)'
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    color: bold ? 'var(--fg)' : 'var(--fg-3)'
  }
}, k), /*#__PURE__*/React.createElement("span", null, v));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/Wizard.jsx", error: String((e && e.message) || e) }); }

})();
