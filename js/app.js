/* ====== lilbrumessage · главная логика ====== */
(function () {
  "use strict";

  // ====== ХРАНИЛИЩЕ ======
  const LS_PROFILE = "gc_profile";
  const LS_SETTINGS = "gc_settings";
  const LS_CHATS = "gc_chats_v2";
  const LS_DRAFTS = "gc_msgdrafts";

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch { return fallback; }
    },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  };

  // ====== СОСТОЯНИЕ ======
  let profile = store.get(LS_PROFILE, null);
  if (profile) profile = { ...DEFAULT_PROFILE, ...profile };
  let savedSettings = store.get(LS_SETTINGS, {});
  if (!savedSettings.v || savedSettings.v < 4) {
    savedSettings = { ...savedSettings, v: 4, glass: DEFAULT_SETTINGS.glass, accent: DEFAULT_SETTINGS.accent };
  }
  let settings = { ...DEFAULT_SETTINGS, ...savedSettings };
  let chats = store.get(LS_CHATS, null) || [];
  let msgDrafts = store.get(LS_DRAFTS, {}) || {};
  const saveMsgDraft = (cid, text) => {
    if (cid == null) return;
    if (text && text.trim()) msgDrafts[cid] = text;
    else delete msgDrafts[cid];
    store.set(LS_DRAFTS, msgDrafts);
  };
  const replyIdx = new Map(chats.map(c => [c.id, 0]));
  if (chats.length) {
    CHAT_SEQ = Math.max(CHAT_SEQ, ...chats.flatMap(c => c.messages.map(m => m.id || 0)));
  }

  // ====== УТИЛИТЫ ======
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const nowTime = () => new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const chatById = id => chats.find(c => c.id === id);
  const nextChatId = () => (chats.length ? Math.max(...chats.map(c => c.id)) : 0) + 1;
  const contacts = () => chats.filter(c => !c.isGroup);
  const isPremium = () => !!(profile && profile.premium && profile.premium.until > Date.now());
  const saveChats = () => store.set(LS_CHATS, chats);
  const fmtSize = n => n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1).replace(".", ",") + " МБ" : n >= 1024 ? Math.round(n / 1024) + " КБ" : n + " Б";

  // ====== АВАТАРЫ (градиент или фото) ======
  const avatarCss = p => p && p.avatarImg
    ? `background:url('${p.avatarImg}') center/cover no-repeat, ${AVATAR_GRADIENTS[p.avatar != null ? p.avatar : 0]}`
    : `background:${AVATAR_GRADIENTS[p && p.avatar != null ? p.avatar : 0]}`;
  const avatarCls = p => (p && p.avatarImg ? " photo" : "");
  function readImgFile(file, cb, max) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const m = max || 320;
      const sc = Math.min(1, m / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * sc));
      c.height = Math.max(1, Math.round(img.height * sc));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      cb(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast("Не удалось прочитать фото"); };
    img.src = url;
  }
  const isGif = f => /\.gif$/i.test(f.name) || (f.type === "image/gif");
  function readRawFile(file, cb) {
    const rd = new FileReader();
    rd.onload = () => cb(rd.result);
    rd.onerror = () => toast("Не удалось прочитать файл");
    rd.readAsDataURL(file);
  }
  const bgImageCss = img => `linear-gradient(rgba(8,10,22,.45), rgba(8,10,22,.45)), url('${img}') center/cover no-repeat`;
  const bannerImageCss = img => `url('${img}') center/cover no-repeat`;
  function pfBannerStyle(p) {
    return p && p.bannerImg != null ? bannerImageCss(p.bannerImg)
      : p && p.banner != null ? BANNERS[p.banner] : "transparent";
  }
  const hasBanner = p => !!(p && (p.banner != null || p.bannerImg != null));

  const ICONS = {
    smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>',
    forward: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17l-5-5 5-5"/><path d="M4 12h9a6 6 0 0 1 6 6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
    paperclip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5l-9.3 9.3a5 5 0 0 1-7-7L13 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14.5 6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M9 4h6v5.2l2.2 2.6c.3.3.4.7.4 1V15c0 .4-.3.7-.7.7H13v4l-1 .9-1-.9v-4H7.1c-.4 0-.7-.3-.7-.7v-2.2c0-.3.1-.7.4-1L9 9.2z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1.2"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 6.4h-3.2l-1.9-2.4a1.6 1.6 0 0 0-1.3-.6H8.9a1.6 1.6 0 0 0-1.3.6L5.7 6.4H2.5A1.5 1.5 0 0 0 1 7.9v10.9a1.5 1.5 0 0 0 1.5 1.5h19a1.5 1.5 0 0 0 1.5-1.5V7.9a1.5 1.5 0 0 0-1.5-1.5zM12 16.7a4.7 4.7 0 1 1 0-9.4 4.7 4.7 0 0 1 0 9.4zm0-7.3a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.6" cy="8.6" r="1.6"/><path d="M21 15.2l-4.4-4.4L8 19.4"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="5" cy="12" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="19" cy="12" r="1.1" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>',
  };

  // ====== СОРТИРОВКА ПО СВЕЖЕСТИ (как в мессенджере) ======
  function parseTime(t) {
    if (!t) return 0;
    const d = new Date();
    if (String(t).includes("вчера")) d.setDate(d.getDate() - 1);
    const m = String(t).match(/(\d{1,2}):(\d{2})/);
    if (m) d.setHours(+m[1], +m[2], 0, 0);
    else d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const msgTs = m => (m.ts != null ? m.ts : parseTime(m.time || ""));
  const lastTs = c => { const l = c.messages[c.messages.length - 1]; return l ? msgTs(l) : 0; };
  const sortChats = () => chats.sort((a, b) =>
    ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || (lastTs(b) - lastTs(a)));

  // ====== ГРУППИРОВКА ПО ДНЯМ ======
  const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const dayKey = m => startOfDay(msgTs(m));
  function dayLabel(ts) {
    const d = new Date(ts);
    const diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
    if (diff === 0) return "Сегодня";
    if (diff === 1) return "Вчера";
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    });
  }

  function normalizeChats() {
    let changed = false;
    chats.forEach(c => c.messages.forEach(m => {
      if (m.ts == null) { m.ts = parseTime(m.time || ""); changed = true; }
    }));
    if (changed) saveChats();
  }

  // ====== ФОНОВЫЙ ТРАФИК (боты пишут сами) ======
  const typingChats = new Set();

  function simulateIncoming(chat) {
    if (!isLeader) return;
    const forActive = chat.id === activeId;
    const typingMs = 1400 + Math.random() * 1600;

    if (forActive) {
      showTyping();
    } else {
      typingChats.add(chat.id);
      renderChatList();
    }
    store.set(LS_TYPING, { chatId: chat.id, until: Date.now() + typingMs + 400 });

    setTimeout(() => {
      if (forActive) {
        hideTyping();
      } else {
        typingChats.delete(chat.id);
      }
      const phrases = chat.replies && chat.replies.length ? chat.replies : RANDOM_MSGS;
      const m = {
        id: seedMsgId(),
        from: "user",
        text: phrases[Math.floor(Math.random() * phrases.length)],
        time: nowTime(),
      };
      if (chat.isGroup) m.fromName = pickGroupAuthor(chat);
      addMsg(chat.id, m);
      setRead(chat.id);
      if (forActive) {
        const mEl = document.getElementById("messages");
        if (mEl) {
          const atBottom = mEl.scrollHeight - mEl.scrollTop - mEl.clientHeight < 60;
          sndIn();
          renderMessages(!atBottom);
          if (!atBottom) {
            if (unreadCut == null) unreadCut = chat.messages.length - 1;
            fabCount++;
            updateFab();
          }
        }
      } else {
        chatById(chat.id).unread = (chatById(chat.id).unread || 0) + 1;
        badgePopIds.add(chat.id);
        if (settings.sound) sndIn();
        flashNotify(chatById(chat.id), m.text || "Вложение 📎");
      }
      renderChatList();
    }, typingMs);
  }

  let trafficStarted = false;
  function startBackgroundTraffic() {
    if (trafficStarted) return;
    trafficStarted = true;
    const loop = () => setTimeout(() => {
      const pool = chats.filter(c => c.id !== activeId || Math.random() < 0.25);
      if (pool.length) {
        simulateIncoming(pool[Math.floor(Math.random() * pool.length)]);
      }
      loop();
    }, 25000 + Math.random() * 30000);
    loop();
  }

  // ====== СИСТЕМНЫЕ УВЕДОМЛЕНИЯ ======
  let notifyGranted = false;
  let notifyAsked = false;
  let pendingChatId = null;
  function requestNotify() {
    if (notifyAsked || !("Notification" in window)) return;
    notifyAsked = true;
    try {
      if (Notification.permission === "granted") notifyGranted = true;
      else if (Notification.permission === "default") {
        const p = Notification.requestPermission();
        if (p && p.then) p.then(r => { notifyGranted = r === "granted"; });
      }
    } catch {}
  }
  function openChatFromNotify(cid) {
    pendingChatId = cid;
    const r = (location.hash.replace(/^#\/?/, "") || "chat");
    if (r === "chat") renderChatView();
    else location.hash = "chat";
  }
  function flashNotify(chat, text) {
    if (!settings.notify || !notifyGranted || chat.id === activeId) return;
    try {
      const n = new Notification(chat.name + (chat.isGroup ? " · группа" : ""), {
        body: text || "Вложение 📎",
        tag: "lilbru-" + chat.id,
      });
      n.onclick = () => { window.focus(); openChatFromNotify(chat.id); n.close(); };
    } catch {}
  }

  // ====== СТАТУСЫ «ДОСТАВЛЕНО / ПРОЧИТАНО» ======
  function setRead(chatId) {
    const c = chatById(chatId);
    if (!c) return;
    let changed = false;
    c.messages.forEach(m => { if (m.from === "me" && m.status !== "read") { m.status = "read"; changed = true; } });
    if (changed) { saveChats(); renderChatList(); }
  }

  // Иногда бот «реагирует» на открытие чата
  function scheduleGreet() {
    setTimeout(() => {
      if (!isLeader || !chatById(activeId)) return;
      if (Math.random() < 0.45) simulateIncoming(chatById(activeId));
    }, 6000 + Math.random() * 6000);
  }

  let toastTimer;
  function toast(msg) {
    let el = $(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // ====== ЗВУК (WebAudio) ======
  let actx;
  function tone(freq, dur, type, gain, delay) {
    if (!settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      const t = actx.currentTime + (delay || 0);
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(gain || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + dur);
    } catch {}
  }
  const sndSend = () => tone(440, 0.12, "sine", 0.04);
  const sndIn = () => { tone(660, 0.12, "sine", 0.04); tone(880, 0.16, "sine", 0.04, 0.12); };
  const sndClick = () => tone(520, 0.06, "triangle", 0.03);

  // ====== ТЕМА ======
  const ACCENTS = [
    ["#8b5cf6", "#4c1d95"],
    ["#ff6b81", "#f5576c"],
    ["#43e97b", "#38f9d7"],
    ["#f6d365", "#fda085"],
    ["#36d1dc", "#5b86e5"],
    ["#fa709a", "#fee140"],
  ];
  const PREMIUM_ACCENTS = [
    ["#22d3ee", "#a855f7"],
    ["#fb923c", "#f43f5e"],
  ];

  // ====== ГОТОВЫЕ ТЕМЫ ======
  const DARK_TINT = {
    "text-primary": "#e9ebf2",
    "text-secondary": "rgba(220, 224, 240, .62)",
    "text-faint": "rgba(220, 224, 240, .34)",
    "bubble-other": "rgba(255, 255, 255, .055)",
    "bubble-other-border": "rgba(255, 255, 255, .08)",
    glass: "rgba(255, 255, 255, .035)",
    "glass-strong": "rgba(255, 255, 255, .055)",
    "glass-hover": "rgba(255, 255, 255, .09)",
    "glass-border": "rgba(255, 255, 255, .07)",
    "glass-solid": "rgba(21, 24, 36, .98)",
    "glass-frost": "rgba(24, 28, 42, .55)",
    "glass-surface": "#161a27",
    shadow: "0 10px 34px rgba(0, 0, 0, .3)",
    "shadow-soft": "0 2px 12px rgba(0, 0, 0, .18)",
    "input-bg": "rgba(255, 255, 255, .05)",
  };
  const LIGHT_TINT = {
    "text-primary": "#1b1e2e",
    "text-secondary": "rgba(27, 30, 46, .62)",
    "text-faint": "rgba(27, 30, 46, .38)",
    "bubble-other": "rgba(255, 255, 255, .8)",
    "bubble-other-border": "rgba(31, 36, 60, .1)",
    glass: "rgba(255, 255, 255, .55)",
    "glass-strong": "rgba(255, 255, 255, .7)",
    "glass-hover": "rgba(255, 255, 255, .85)",
    "glass-border": "rgba(31, 36, 60, .12)",
    "glass-solid": "rgba(250, 251, 255, .97)",
    "glass-frost": "rgba(250, 251, 255, .6)",
    "glass-surface": "rgba(255, 255, 255, .72)",
    shadow: "0 10px 34px rgba(50, 60, 100, .16)",
    "shadow-soft": "0 2px 12px rgba(50, 60, 100, .1)",
    "input-bg": "rgba(255, 255, 255, .65)",
  };
  const PRESET_THEMES = [
    { id: "system", label: "Авто", mode: "light", bg1: "#f0f1f6", bg2: "#13161f", blob1: "rgba(120,110,220,.06)", blob2: "rgba(80,130,220,.05)", blob3: "rgba(150,100,220,.04)" },
    { id: "dark", label: "Ночь", mode: "dark", bg1: "#0e1118", bg2: "#161b26", blob1: "rgba(110,120,200,.07)", blob2: "rgba(70,110,220,.06)", blob3: "rgba(130,90,200,.05)" },
    { id: "midnight", label: "Океан", mode: "dark", bg1: "#0d141f", bg2: "#142134", blob1: "rgba(60,130,200,.08)", blob2: "rgba(40,150,210,.06)", blob3: "rgba(50,90,180,.05)" },
    { id: "aurora", label: "Аврора", mode: "dark", bg1: "#0d1512", bg2: "#14241c", blob1: "rgba(40,150,110,.07)", blob2: "rgba(30,150,120,.06)", blob3: "rgba(60,120,190,.05)" },
    { id: "plum", label: "Сливы", mode: "dark", bg1: "#150f1c", bg2: "#231731", blob1: "rgba(130,90,200,.07)", blob2: "rgba(170,70,120,.05)", blob3: "rgba(110,80,200,.05)" },
    { id: "mono", label: "Моно", mode: "dark", bg1: "#121314", bg2: "#1c1d1f", blob1: "rgba(120,120,130,.06)", blob2: "rgba(90,90,100,.05)", blob3: "rgba(150,150,160,.04)" },
    { id: "light", label: "Свет", mode: "light", bg1: "#f4f5f9", bg2: "#e8ebf4", blob1: "rgba(120,110,220,.06)", blob2: "rgba(80,130,220,.05)", blob3: "rgba(150,100,220,.04)" },
    { id: "lavender", label: "Лаванда", mode: "light", bg1: "#f5f4fb", bg2: "#e9e6f7", blob1: "rgba(150,130,230,.06)", blob2: "rgba(170,170,230,.05)", blob3: "rgba(200,150,230,.04)" },
    { id: "sand", label: "Закат", mode: "light", bg1: "#f8f4ee", bg2: "#efe3d3", blob1: "rgba(200,140,90,.06)", blob2: "rgba(210,120,120,.05)", blob3: "rgba(200,160,110,.04)" },
    { id: "custom", label: "Свой цвет", mode: "dark", bg1: "", bg2: "", blob1: "", blob2: "", blob3: "" },
  ];
  const shade = (hex, f) => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return "#" + c.map(v => Math.round(Math.min(255, Math.max(0, v * f))).toString(16).padStart(2, "0")).join("");
  };
  const lumOf = hex => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };
  const mqDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
  const themeDef = () => {
    if (settings.theme === "system") return PRESET_THEMES.find(t => t.id === (mqDark() ? "dark" : "light"));
    return PRESET_THEMES.find(t => t.id === settings.theme && t.id !== "custom") || PRESET_THEMES[1];
  };
  const rgbaOf = (hex, a) => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  };

  function applyTheme() {
    const root = document.documentElement.style;
    root.setProperty("--accent-1", settings.accent[0]);
    root.setProperty("--accent-2", settings.accent[1]);
    root.setProperty("--blur", Math.min(28, Math.round(8 + settings.glass * 26)) + "px");

    const s = document.body.style;
    const custom = settings.theme === "custom" && settings.customBg;
    let t;

    if (custom) {
      const dark = lumOf(settings.customBg) < 0.55;
      t = {
        mode: dark ? "dark" : "light",
        bg1: settings.customBg,
        bg2: shade(settings.customBg, dark ? 1.22 : 0.82),
        blob1: rgbaOf(settings.accent[0], .07),
        blob2: rgbaOf(settings.accent[1], .06),
        blob3: rgbaOf(settings.accent[0], .05),
      };
    } else {
      t = themeDef();
    }

    const tint = t.mode === "dark" ? DARK_TINT : LIGHT_TINT;
    document.body.dataset.theme = t.mode;
    s.setProperty("--bg-1", t.bg1);
    s.setProperty("--bg-2", t.bg2);
    s.setProperty("--blob-1", t.blob1);
    s.setProperty("--blob-2", t.blob2);
    s.setProperty("--blob-3", t.blob3);
    Object.entries(tint).forEach(([k, v]) => s.setProperty(k, v));
    document.body.classList.toggle("frost", settings.glass >= 0.4);
    document.body.classList.toggle("no-anim", settings.anim === false);
    const sig = [t.mode, t.bg1, t.bg2, settings.accent[0], settings.accent[1]].join("|");
    if (sig !== lastThemeSig && settings.anim) {
      lastThemeSig = sig;
      document.body.classList.remove("theme-fade");
      void document.body.offsetWidth;
      document.body.classList.add("theme-fade");
    }
  }
  let lastThemeSig = "";
  applyTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (settings.theme === "system") applyTheme();
  });

  // ====== РОУТЕР ======
  const routes = { login: renderLogin, chat: renderChatView, profile: renderProfileView, settings: renderSettingsView, newchat: renderNewChatView, premium: renderPremiumView, contact: renderContactView };

  function onRoute() {
    const inp = $("#messageInput");
    if (inp && editMsgId == null) saveMsgDraft(activeId, inp.value);
    stopVoice();
    closeImageViewer();
    if (mediaRec) stopRec(false);
    const r = (location.hash.replace(/^#\/?/, "") || "chat");
    if (r === "login") { renderRoute(routes.login); return; }
    if (!profile) { location.hash = "login"; return; }
    renderRoute(routes[r] || routes.chat);
  }
  let viewSwitchSeq = 0;
  function renderRoute(fn) {
    const app = $("#app");
    const old = app && app.firstElementChild;
    const seq = ++viewSwitchSeq;
    if (!settings.anim || !old || !old.classList.contains("view")) { fn(); return; }
    old.classList.add("view-out");
    setTimeout(() => { if (seq === viewSwitchSeq) fn(); }, 120);
  }
  window.addEventListener("hashchange", onRoute);
  const go = r => { location.hash = r; };

  // ====== ПОПОВЕРЫ ======
  let pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } document.removeEventListener("click", onDocClick, true); }
  function onDocClick(e) {
    if (!(e.target instanceof Element)) return;
    if (pop && !pop.contains(e.target) && !e.target.closest(".pop-trigger")) closePop();
  }
  function openPop(anchor, build, pos) {
    closePop();
    closeCtx();
    const layer = document.createElement("div");
    layer.className = "pop-layer";
    layer.style.position = "fixed";
    build(layer);
    document.body.appendChild(layer);
    const r = pos ? { left: pos.x, top: pos.y, width: 0, height: 0 } : anchor.getBoundingClientRect();
    let left = Math.max(10, r.left + r.width / 2 - layer.offsetWidth / 2);
    left = Math.min(left, window.innerWidth - layer.offsetWidth - 10);
    layer.style.left = Math.max(10, left) + "px";
    layer.style.top = r.top - layer.offsetHeight - 8 + "px";
    if (parseFloat(layer.style.top) < 8) layer.style.top = r.bottom + 8 + "px";
    pop = layer;
    document.addEventListener("click", onDocClick, true);
    return layer;
  }

  document.addEventListener("keydown", e => { if (e.key === "Escape") { closePop(); closeCtx(); } });

  // ====== КОНТЕКСТНОЕ МЕНЮ (ПКМ) ======
  let ctxMenu = null;
  function closeCtx() {
    if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
    document.removeEventListener("click", onCtxDoc, true);
  }
  function onCtxDoc(e) {
    if (!(e.target instanceof Element)) return;
    if (ctxMenu && !ctxMenu.contains(e.target)) closeCtx();
  }
  function openCtxMenu(x, y, items) {
    closePop();
    closeCtx();
    const menu = document.createElement("div");
    menu.className = "ctx-menu";
    menu.innerHTML = items.map((it, i) => it.sep
      ? '<div class="ctx-sep"></div>'
      : `<button class="ctx-item${it.danger ? " danger" : ""}" data-i="${i}">${it.icon || ""}<span>${it.label}</span></button>`).join("");
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + "px";
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + "px";
    ctxMenu = menu;
    document.addEventListener("click", onCtxDoc, true);
    menu.addEventListener("click", e => {
      const b = e.target.closest(".ctx-item");
      if (!b) return;
      const it = items[+b.dataset.i];
      closeCtx();
      it.action();
    });
    return menu;
  }
  document.addEventListener("scroll", () => closeCtx(), true);
  window.addEventListener("resize", () => closeCtx());

  // ====== ПОДТВЕРЖДЕНИЕ ======
  function confirmBox(title, text, onOk, okLabel = "Удалить") {
    closePop();
    closeCtx();
    const layer = document.createElement("div");
    layer.className = "confirm-mask";
    layer.innerHTML = `
      <div class="confirm-pop glass">
        <h3>${esc(title)}</h3>
        <p>${esc(text)}</p>
        <div class="confirm-actions">
          <button class="btn ghost" data-act="no">Отмена</button>
          <button class="btn danger" data-act="ok">${esc(okLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(layer);
    layer.addEventListener("click", e => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      layer.remove();
      if (b.dataset.act === "ok") onOk();
    });
  }

  function copyText(t) {
    const done = () => toast("Скопировано в буфер");
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      ta.remove();
      done();
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(t).then(done).catch(fallback);
    } else fallback();
  }

  // ====== СТРАНИЦА: ЛОГИН ======
  function renderLogin() {
    let draft = { ...DEFAULT_PROFILE };
    const savedDraft = store.get("gc_draft", null);
    if (savedDraft) draft = savedDraft;

    $("#app").innerHTML = `
      <div class="view">
        <div class="auth-wrap">
          <div class="auth-card glass">
            <div class="logo">lilbru<span>message</span></div>
            <div class="subtitle">Современный мессенджер в стиле glassmorphism</div>
            <div class="avatar-pick">
              <div class="auth-avatar avatar${avatarCls(draft)}" id="loginAvatar" style="${avatarCss(draft)}">${esc(draft.name[0] || "Я")}</div>
              <button type="button" class="cam-btn" id="loginCam" title="Загрузить фото">${ICONS.camera}</button>
              <input type="file" id="loginAvatarFile" accept="image/*" hidden>
            </div>
            <div class="gradient-grid" id="loginGrid">
              ${AVATAR_GRADIENTS.map((g, i) =>
                `<button type="button" class="gradient-swatch ${i === draft.avatar ? "active" : ""}" data-i="${i}" style="background:${g}"></button>`).join("")}
            </div>
            <div class="form-stack">
              <div class="field">
                <label>Ваше имя</label>
                <input id="loginName" type="text" maxlength="24" value="${esc(draft.name)}" placeholder="Как вас зовут?">
              </div>
              <div class="field">
                <label>Статус</label>
                <select id="loginStatus">
                  <option>В сети</option>
                  <option>Не беспокоить</option>
                  <option>Вне сети</option>
                </select>
              </div>
              <div class="auth-actions">
                <button class="btn" id="loginBtn">Войти в lilbrumessage</button>
                <button class="btn ghost" id="loginDemo">Посмотреть демо без входа</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    const nameIn = $("#loginName"), grid = $("#loginGrid"), ava = $("#loginAvatar");
    grid.addEventListener("click", e => {
      const s = e.target.closest(".gradient-swatch");
      if (!s) return;
      draft.avatar = Number(s.dataset.i);
      grid.querySelectorAll(".gradient-swatch").forEach(x => x.classList.remove("active"));
      s.classList.add("active");
      ava.style.background = avatarCss(draft);
      ava.textContent = (nameIn.value.trim() || "Я")[0];
      sndClick();
    });
    nameIn.addEventListener("input", () => {
      draft.name = nameIn.value.trim() || "Вы";
      ava.textContent = (draft.name)[0];
      store.set("gc_draft", draft);
    });
    const loginCam = $("#loginCam"), loginFile = $("#loginAvatarFile");
    if (loginCam) {
      loginCam.addEventListener("click", () => loginFile.click());
      loginFile.addEventListener("change", e => {
        const f = e.target.files[0];
        if (f) readImgFile(f, data => {
          draft.avatarImg = data;
          ava.style.background = `url('${data}') center/cover no-repeat, ${AVATAR_GRADIENTS[draft.avatar]}`;
          ava.classList.add("photo");
          store.set("gc_draft", draft);
          sndClick();
        });
        loginFile.value = "";
      });
    }
    $("#loginStatus").addEventListener("change", () => { draft.status = $("#loginStatus").value; });

    const enter = () => {
      profile = { name: nameIn.value.trim() || "Вы", avatar: draft.avatar, avatarImg: draft.avatarImg || null, status: $("#loginStatus").value };
      store.set(LS_PROFILE, profile);
      store.set("gc_draft", null);
      requestNotify();
      toast("Добро пожаловать, " + profile.name + "!");
      sndSend();
      go("chat");
    };
    $("#loginBtn").addEventListener("click", enter);
    $("#loginDemo").addEventListener("click", enter);
    nameIn.addEventListener("keydown", e => { if (e.key === "Enter") enter(); });
    nameIn.focus();
  }

  // ====== СТРАНИЦА: ЧАТ ======
  let activeId = null;
  let unreadCut = null;
  let fabCount = 0;
  let selMode = false;
  let selSet = new Set();
  let lastTouchTime = 0;
  let suppressClick = false;

  function renderChatView() {
    if (pendingChatId != null && chatById(pendingChatId)) {
      activeId = chatById(pendingChatId).id;
      pendingChatId = null;
    }
    if (!activeId || !chatById(activeId)) activeId = chats.length ? chats[0].id : null;
    const noChat = activeId == null;
    requestNotify();
    stopVoice();
    searchActive = false; searchQuery = ""; searchMatches = []; searchIdx = 0;
    unreadCut = null;
    fabCount = 0;
    selMode = false;
    selSet.clear();

    $("#app").innerHTML = `
      <div class="view">
        <div class="chat-layout">
          <nav class="nav-rail glass">
            <div class="rail-logo" title="lilbrumessage">💬</div>
            <div class="rail-mid">
              <button class="rail-btn" id="navNew" title="Новая группа">${ICONS.plus}</button>
              <button class="rail-btn" id="navProfile" title="Профиль">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>
              </button>
            </div>
            <div class="rail-bottom">
              <button class="rail-btn" id="navSettings" title="Настройки">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/></svg>
              </button>
              <button class="rail-btn" id="navTheme" title="Переключить тему">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>
              </button>
            </div>
          </nav>

          <aside class="sidebar glass">
            <div class="search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
              <input id="searchInput" placeholder="Поиск по чатам...">
            </div>
            <ul class="chat-list" id="chatList"></ul>
            <div class="sidebar-footer" id="sidebarFooter">
              <div class="avatar${avatarCls(profile)}" style="${avatarCss(profile)}">${esc(profile.name[0])}</div>
              <div>
                <div class="me-name">${esc(profile.name)}${isPremium() ? ' <span class="prem-badge" title="lilbru+ Premium">⭐</span>' : ""}</div>
                <div class="me-status">${esc(profile.status)}</div>
              </div>
            </div>
          </aside>

          ${noChat ? `
          <main class="chat-panel glass">
            <div class="empty-state">
              <div class="icon">💬</div>
              <h2>Добро пожаловать в lilbrumessage</h2>
              <p>У вас пока нет чатов. Создайте группу, чтобы начать общение.</p>
              <button class="btn" id="emptyNewChat">Создать группу</button>
            </div>
          </main>` : `
          <main class="chat-panel glass">
            <header class="chat-header" id="chatHeader"></header>
            <div class="chat-search" id="chatSearch" hidden>
              ${ICONS.search}
              <input id="searchInChat" placeholder="Поиск по сообщениям..." autocomplete="off">
              <span class="search-count" id="searchCount"></span>
              <button type="button" class="sbtn" id="searchPrev" title="Предыдущее">↑</button>
              <button type="button" class="sbtn" id="searchNext" title="Следующее">↓</button>
              <button type="button" class="sbtn" id="searchClose" title="Закрыть">${ICONS.close}</button>
            </div>
            <div class="messages" id="messages"></div>
            <div class="sel-bar" id="selBar">
              <span class="sel-count" id="selCount"></span>
              <button class="btn ghost danger" id="selDelete">Удалить</button>
              <button class="icon-btn" id="selClose" title="Отмена">${ICONS.close}</button>
            </div>
            <button class="fab-down" id="fabDown" title="К последнему сообщению" aria-label="Вниз">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>
              <span class="fab-count" id="fabCount"></span>
            </button>
            <div class="typing" id="typing">
              <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
            </div>
            <form class="composer" id="composer">
              <div class="reply-bar" id="replyBar">
                <div class="rq" id="replyQuote"></div>
                <button type="button" class="close-reply" id="replyClose" title="Отменить">✕</button>
              </div>
              <div class="rec-bar" id="recBar">
                <span class="rec-dot"></span>
                <span class="rec-timer" id="recTimer">0:00</span>
                <span class="rec-hint">Запись голосового</span>
                <button type="button" class="rec-cancel" id="recCancel" title="Отменить">${ICONS.close}</button>
                <button type="button" class="rec-send" id="recSend" title="Отправить">✓</button>
              </div>
              <button type="button" class="emoji-btn pop-trigger" id="emojiBtn" title="Эмодзи">${ICONS.smile}</button>
              <div class="input-wrap">
                <textarea id="messageInput" rows="1" placeholder="Написать сообщение..." autocomplete="off"></textarea>
                <button type="button" class="clear-input" id="clearInput" title="Очистить">${ICONS.close}</button>
              </div>
              <button type="button" class="attach-btn" id="attachBtn" title="Вложение">${ICONS.paperclip}</button>
              <input type="file" id="fileInput" multiple>
              <button type="button" class="mic-btn" id="micBtn" title="Голосовое сообщение">${ICONS.mic}</button>
              <button class="send-btn" id="sendBtn" type="submit" disabled title="Отправить">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            </form>
          </main>`}

          <aside class="detail-panel glass" id="detailPanel">
            <div class="detail-inner" id="detailInner"></div>
          </aside>
          <div class="sidebar-scrim" id="sidebarScrim"></div>
        </div>
      </div>`;

    clearReply();
    editMsgId = null;
    bindSidebar();
    const emptyNew = $("#emptyNewChat");
    if (emptyNew) { emptyNew.addEventListener("click", () => go("newchat")); return; }
    bindChat();
  }

  function updateSendBtn() {
    const inp = $("#messageInput"), btn = $("#sendBtn"), clr = $("#clearInput");
    if (!inp || !btn) return;
    const has = inp.value.trim() !== "";
    btn.disabled = !has;
    if (clr) clr.classList.toggle("show", inp.value.length > 0);
  }

  function previewOf(chat) {
    if (typingChats.has(chat.id)) return '<span class="typing-preview">печатает…</span>';
    const d = msgDrafts[chat.id];
    if (d) return `<span class="draft-preview">Черновик: ${esc(d)}</span>`;
    const last = chat.messages[chat.messages.length - 1];
    if (!last) return '<span class="sk-text"></span>';
    let t = esc(last.text);
    if (last.attachment) {
      const k = last.attachment.kind;
      t = k === "image" ? "📷 Фото" : k === "voice" ? "🎤 Голосовое" : "📎 " + esc(last.attachment.name);
    }
    if (last.from === "me") t = "Вы: " + t;
    else if (chat.isGroup) t = esc(last.fromName || chat.name) + ": " + t;
    return t;
  }

  function ticksHtml(m) {
    const s = m.status || "delivered";
    if (s === "sent") return '<span class="ticks"><i class="t1">✓</i></span> ';
    if (s === "read") return '<span class="ticks read"><i class="t1">✓</i><i class="t2 on">✓</i></span> ';
    return '<span class="ticks"><i class="t1">✓</i><i class="t2 on">✓</i></span> ';
  }

  let listRenderQueued = false;
  let archiveOpen = false;
  function renderChatList() {
    const doRender = () => {
      listRenderQueued = false;
      const el = $("#chatList");
      if (!el) return;
      sortChats();
      const q = ($("#searchInput") && $("#searchInput").value.trim().toLowerCase()) || "";
      const norm = chats.filter(c => !c.archived && (!q || c.name.toLowerCase().includes(q)));
      const arc = chats.filter(c => c.archived && (!q || c.name.toLowerCase().includes(q)));
      const itemHtml = c => {
        const last = c.messages[c.messages.length - 1];
        const online = c.status === "в сети";
        return `
        <li class="chat-item ${c.id === activeId ? "active" : ""}${c.archived ? " archived" : ""}" data-id="${c.id}">
          <div class="avatar" style="background:${AVATAR_GRADIENTS[c.avatar]}">${esc(c.name[0])}${online ? '<span class="status-dot"></span>' : ""}</div>
          <div class="chat-meta">
            <div class="chat-name">${c.pinned ? `<span class="pin-tag">${ICONS.pin}</span> ` : ""}${esc(c.name)}</div>
            <div class="chat-preview">${previewOf(c)}</div>
          </div>
          <div class="chat-side">
            <div class="side-row">
              ${c.pinned ? `<button class="pin-btn on" data-pin="${c.id}" title="Открепить">${ICONS.pin}</button>` : ""}
              <span class="chat-time">${last ? esc(last.time) : ""}</span>
            </div>
            ${c.unread ? `<span class="chat-badge${badgePopIds.has(c.id) ? " pop" : ""}">${c.unread}</span>` : ""}
          </div>
        </li>`;
      };
      let html = norm.map(itemHtml).join("");
      if (arc.length) {
        const arcUnread = arc.reduce((s, c) => s + (c.unread || 0), 0);
        html += `        <li class="archive-divider">
          ${ICONS.archive}<span>Архив</span><span class="archive-count">${arc.length}</span>
          ${arcUnread ? `<span class="chat-badge">${arcUnread}</span>` : ""}
        </li>`;
        if (archiveOpen || q) html += arc.map(itemHtml).join("");
      }
      el.innerHTML = html || `<li class="chat-item" style="cursor:default"><div class="chat-preview">Ничего не найдено</div></li>`;
      badgePopIds.clear();
    };
    if (listRenderQueued) return;
    listRenderQueued = true;
    if (requestAnimationFrame) requestAnimationFrame(doRender);
    else doRender();
  }

  function attachHtml(a) {
    return `<div class="attach"><span class="file-icon">📄</span><span><div class="file-name">${esc(a.name)}</div><div class="file-size">${esc(a.size)}</div></span></div>`;
  }

  // ====== ФОТО / ГОЛОС / ПОИСК / ПРОСМОТР ======
  let searchActive = false, searchQuery = "", searchMatches = [], searchIdx = 0;
  let voiceAudio = null, voiceMsgId = null;
  let mediaRec = null, recStream = null, recChunks = [], recStartTs = 0, recTick = null, recCommit = false;
  let badgePopIds = new Set();

  const fmtDur = s => { s = Math.round(s || 0); return (s / 60 | 0) + ":" + String(s % 60).padStart(2, "0"); };

  function imageHtml(a) {
    return `<div class="attach-image" title="Открыть">
      <img src="${a.src}" alt="${esc(a.name)}" loading="lazy">
    </div>`;
  }

  function voiceHtml(a, msgId) {
    let bars = "";
    for (let i = 0; i < 28; i++) {
      const h = 24 + Math.abs(Math.sin(i * 1.7) * 52) + ((i * 37) % 21);
      bars += `<i style="height:${Math.round(h)}%;animation-delay:${(i % 7) * 0.12}s"></i>`;
    }
    return `<div class="voice">
      <button type="button" class="voice-play" data-voice="${msgId}" title="Воспроизвести">${ICONS.play}</button>
      <div class="voice-wave">${bars}</div>
      <span class="voice-time">${fmtDur(a.duration)}</span>
    </div>`;
  }

  function setVoicePlaying(on) {
    document.querySelectorAll(".voice-wave").forEach(w => {
      const p = w.closest(".voice");
      w.classList.toggle("playing", on && !!p && p.querySelector(".voice-play").dataset.voice === voiceMsgId);
    });
    document.querySelectorAll(".voice-play").forEach(b => {
      b.innerHTML = (on && b.dataset.voice === voiceMsgId) ? ICONS.pause : ICONS.play;
    });
  }
  function stopVoice() {
    if (voiceAudio) { try { voiceAudio.pause(); } catch {} voiceAudio = null; }
    voiceMsgId = null;
    document.querySelectorAll(".voice-wave").forEach(w => w.classList.remove("playing"));
    document.querySelectorAll(".voice-play").forEach(b => b.innerHTML = ICONS.play);
  }
  function toggleVoice(btn) {
    const msg = chatById(activeId).messages.find(m => m.id === Number(btn.dataset.voice));
    if (!msg || !msg.attachment || msg.attachment.kind !== "voice") return;
    if (voiceMsgId === msg.id && voiceAudio) {
      if (!voiceAudio.paused) { voiceAudio.pause(); setVoicePlaying(false); return; }
      voiceAudio.play().then(() => setVoicePlaying(true)).catch(() => {});
      return;
    }
    stopVoice();
    voiceAudio = new Audio(msg.attachment.src);
    voiceMsgId = msg.id;
    voiceAudio.onended = () => setVoicePlaying(false);
    voiceAudio.onerror = () => { toast("Не удалось воспроизвести"); stopVoice(); };
    voiceAudio.play().then(() => setVoicePlaying(true)).catch(() => { toast("Не удалось воспроизвести"); });
  }

  function openImageViewer(att) {
    closeImageViewer();
    const ov = document.createElement("div");
    ov.className = "img-viewer";
    ov.innerHTML = `<div class="img-viewer-bg"></div>
      <button type="button" class="img-viewer-close" title="Закрыть">${ICONS.close}</button>
      <img class="img-viewer-img" src="${att.src}" alt="${esc(att.name)}">`;
    document.body.appendChild(ov);
    const img = ov.querySelector(".img-viewer-img");
    let zoom = 1;
    const applyZoom = () => {
      img.style.transform = zoom > 1 ? `scale(${zoom})` : "";
      img.classList.toggle("zoom", zoom > 1);
    };
    img.addEventListener("click", () => { zoom = zoom > 1 ? 1 : 2; applyZoom(); });
    ov.addEventListener("wheel", e => {
      e.preventDefault();
      zoom = Math.max(1, Math.min(4, zoom + (e.deltaY < 0 ? 0.25 : -0.25)));
      applyZoom();
    }, { passive: false });
    const close = () => {
      ov.classList.add("closing");
      setTimeout(() => ov.remove(), 180);
    };
    ov.querySelector(".img-viewer-close").addEventListener("click", close);
    ov.addEventListener("click", e => { if (e.target === ov || e.target.classList.contains("img-viewer-bg")) close(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape" && ov.isConnected) { close(); document.removeEventListener("keydown", esc); }
    });
  }
  function closeImageViewer() {
    document.querySelectorAll(".img-viewer").forEach(v => v.remove());
  }

  function applyChatSearch() {
    const chat = chatById(activeId);
    const q = searchQuery.trim().toLowerCase();
    searchMatches = [];
    if (q && chat) {
      chat.messages.forEach((m, i) => { if (m.text && m.text.toLowerCase().includes(q)) searchMatches.push(i); });
    }
    if (searchIdx >= searchMatches.length) searchIdx = Math.max(0, searchMatches.length - 1);
    if (searchIdx < 0) searchIdx = 0;
    renderMessages(true);
    updateSearchCount();
    jumpToMatch();
  }
  function updateSearchCount() {
    const el = $("#searchCount");
    if (el) el.textContent = searchMatches.length ? `${searchIdx + 1} / ${searchMatches.length}` : (searchQuery ? "Нет совпадений" : "");
  }
  function jumpToMatch() {
    const chat = chatById(activeId);
    if (!chat || !searchMatches.length) return;
    const m = chat.messages[searchMatches[searchIdx]];
    if (!m) return;
    const el = $(`.msg[data-id="${m.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: settings.anim ? "smooth" : "auto", block: "center" });
      el.classList.add("flash");
      el.addEventListener("animationend", () => el.classList.remove("flash"), { once: true });
    }
  }
  function searchStep(d) {
    if (!searchMatches.length) return;
    searchIdx = (searchIdx + d + searchMatches.length) % searchMatches.length;
    renderMessages(true);
    updateSearchCount();
    jumpToMatch();
  }
  function closeChatSearch() {
    searchActive = false;
    searchQuery = "";
    searchMatches = [];
    const ov = $("#chatSearch");
    if (ov) ov.hidden = true;
    const inp = $("#searchInChat");
    if (inp) inp.value = "";
  }

  function fmtRec() { const s = Math.floor((Date.now() - recStartTs) / 1000); return (s / 60 | 0) + ":" + String(s % 60).padStart(2, "0"); }
  function startRec() {
    if (mediaRec) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { toast("Запись голосовых не поддерживается браузером"); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      recStream = stream;
      recChunks = [];
      let mime = "";
      try {
        const t = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
        for (const m of t) if (MediaRecorder.isTypeSupported(m)) { mime = m; break; }
      } catch {}
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRec = rec;
      rec.ondataavailable = e => { if (e.data && e.data.size) recChunks.push(e.data); };
      rec.onstop = () => {
        if (recCommit && recChunks.length) {
          const blob = new Blob(recChunks, { type: rec.mimeType || "audio/webm" });
          const dur = Math.max(1, Math.round((Date.now() - recStartTs) / 1000));
          const rd = new FileReader();
          rd.onload = () => send("", { kind: "voice", src: rd.result, duration: dur });
          rd.onerror = () => toast("Не удалось сохранить запись");
          rd.readAsDataURL(blob);
        }
        recChunks = [];
        recCommit = false;
      };
      rec.start();
      recStartTs = Date.now();
      const comp = $("#composer");
      if (comp) comp.classList.add("recording");
      const bar = $("#recBar");
      if (bar) bar.classList.add("show");
      const tim = $("#recTimer");
      if (tim) tim.textContent = "0:00";
      clearInterval(recTick);
      recTick = setInterval(() => { const t = $("#recTimer"); if (t) t.textContent = fmtRec(); }, 250);
      sndClick();
    }).catch(() => toast("Нет доступа к микрофону"));
  }
  function stopRec(commit) {
    if (!mediaRec) return;
    recCommit = commit;
    try { mediaRec.stop(); } catch {}
    clearInterval(recTick);
    mediaRec = null;
    if (recStream) { recStream.getTracks().forEach(t => t.stop()); recStream = null; }
    const comp = $("#composer");
    if (comp) comp.classList.remove("recording");
    const bar = $("#recBar");
    if (bar) bar.classList.remove("show");
  }

  function actionsHtml(m, own) {
    return `<div class="msg-actions">
      <button class="mini-btn" data-act="reply" title="Ответить">${ICONS.reply}</button>
      <button class="mini-btn pop-trigger" data-act="react" title="Реакция">${ICONS.smile}</button>
      <button class="mini-btn pop-trigger" data-act="fwd" title="Переслать">${ICONS.forward}</button>
      ${own ? `<button class="mini-btn" data-act="edit" title="Редактировать">${ICONS.edit}</button><button class="mini-btn danger" data-act="del" title="Удалить">${ICONS.trash}</button>` : ""}
    </div>`;
  }

  function reactionsHtml(m) {
    const rs = Object.entries(m.reactions || {});
    if (!rs.length) return "";
    return `<div class="msg-reactions">` + rs.map(([e, c]) =>
      `<button class="reaction-chip ${m.myReact === e ? "mine" : ""}" data-emoji="${e}">${e}<span class="count">${c}</span></button>`).join("") + `</div>`;
  }

  const renderedIds = new Set();
  const GROUP_GAP = 5 * 60000;

  function renderMessages(keepScroll) {
    const chat = chatById(activeId);
    const el = $("#messages");
    if (!el) return;

    if (!chat.messages.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="icon">💬</div>
          <div>Пока нет сообщений<br><small>Напишите первым!</small></div>
        </div>`;
      return;
    }

    const q = searchActive ? searchQuery.trim().toLowerCase() : "";
    const qRe = q ? new RegExp("(" + esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi") : null;
    const msgs = chat.messages;
    let freshSeq = 0;
    let html = "";
    let lastDay = null;

    // Анимируем только последние N новых сообщений, чтобы не проигрывать всю ленту
    const newIdxs = [];
    msgs.forEach((m, i) => { if (!renderedIds.has(m.id)) newIdxs.push(i); });
    const animIdx = new Set(newIdxs.length > 6 ? newIdxs.slice(-6) : newIdxs);

    msgs.forEach((m, i) => {
      const own = m.from === "me";
      const dk = dayKey(m);
      if (dk !== lastDay) {
        html += `<div class="day-divider">${dayLabel(msgTs(m))}</div>`;
        lastDay = dk;
      }
      if (unreadCut === i) html += `<div class="unread-divider"><span>Непрочитанные сообщения</span></div>`;

      const prev = msgs[i - 1];
      const next = msgs[i + 1];
      const sameGroup = prev && prev.from === m.from && dayKey(prev) === dk && (m.ts - (prev.ts || 0)) < GROUP_GAP;
      const nextInGroup = next && next.from === m.from && dayKey(next) === dk && ((next.ts || 0) - m.ts) < GROUP_GAP;
      const isStart = !sameGroup;
      const isEnd = !nextInGroup;

      const isNew = !renderedIds.has(m.id);
      if (isNew) renderedIds.add(m.id);
      const anim = isNew && animIdx.has(i);
      const delay = anim ? ` style="animation-delay:${Math.min((freshSeq++) * 0.04, 0.2)}s"` : "";

      let txt = esc(m.text);
      if (qRe && m.text) txt = txt.replace(qRe, "<mark class=\"hit\">$1</mark>");
      const isCur = !!qRe && searchMatches[searchIdx] === i;
      const attach = m.attachment
        ? (m.attachment.kind === "image" ? imageHtml(m.attachment)
          : m.attachment.kind === "voice" ? voiceHtml(m.attachment, m.id)
          : attachHtml(m.attachment))
        : "";

      html += `<div class="msg ${own ? "own" : "other"}${anim ? " anim" : ""}${isStart ? " g-start" : ""}${isEnd ? " g-end" : ""}${isCur ? " hit-current" : ""}${selMode ? " sel" : ""}${selMode && selSet.has(m.id) ? " picked" : ""}" data-id="${m.id}"${delay}>
        ${selMode ? `<i class="sel-check${selSet.has(m.id) ? " on" : ""}">${ICONS.check}</i>` : ""}
        ${m.forwarded ? '<span class="msg-name">⟳ Переслано</span>' : ""}
        ${!own && isStart ? `<span class="msg-name">${esc(m.fromName || chat.name)}</span>` : ""}
        <div class="bubble">
          ${m.quote ? `<div class="quote"><strong>${esc(m.quote.name)}</strong><span>${esc(m.quote.text || "Вложение")}</span></div>` : ""}
          ${txt}${attach}
        </div>
        ${actionsHtml(m, own)}
        ${reactionsHtml(m)}
        ${isEnd ? `<span class="msg-time">${own ? ticksHtml(m) : ""}${esc(m.time)}${m.edited ? '<em class="edited">изменено</em>' : ""}</span>` : ""}
      </div>`;
    });

    el.innerHTML = html;
    el.querySelectorAll(".msg.anim").forEach(node => {
      node.addEventListener("animationend", () => node.classList.remove("anim"), { once: true });
    });
    if (!keepScroll) scrollBottom(true);
  }

  function renderChatHeader() {
    const chat = chatById(activeId);
    $("#chatHeader").innerHTML = `
      <button class="icon-btn chat-back" id="chatBack" title="Назад">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
      </button>
      <div class="avatar" style="background:${AVATAR_GRADIENTS[chat.avatar]}">${esc(chat.name[0])}${chat.status === "в сети" ? '<span class="status-dot"></span>' : ""}</div>
      <div class="chat-title">
        <div class="name">${esc(chat.name)}</div>
        <div class="status">${chat.status === "в сети" ? '<i></i>' : ""}<span>${esc(chat.status)}</span></div>
        ${chat.pinnedMsg ? `<div class="pinned-line" title="${esc(chat.pinnedMsg.text)}">${ICONS.pin}<span><strong>${esc(chat.pinnedMsg.name)}</strong> ${esc(chat.pinnedMsg.text)}</span></div>` : ""}
      </div>
      <button class="icon-btn" id="searchOpenBtn" title="Поиск по сообщениям">${ICONS.search}</button>
      ${chat.messages.length ? `<button class="icon-btn ${selMode ? "on" : ""}" id="selBtn" title="${selMode ? "Отменить выбор" : "Выбрать сообщения"}">${ICONS.check}</button>` : ""}
      <button class="icon-btn" id="detailToggle" title="Информация о чате">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 5h.01M12 12h.01M12 19h.01"/></svg>
      </button>`;
  }

  function scrollBottom(instant) {
    const el = $("#messages");
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }

  // Скелетон при открытии «большого» чата
  function skeletonHtml() {
    const w = [42, 58, 50, 64, 46, 55, 60, 48];
    return w.map((wi, i) =>
      `<div class="sk-row${i % 2 ? " right" : ""}" style="--w:${wi}%"><div class="sk-bubble"></div></div>`).join("");
  }
  function renderMessagesFade() {
    const el = $("#messages");
    if (!el || !settings.anim) { renderMessages(); return; }
    el.classList.remove("chat-fade");
    void el.offsetWidth;
    el.classList.add("chat-fade");
    renderMessages();
    el.addEventListener("animationend", () => el.classList.remove("chat-fade"), { once: true });
  }

  function updateFab() {
    const el = $("#messages"), fab = $("#fabDown");
    if (!el || !fab) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    fab.classList.toggle("show", !atBottom);
    const fc = $("#fabCount");
    if (fc) {
      fc.textContent = fabCount > 99 ? "99+" : fabCount > 0 ? String(fabCount) : "";
      fc.classList.toggle("show", fabCount > 0);
    }
    if (atBottom && (unreadCut != null || fabCount > 0)) {
      unreadCut = null;
      fabCount = 0;
      if (fc) { fc.textContent = ""; fc.classList.remove("show"); }
      const ud = el.querySelector(".unread-divider");
      if (ud) ud.remove();
    }
  }

  function showTyping() {
    const t = $("#typing");
    if (!t) return;
    t.classList.add("show");
    t.scrollIntoView({ behavior: settings.anim ? "smooth" : "auto", block: "end" });
  }
  function hideTyping() { const t = $("#typing"); if (t) t.classList.remove("show"); }

  function nextReply(chat) {
    const i = replyIdx.get(chat.id) % chat.replies.length;
    replyIdx.set(chat.id, i + 1);
    return chat.replies[i];
  }

  function pickGroupAuthor(chat) {
    const others = (chat.members || []).filter(m => m !== profile.name);
    return (others.length ? others : [chat.name])[Math.floor(Math.random() * (others.length || 1))];
  }

  function addMsg(chatId, msg) {
    if (msg.ts == null) msg.ts = Date.now();
    chatById(chatId).messages.push(msg);
    saveChats();
  }

  // ====== ОТВЕТ (ЦИТАТА) / РЕДАКТИРОВАНИЕ ======
  let replyTarget = null;
  let editMsgId = null;
  function renderReplyBar() {
    const bar = $("#replyBar");
    if (!bar) return;
    if (editMsgId != null) {
      const chat = chatById(activeId);
      const msg = chat && chat.messages.find(m => m.id === editMsgId);
      bar.classList.add("show");
      $("#replyQuote").innerHTML = `<strong>Редактирование</strong><span>${esc(msg ? (msg.text || "Вложение") : "")}</span>`;
    } else if (replyTarget) {
      bar.classList.add("show");
      $("#replyQuote").innerHTML = `<strong>${esc(replyTarget.name)}</strong><span>${esc(replyTarget.text || "Вложение")}</span>`;
    } else {
      bar.classList.remove("show");
    }
  }
  function clearReply() { replyTarget = null; renderReplyBar(); }
  function startEdit(msg) {
    editMsgId = msg.id;
    replyTarget = null;
    renderReplyBar();
    const inp = $("#messageInput");
    if (inp) {
      inp.value = msg.text || "";
      inp.style.height = "auto";
      inp.style.height = Math.min(inp.scrollHeight, 132) + "px";
      updateSendBtn();
      inp.focus();
    }
  }
  function cancelEdit() {
    editMsgId = null;
    renderReplyBar();
    const inp = $("#messageInput");
    if (inp) {
      const d = msgDrafts[activeId];
      if (d) {
        inp.value = d;
        inp.style.height = "auto";
        inp.style.height = Math.min(inp.scrollHeight, 132) + "px";
      } else {
        inp.value = "";
        inp.style.height = "46px";
      }
    }
    updateSendBtn();
  }
  function restoreDraft(inp) {
    const saved = msgDrafts[activeId];
    if (saved) {
      inp.value = saved;
      inp.style.height = "auto";
      inp.style.height = Math.min(inp.scrollHeight, 132) + "px";
    }
    updateSendBtn();
  }

  function setReplyTo(msg) {
    const own = msg.from === "me";
    replyTarget = {
      id: msg.id,
      name: own ? profile.name : (msg.fromName || chatById(activeId).name),
      text: msg.text || "Вложение",
    };
    renderReplyBar();
    const inp = $("#messageInput");
    if (inp) inp.focus();
  }

  function send(text, attachment) {
    const cid = activeId;

    if (editMsgId != null) {
      const chat = chatById(cid);
      const msg = chat && chat.messages.find(m => m.id === editMsgId);
      if (msg) {
        msg.text = text;
        msg.edited = true;
        if (attachment) msg.attachment = attachment;
        saveChats();
      }
      saveMsgDraft(cid, "");
      editMsgId = null;
      renderReplyBar();
      const input = $("#messageInput");
      if (input) { input.value = ""; input.style.height = "46px"; }
      updateSendBtn();
      renderMessages();
      renderChatList();
      sndClick();
      toast("Сообщение изменено");
      return;
    }

    const quote = replyTarget ? { name: replyTarget.name, text: replyTarget.text } : null;
    const self = { id: seedMsgId(), from: "me", text, time: nowTime(), attachment, quote, status: "sent" };
    addMsg(cid, self);
    renderMessages();
    renderChatList();
    sndSend();

    const sb = $("#sendBtn");
    if (sb) { sb.classList.remove("pop"); void sb.offsetWidth; sb.classList.add("pop"); }

    const input = $("#messageInput");
    input.value = "";
    input.style.height = "46px";
    updateSendBtn();
    clearReply();
    saveMsgDraft(cid, "");

    // Доставлено
    setTimeout(() => {
      if (self.status === "sent") {
        self.status = "delivered";
        saveChats();
        if (activeId === cid) renderMessages();
        renderChatList();
      }
    }, 850);

    // Имитация ответа
    const chat = chatById(cid);
    setTimeout(showTyping, 550);
    store.set(LS_TYPING, { chatId: cid, until: Date.now() + 2600 });
    setTimeout(() => {
      hideTyping();
      const m = { id: seedMsgId(), from: "user", text: nextReply(chat), time: nowTime() };
      if (chat.isGroup) m.fromName = pickGroupAuthor(chat);
      addMsg(chat.id, m);
      setRead(chat.id);
      sndIn();
      if (activeId === chat.id) {
        const mEl = $("#messages");
        const atBottom = !mEl || mEl.scrollHeight - mEl.scrollTop - mEl.clientHeight < 60;
        renderMessages(!atBottom);
        if (!atBottom) {
          if (unreadCut == null) unreadCut = chat.messages.length - 1;
          fabCount++;
          updateFab();
        }
      } else {
        chatById(chat.id).unread = (chatById(chat.id).unread || 0) + 1;
        badgePopIds.add(chat.id);
      }
      renderChatList();
    }, 2400);
  }

  function toggleReact(msg, emoji) {
    msg.reactions = msg.reactions || {};
    if (msg.myReact === emoji) {
      msg.reactions[emoji]--;
      delete msg.myReact;
      if (msg.reactions[emoji] <= 0) delete msg.reactions[emoji];
    } else {
      if (msg.myReact && msg.reactions[msg.myReact] > 0) msg.reactions[msg.myReact]--;
      msg.myReact = emoji;
      msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1;
    }
    saveChats();
    renderMessages();
    sndClick();
    const chip = $(`.msg[data-id="${msg.id}"] .reaction-chip[data-emoji="${emoji}"]`);
    if (chip) { chip.classList.remove("burst"); void chip.offsetWidth; chip.classList.add("burst"); }
  }

  function deleteMsg(chatId, msgId) {
    const chat = chatById(chatId);
    const el = $(`.msg[data-id="${msgId}"]`);
    if (el) {
      el.classList.add("removing");
      setTimeout(() => {
        const i = chat.messages.findIndex(m => m.id === msgId);
        if (i >= 0) { chat.messages.splice(i, 1); saveChats(); renderMessages(); renderChatList(); }
      }, 300);
    } else {
      const i = chat.messages.findIndex(m => m.id === msgId);
      if (i >= 0) chat.messages.splice(i, 1);
      saveChats();
      renderMessages();
      renderChatList();
    }
    toast("Сообщение удалено");
  }

  function forwardMsg(msg, anchor, pos) {
    openPop(anchor, layer => {
      layer.className += " forward-pop";
      layer.innerHTML = `<div class="pop-title">Переслать в...</div>` +
        chats.filter(c => c.id !== activeId).map(c =>
          `<button class="forward-item" data-cid="${c.id}">
            <div class="avatar" style="background:${AVATAR_GRADIENTS[c.avatar]}">${esc(c.name[0])}</div>
            <span>${esc(c.name)}</span>
          </button>`).join("") || `<div class="pop-title">Нет других чатов</div>`;
      layer.addEventListener("click", e => {
        const it = e.target.closest(".forward-item");
        if (!it) return;
        const cid = Number(it.dataset.cid);
        addMsg(cid, { id: seedMsgId(), from: "me", text: msg.text, time: nowTime(), forwarded: true, attachment: msg.attachment, quote: msg.quote });
        closePop();
        toast("Переслано в «" + chatById(cid).name + "»");
        sndClick();
        renderChatList();
      });
    }, pos);
  }

  function openReactPop(anchor, msg, pos) {
    openPop(anchor, layer => {
      layer.classList.add("react-pop");
      layer.innerHTML = REACTIONS.map(r => `<button type="button">${r}</button>`).join("");
      layer.addEventListener("click", ev => {
        const b = ev.target.closest("button");
        if (b) { toggleReact(msg, b.textContent); }
        closePop();
      });
    }, pos);
  }

  function openReactTouch(msg, msgEl, x, y) {
    const layer = openPop(msgEl, layer => {
      layer.classList.add("react-pop", "touch-react");
      layer.innerHTML = REACTIONS.map(r => `<button type="button" data-e="${r}">${r}</button>`).join("") +
        `<div class="react-menu-sep"></div>` +
        `<button type="button" class="react-more" data-e="more">${ICONS.more}<span>Меню</span></button>`;
    }, { x, y, width: 0, height: 0 });
    layer.addEventListener("click", ev => {
      if (suppressClick) { suppressClick = false; return; }
      const b = ev.target.closest("button");
      if (!b) return;
      const e = b.dataset.e;
      closePop();
      if (e === "more") openCtxMenu(x, y, msgCtxItems(msg, msgEl));
      else toggleReact(msg, e);
    });
  }

  function msgCtxItems(msg, msgEl) {
    const chat = chatById(activeId);
    const own = msg.from === "me";
    const isPinned = chat.pinnedMsg && chat.pinnedMsg.id === msg.id;
    const items = [
      { icon: ICONS.copy, label: "Копировать", action: () => copyText(msg.text) },
      { icon: ICONS.reply, label: "Ответить", action: () => { setReplyTo(msg); sndClick(); } },
      { icon: ICONS.smile, label: "Реакция", action: () => { openReactPop(msgEl, msg); } },
    ];
    if (own) {
      items.push({ icon: ICONS.edit, label: "Редактировать", action: () => { startEdit(msg); sndClick(); } });
      items.push({ icon: ICONS.trash, label: "Удалить", danger: true, action: () => deleteMsg(activeId, msg.id) });
    }
    items.push({ icon: ICONS.pin, label: isPinned ? "Открепить сообщение" : "Закрепить сообщение", action: () => {
      if (isPinned) delete chat.pinnedMsg;
      else chat.pinnedMsg = { id: msg.id, name: own ? profile.name : chat.name, text: msg.text || "Вложение" };
      saveChats();
      renderChatHeader();
      sndClick();
    } });
    items.push({ sep: true });
    items.push({ icon: ICONS.forward, label: "Переслать", action: () => forwardMsg(msg, null, { x: window.innerWidth / 2, y: window.innerHeight / 2 }) });
    return items;
  }

  function scrollToMsg(id) {
    const el = document.querySelector(`.msg[data-id="${id}"]`);
    if (!el) return false;
    el.scrollIntoView({ behavior: settings.anim ? "smooth" : "auto", block: "center" });
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 1200);
    return true;
  }

  // ====== РЕЖИМ ВЫБОРА СООБЩЕНИЙ ======
  function enterSelMode() { selMode = true; selSet.clear(); renderMessages(true); updateSelBar(); }
  function exitSelMode() { selMode = false; selSet.clear(); renderMessages(true); updateSelBar(); }
  function toggleSelect(id) {
    if (selSet.has(id)) selSet.delete(id);
    else selSet.add(id);
    renderMessages(true);
    updateSelBar();
  }
  function updateSelBar() {
    const bar = $("#selBar");
    if (!bar) return;
    bar.classList.toggle("show", selMode);
    const cnt = $("#selCount");
    if (cnt) cnt.textContent = selSet.size + " " + plural(selSet.size, ["сообщение", "сообщения", "сообщений"]);
    const del = $("#selDelete");
    if (del) del.disabled = selSet.size === 0;
  }
  function deleteSelected() {
    const chat = chatById(activeId);
    const n = selSet.size;
    if (!n || !chat) return;
    confirmBox("Удалить сообщения?", `Безвозвратно удалить ${n} ${plural(n, ["сообщение", "сообщения", "сообщений"])}?`, () => {
      chat.messages = chat.messages.filter(m => !selSet.has(m.id));
      if (chat.pinnedMsg && selSet.has(chat.pinnedMsg.id)) delete chat.pinnedMsg;
      saveChats();
      exitSelMode();
      renderChatHeader();
      renderChatList();
      toast("Сообщения удалены");
      sndSend();
    });
  }

  function bindSidebar() {
    $("#navNew").addEventListener("click", () => go("newchat"));
    $("#navProfile").addEventListener("click", () => go("profile"));
    $("#navSettings").addEventListener("click", () => go("settings"));
    const navTheme = $("#navTheme");
    if (navTheme) navTheme.addEventListener("click", () => {
      settings.theme = settings.theme === "system"
        ? (mqDark() ? "light" : "dark")
        : settings.theme === "light" ? "dark" : "light";
      saveSettings();
      applyTheme();
      sndClick();
    });
    $("#sidebarFooter").addEventListener("click", () => go("profile"));
    $("#searchInput").addEventListener("input", renderChatList);
    renderChatList();
  }

  function bindChat() {
    const list = $("#chatList");
    const msgs = $("#messages");
    const composer = $("#composer");
    const input = $("#messageInput");
    const sendBtn = $("#sendBtn");

    bindSidebar();
    renderChatHeader();
    const chat0 = chatById(activeId);
    if (settings.anim && chat0 && chat0.messages.length > 15) {
      const sk = $("#messages");
      if (sk) sk.innerHTML = skeletonHtml();
      setTimeout(() => { renderMessages(); }, 460);
    } else {
      renderMessages();
    }
    updateSendBtn();
    startBackgroundTraffic();

    // Кнопка «вниз» + счётчик новых + непрочитанные
    let fabRaf = 0;
    msgs.addEventListener("scroll", () => {
      if (fabRaf) return;
      fabRaf = requestAnimationFrame(() => { fabRaf = 0; updateFab(); });
    }, { passive: true });
    $("#fabDown").addEventListener("click", () => {
      sndClick();
      msgs.scrollTo({ top: msgs.scrollHeight, behavior: settings.anim ? "smooth" : "auto" });
    });
    updateFab();

    // Режим выбора сообщений
    $("#selClose").addEventListener("click", () => { exitSelMode(); renderChatHeader(); sndClick(); });
    $("#selDelete").addEventListener("click", deleteSelected);
    updateSelBar();

    // Мобильная шторка: тап по подложке закрывает сайдбар
    const scrim = $("#sidebarScrim");
    if (scrim) scrim.addEventListener("click", () => {
      document.body.classList.add("sidebar-hidden");
      sndClick();
    });

    // Двойной тап по сообщению = ❤️
    msgs.addEventListener("dblclick", e => {
      if (selMode) return;
      const first = e.target.closest(".msg");
      if (!first || first.querySelector(".heart-burst")) return;
      const m = chatById(activeId).messages.find(x => x.id === Number(first.dataset.id));
      if (!m) return;
      if (m.myReact !== "❤️") toggleReact(m, "❤️");
      const cur = document.querySelector(`.msg[data-id="${m.id}"]`);
      const h = document.createElement("span");
      h.className = "heart-burst";
      h.textContent = "❤️";
      (cur || first).appendChild(h);
      h.addEventListener("animationend", () => h.remove(), { once: true });
    });

    // Долгое нажатие (тач) = быстрые реакции + меню
    let lpTimer = 0, lpMoved = false, lpX = 0, lpY = 0;
    msgs.addEventListener("touchstart", e => {
      const t = e.target;
      if (t.closest(".mini-btn") || t.closest(".reaction-chip") || t.closest(".voice-play") || t.closest(".attach-image")) return;
      const msgEl = t.closest(".msg");
      if (!msgEl) return;
      lastTouchTime = Date.now();
      lpMoved = false;
      lpX = e.touches[0].clientX;
      lpY = e.touches[0].clientY;
      clearTimeout(lpTimer);
      lpTimer = setTimeout(() => {
        if (lpMoved) return;
        const m = chatById(activeId).messages.find(x => x.id === Number(msgEl.dataset.id));
        if (!m) return;
        if (selMode) return;
        suppressClick = true;
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch {} }
        sndClick();
        openReactTouch(m, msgEl, lpX, lpY);
      }, 520);
    }, { passive: true });
    msgs.addEventListener("touchmove", e => {
      const dx = e.touches[0].clientX - lpX, dy = e.touches[0].clientY - lpY;
      if (dx * dx + dy * dy > 100) { lpMoved = true; clearTimeout(lpTimer); }
    }, { passive: true });
    msgs.addEventListener("touchend", () => { clearTimeout(lpTimer); });

    // Список чатов
    list.addEventListener("click", e => {
      const archDiv = e.target.closest(".archive-divider");
      if (archDiv) {
        archiveOpen = !archiveOpen;
        renderChatList();
        sndClick();
        return;
      }
      const pin = e.target.closest(".pin-btn");
      if (pin) {
        const cid = Number(pin.dataset.pin);
        chatById(cid).pinned = !chatById(cid).pinned;
        saveChats();
        renderChatList();
        sndClick();
        toast(chatById(cid).pinned ? "Чат закреплён" : "Чат откреплён");
        return;
      }
      const item = e.target.closest(".chat-item");
      if (!item || !item.dataset.id) return;
      if (editMsgId == null) saveMsgDraft(activeId, input.value);
      activeId = Number(item.dataset.id);
      document.body.classList.add("sidebar-hidden");
      chatById(activeId).unread = 0;
      saveChats();
      closePop();
      closeCtx();
      closeChatSearch();
      clearReply();
      cancelEdit();
      hideTyping();
      selMode = false;
      selSet.clear();
      renderChatList();
      renderChatHeader();
      renderMessagesFade();
      unreadCut = null;
      fabCount = 0;
      updateFab();
      updateSelBar();
      restoreDraft(input);
      sndClick();
      input.focus();
      scheduleGreet();
    });

    // Ответ (цитата)
    $("#replyClose").addEventListener("click", () => {
      if (editMsgId != null) cancelEdit();
      else clearReply();
      input.focus();
    });

    // Отправка
    const autoResize = () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 132) + "px";
    };
    composer.addEventListener("submit", e => { e.preventDefault(); const t = input.value.trim(); if (t) send(t); });
    input.addEventListener("input", () => { updateSendBtn(); autoResize(); if (editMsgId == null) saveMsgDraft(activeId, input.value); });
    $("#clearInput").addEventListener("click", () => {
      input.value = "";
      input.style.height = "46px";
      updateSendBtn();
      input.focus();
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Escape") { if (editMsgId != null) cancelEdit(); else clearReply(); return; }
      if (e.key === "Enter" && !e.shiftKey && (e.ctrlKey || settings.enterSend)) {
        e.preventDefault();
        const t = input.value.trim();
        if (t) send(t);
      }
    });

    restoreDraft(input);

    // Эмодзи
    const emojiBtn = $("#emojiBtn");
    emojiBtn.classList.add("pop-trigger");
    emojiBtn.addEventListener("click", () => {
      sndClick();
      if (pop && pop.classList.contains("emoji-pop")) { closePop(); return; }
      openPop(emojiBtn, layer => {
        layer.classList.add("emoji-pop");
        layer.innerHTML = EMOJIS.map(e => `<button type="button">${e}</button>`).join("");
        layer.addEventListener("click", e => {
          const b = e.target.closest("button");
          if (!b) return;
          const s = input.selectionStart ?? input.value.length;
          const en = input.selectionEnd ?? s;
          input.value = input.value.slice(0, s) + b.textContent + input.value.slice(en);
          input.focus();
          input.selectionStart = input.selectionEnd = s + b.textContent.length;
          updateSendBtn();
          closePop();
        });
      });
    });

    // Вложения
    const fileInput = $("#fileInput");
    $("#attachBtn").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      [...fileInput.files].forEach(f => {
        if (/^image\/(png|jpe?g|gif|webp|bmp|svg\+xml)/i.test(f.type) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f.name)) {
          if (isGif(f)) {
            readRawFile(f, src => send("", { kind: "image", name: f.name, size: fmtSize(f.size), src }));
          } else {
            readImgFile(f, src => send("", { kind: "image", name: f.name, size: fmtSize(f.size), src }), 1600);
          }
        } else {
          send("", { kind: "file", name: f.name, size: fmtSize(f.size) });
        }
      });
      fileInput.value = "";
    });

    // Голосовые сообщения
    $("#micBtn").addEventListener("click", startRec);
    $("#recSend").addEventListener("click", () => stopRec(true));
    $("#recCancel").addEventListener("click", () => { stopRec(false); toast("Запись отменена"); });

    // Поиск по сообщениям
    $("#searchClose").addEventListener("click", closeChatSearch);
    $("#searchInChat").addEventListener("input", e => {
      searchQuery = e.target.value;
      searchIdx = 0;
      applyChatSearch();
    });
    $("#searchInChat").addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); searchStep(1); }
      if (e.key === "Escape") { e.preventDefault(); closeChatSearch(); }
    });
    $("#searchPrev").addEventListener("click", () => searchStep(-1));
    $("#searchNext").addEventListener("click", () => searchStep(1));

    // Действия в сообщениях
    msgs.addEventListener("click", e => {
      if (suppressClick) { suppressClick = false; return; }
      if (selMode) {
        const sMsg = e.target.closest(".msg");
        if (sMsg) { toggleSelect(Number(sMsg.dataset.id)); sndClick(); }
        return;
      }
      const chip = e.target.closest(".reaction-chip");
      if (chip) {
        const msg = chatById(activeId).messages.find(m => m.id === Number(e.target.closest(".msg").dataset.id));
        if (msg) toggleReact(msg, chip.dataset.emoji);
        return;
      }
      const imgBox = e.target.closest(".attach-image");
      if (imgBox) {
        const mImg = chatById(activeId).messages.find(m => m.id === Number(imgBox.closest(".msg").dataset.id));
        if (mImg && mImg.attachment) openImageViewer(mImg.attachment);
        return;
      }
      const vp = e.target.closest(".voice-play");
      if (vp) { toggleVoice(vp); return; }
      const act = e.target.closest(".mini-btn");
      if (!act) return;
      const msg = chatById(activeId).messages.find(m => m.id === Number(act.closest(".msg").dataset.id));
      if (!msg) return;
      const own = msg.from === "me";

      if (act.dataset.act === "del") { deleteMsg(activeId, msg.id); }
      else if (act.dataset.act === "edit") { sndClick(); startEdit(msg); }
      else if (act.dataset.act === "reply") { sndClick(); setReplyTo(msg); }
      else if (act.dataset.act === "fwd") { forwardMsg(msg, act); }
      else if (act.dataset.act === "react") {
        sndClick();
        openReactPop(act, msg);
      }
    });

    // Контекстное меню (ПКМ)
    msgs.addEventListener("contextmenu", e => {
      const msgEl = e.target.closest(".msg");
      if (!msgEl) return;
      e.preventDefault();
      if (Date.now() - lastTouchTime < 1200) return;
      const msg = chatById(activeId).messages.find(m => m.id === Number(msgEl.dataset.id));
      if (!msg) return;
      openCtxMenu(e.clientX, e.clientY, msgCtxItems(msg, msgEl));
    });

    // Фон переписки из настроек
    const chatBgEl = msgs;
    const bgImg = settings.chatBgImg;
    if (bgImg) {
      chatBgEl.style.background = bgImageCss(bgImg);
      chatBgEl.style.backgroundBlendMode = "normal";
    } else if (settings.chatBg >= 0 && BANNERS[settings.chatBg]) {
      chatBgEl.style.background = "linear-gradient(rgba(8,10,22,.5), rgba(8,10,22,.5)), " + BANNERS[settings.chatBg] + " center/cover";
      chatBgEl.style.backgroundBlendMode = "normal";
    }

    // Навигация
    $("#chatHeader").addEventListener("click", (e) => {
      if (e.target.closest("#detailToggle")) { toggleDetailPanel(); return; }
      if (e.target.closest("#selBtn")) {
        if (selMode) exitSelMode();
        else enterSelMode();
        renderChatHeader();
        sndClick();
        return;
      }
      if (e.target.closest(".pinned-line")) {
        const p = chatById(activeId).pinnedMsg;
        if (p && scrollToMsg(p.id)) { closePop(); closeCtx(); sndClick(); }
        return;
      }
      if (e.target.closest("#searchOpenBtn")) {
        const ov = $("#chatSearch");
        if (!ov) return;
        if (!ov.hidden) { closeChatSearch(); return; }
        searchActive = true;
        ov.hidden = false;
        sndClick();
        requestAnimationFrame(() => { const i = $("#searchInChat"); if (i) i.focus(); });
        return;
      }
      if (e.target.closest("#chatBack")) {
        document.body.classList.remove("sidebar-hidden");
        closePop();
        closeCtx();
        sndClick();
        return;
      }
      if (activeId != null) toggleDetailPanel();
    });
  }

  // ====== БОКОВАЯ ПАНЕЛЬ ДЕТАЛЕЙ (3-я панель) ======
  let detailOpen = false;
  function toggleDetailPanel() {
    detailOpen = !detailOpen;
    const dp = $("#detailPanel");
    if (dp) dp.classList.toggle("open", detailOpen);
    if (detailOpen && activeId != null) renderDetailPanel();
    else renderChatHeader();
  }
  function renderDetailPanel() {
    const chat = chatById(activeId);
    const inner = $("#detailInner");
    if (!inner || !chat) return;
    const isG = chat.isGroup;
    const avOf = Object.fromEntries(chats.map(c => [c.name, c.avatar]));
    const memberRows = isG && chat.members
      ? chat.members.map(m => `
          <li class="member-row">
            <span class="avatar" style="background:${AVATAR_GRADIENTS[avOf[m] ?? 0]}">${esc(m[0])}</span>
            <span class="m-name">${esc(m)}${m === profile.name ? " <small>(вы)</small>" : ""}</span>
          </li>`).join("")
      : "";
    const mediaMsgs = chat.messages.filter(m => m.attachment && m.attachment.kind === "image");
    const mediaRows = mediaMsgs.length
      ? `<div class="detail-section">
          <div class="detail-label">Фото и медиа <span class="m-count">${mediaMsgs.length}</span></div>
          <div class="media-grid">
            ${mediaMsgs.map(m => `<button type="button" class="media-thumb" data-mid="${m.id}" style="background-image:url('${m.attachment.src}')" title="Открыть"></button>`).join("")}
          </div>
        </div>`
      : "";
    const pin = chat.pinnedMsg;
    const pinSection = pin ? `
      <div class="detail-section">
        <div class="detail-label">Закреплённые <span class="m-count">1</span></div>
        <div class="pin-card" data-pmid="${pin.id}">
          <div class="pin-head">${ICONS.pin}<strong>${esc(pin.name)}</strong>
            <button type="button" class="pin-x" data-unpin="1" title="Открепить">${ICONS.close}</button>
          </div>
          <div class="pin-text">${esc(pin.text)}</div>
        </div>
      </div>` : "";
    inner.innerHTML = `
      <div class="detail-head">
        <div class="avatar big-avatar" style="background:${AVATAR_GRADIENTS[chat.avatar]}">${esc(chat.name[0])}</div>
        <div class="p-name">${esc(chat.name)}</div>
        <div class="status-pill${chat.status === "в сети" ? " online" : ""}">${esc(chat.status)}</div>
      </div>
      <div class="info-rows">
        ${isG
          ? `<div class="info-row"><span class="k">Создатель группы</span><span class="v">${esc(profile.name)}</span></div>
             <div class="info-row"><span class="k">Участники</span><span class="v">${chat.members ? chat.members.length + 1 : 1}</span></div>`
          : `<div class="info-row"><span class="k">Телефон</span><span class="v">${esc(chat.phone || "—")}</span></div>
             <div class="info-row"><span class="k">О себе</span><span class="v">${esc(chat.about || "Нет информации")}</span></div>`}
      </div>
      ${isG && chat.members ? `<div class="member-list" style="max-height:none">${memberRows}</div>` : ""}
      ${mediaRows}
      ${pinSection}
      <div class="detail-actions">
        <button class="btn ghost" id="dArchive">${chat.archived ? "Разархивировать" : "Архивировать чат"}</button>
        <button class="btn ghost danger" id="dDelete">Удалить чат</button>
        <button class="btn ghost" id="dPin">${chat.pinned ? "Открепить чат" : "Закрепить чат"}</button>
        <button class="btn" id="dWrite">Открыть чат</button>
      </div>`;

    $("#dArchive").addEventListener("click", () => {
      chat.archived = !chat.archived;
      if (chat.archived) chat.pinned = false;
      saveChats();
      toast(chat.archived ? "Чат перемещён в архив" : "Чат разархивирован");
      sndClick();
      go("chat");
    });
    $("#dDelete").addEventListener("click", () => {
      confirmBox("Удалить чат?", `Безвозвратно удалить «${chat.name}» вместе со всей перепиской?`, () => {
        if (chats.length <= 1) { toast("Это последний чат — удалить нельзя"); return; }
        const i = chats.findIndex(c => c.id === chat.id);
        if (i >= 0) chats.splice(i, 1);
        saveChats();
        if (activeId === chat.id) activeId = chats[0].id;
        toast("Чат удалён");
        sndSend();
        go("chat");
      });
    });
    $("#dPin").addEventListener("click", () => {
      chat.pinned = !chat.pinned;
      saveChats();
      toast(chat.pinned ? "Чат закреплён" : "Чат откреплён");
      sndClick();
      renderDetailPanel();
    });
    $("#dWrite").addEventListener("click", () => { detailOpen = false; const dp = $("#detailPanel"); if (dp) dp.classList.remove("open"); go("chat"); });

    inner.addEventListener("click", e => {
      const unpinBtn = e.target.closest("[data-unpin]");
      if (unpinBtn) {
        delete chat.pinnedMsg;
        saveChats();
        renderDetailPanel();
        sndClick();
        toast("Сообщение откреплено");
        return;
      }
      const pcard = e.target.closest(".pin-card");
      if (pcard) {
        const pid = Number(pcard.dataset.pmid);
        if (!chat.messages.some(x => x.id === pid)) { toast("Сообщение больше не существует"); return; }
        detailOpen = false;
        const dp = $("#detailPanel");
        if (dp) dp.classList.remove("open");
        sndClick();
        scrollToMsg(pid);
        return;
      }
      const th = e.target.closest(".media-thumb");
      if (!th) return;
      const m = chat.messages.find(x => x.id === Number(th.dataset.mid));
      if (m && m.attachment) { sndClick(); openImageViewer(m.attachment); }
    });
  }

  // ====== СТРАНИЦА: НОВАЯ ГРУППА ======
  const plural = (n, forms) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  };

  function renderNewChatView() {
    const draft = { name: "", avatar: 0, members: new Set() };
    const cts = contacts();
    $("#app").innerHTML = `
      <div class="view">
        <div class="page-wrap">
          <div class="page-card glass">
            <div class="back-bar">
              <button class="icon-btn" id="backBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>
              <h2>Новая группа</h2>
            </div>
            <div class="page-avatar-wrap">
              <div class="avatar big-avatar" id="ngAvatar" style="background:${AVATAR_GRADIENTS[0]}">👥</div>
              <div class="hint">Выберите градиент группы</div>
              <div class="gradient-grid wrap">
                ${AVATAR_GRADIENTS.map((g, i) =>
                  `<button type="button" class="gradient-swatch ${i === draft.avatar ? "active" : ""}" data-i="${i}" style="background:${g}"></button>`).join("")}
              </div>
            </div>
            <div class="form-stack">
              <div class="field">
                <label>Название группы</label>
                <input id="ngName" type="text" maxlength="32" placeholder="Например: Выходные в горах">
              </div>
              <div class="field">
                <label>Участники</label>
                <div class="member-list" id="ngMembers">
                  ${cts.map(c =>
                    `<button type="button" class="member-row" data-id="${c.id}">
                      <span class="checkbox"></span>
                      <span class="avatar" style="background:${AVATAR_GRADIENTS[c.avatar]}">${esc(c.name[0])}</span>
                      <span class="m-name">${esc(c.name)}</span>
                    </button>`).join("")}
                </div>
              </div>
              <div class="form-actions">
                <button class="btn ghost" id="ngCancel">Отмена</button>
                <button class="btn" id="ngCreate" disabled>Создать группу</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    const ava = $("#ngAvatar"), grid = $("#ngAvatar").parentElement.querySelector(".gradient-grid");
    grid.addEventListener("click", e => {
      const s = e.target.closest(".gradient-swatch");
      if (!s) return;
      draft.avatar = Number(s.dataset.i);
      grid.querySelectorAll(".gradient-swatch").forEach(x => x.classList.remove("active"));
      s.classList.add("active");
      ava.style.background = AVATAR_GRADIENTS[draft.avatar];
      sndClick();
    });

    const nameIn = $("#ngName");
    nameIn.addEventListener("input", () => {
      draft.name = nameIn.value.trim();
      ava.textContent = draft.name ? draft.name[0] : "👥";
      updateCreate();
    });
    function updateCreate() {
      $("#ngCreate").disabled = !(draft.name && draft.members.size > 0);
    }

    $("#ngMembers").addEventListener("click", e => {
      const row = e.target.closest(".member-row");
      if (!row) return;
      const id = Number(row.dataset.id);
      if (draft.members.has(id)) draft.members.delete(id); else draft.members.add(id);
      row.classList.toggle("on", draft.members.has(id));
      updateCreate();
      sndClick();
    });

    $("#ngCreate").addEventListener("click", () => {
      const name = draft.name;
      const members = cts.filter(c => draft.members.has(c.id)).map(c => c.name);
      const chat = {
        id: nextChatId(),
        name,
        status: (members.length + 1) + " " + plural(members.length + 1, ["участник", "участника", "участников"]),
        avatar: draft.avatar,
        isGroup: true,
        members,
        unread: 0,
        replies: GROUP_REPLIES,
        pinned: false,
        messages: [{ id: seedMsgId(), from: "me", text: "Группа «" + name + "» создана 🎉", time: nowTime() }],
      };
      chats.push(chat);
      replyIdx.set(chat.id, 0);
      sortChats();
      saveChats();
      activeId = chat.id;
      toast("Группа создана");
      sndSend();
      go("chat");
    });
    $("#ngCancel").addEventListener("click", () => go("chat"));
    $("#backBtn").addEventListener("click", () => go("chat"));
    nameIn.focus();
  }

  // ====== СТРАНИЦА: ПРОФИЛЬ ======
  function renderProfileView() {
    let draft = { ...profile };
    $("#app").innerHTML = `
      <div class="view">
        <div class="page-wrap">
          <div class="page-card glass">
            <div class="back-bar">
              <button class="icon-btn" id="backBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>
              <h2>Профиль</h2>
            </div>
            <div class="profile-head${hasBanner(draft) ? " has-banner" : ""}">
              <div class="profile-banner" id="pfBanner" style="background:${pfBannerStyle(draft)}"></div>
              <div class="avatar-pick">
                <div class="avatar big-avatar${avatarCls(draft)}" id="pfAvatar" style="${avatarCss(draft)}">${esc(draft.name[0] || "Я")}</div>
                <button type="button" class="cam-btn" id="pfCam" title="Сменить фото">${ICONS.camera}</button>
                <input type="file" id="pfAvatarFile" accept="image/*" hidden>
              </div>
              <div class="p-name" id="pfNameLabel">${esc(draft.name)}</div>
              <div class="status-pill" id="pfStatusPill">${isPremium() ? "⭐ Premium" : esc(draft.status)}</div>
            </div>
            <div class="page-avatar-wrap">
              <div class="hint">Градиент или фото — нажмите на камеру у аватара</div>
              <div class="gradient-grid wrap">
                ${AVATAR_GRADIENTS.map((g, i) =>
                  `<button type="button" class="gradient-swatch ${i === draft.avatar ? "active" : ""}" data-i="${i}" style="background:${g}"></button>`).join("")}
              </div>
              ${draft.avatarImg ? `<button type="button" class="btn ghost" id="pfRemoveImg" style="margin-top:12px;padding:8px 14px">Убрать фото</button>` : ""}
            </div>
            <div class="form-stack">
              <button type="button" class="premium-row ${isPremium() ? "active" : ""}" id="premiumRow">
                ${isPremium() ? "⭐ Подписка lilbru+ активна" : "⭐ Оформить lilbru+ — баннеры, акценты и бейдж"}
              </button>
              <div class="field">
                <label>Баннер профиля</label>
                <div class="banner-grid" id="pfBanners">
                  <button type="button" class="banner-swatch none ${(!draft.bannerImg && draft.banner == null) ? "active" : ""}" data-i="-1">Без</button>
                  ${BANNERS.map((b, i) =>
                    `<button type="button" class="banner-swatch ${i === draft.banner ? "active" : ""} ${PREMIUM_BANNER_IDS.includes(i) && !isPremium() ? "locked" : ""}" data-i="${i}" style="background:${b}">${PREMIUM_BANNER_IDS.includes(i) && !isPremium() ? "🔒" : ""}</button>`).join("")}
                  <button type="button" class="banner-swatch custom ${draft.bannerImg ? "active hasimg" : ""}" data-i="custom" style="${draft.bannerImg ? bannerImageCss(draft.bannerImg) : ""}">${draft.bannerImg ? "" : ICONS.camera}</button>
                </div>
                <div class="hint" style="margin-top:8px">Нажмите на плитку с камерой, чтобы загрузить своё фото</div>
                <input type="file" id="pfBannerFile" accept="image/*" hidden>
              </div>
              <div class="field">
                <label>Имя</label>
                <input id="pfName" type="text" maxlength="24" value="${esc(draft.name)}">
              </div>
              <div class="field">
                <label>Статус</label>
                <select id="pfStatus">
                  <option ${draft.status === "В сети" ? "selected" : ""}>В сети</option>
                  <option ${draft.status === "Не беспокоить" ? "selected" : ""}>Не беспокоить</option>
                  <option ${draft.status === "Вне сети" ? "selected" : ""}>Вне сети</option>
                </select>
              </div>
              <div class="field">
                <label>О себе</label>
                <textarea id="pfBio" rows="3" maxlength="70" placeholder="Расскажите о себе">${esc(draft.bio || "")}</textarea>
              </div>
              <div class="field">
                <label>Телефон</label>
                <input id="pfPhone" type="tel" maxlength="20" value="${esc(draft.phone || "")}">
              </div>
              <div class="field">
                <label>@username</label>
                <input id="pfUser" type="text" maxlength="20" value="${esc(draft.username || "")}">
              </div>
              <div class="form-actions">
                <button class="btn ghost" id="pfCancel">Отмена</button>
                <button class="btn" id="pfSave">Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    const ava = $("#pfAvatar"), grid = document.querySelector(".page-avatar-wrap .gradient-grid");
    grid.addEventListener("click", e => {
      const s = e.target.closest(".gradient-swatch");
      if (!s) return;
      draft.avatar = Number(s.dataset.i);
      grid.querySelectorAll(".gradient-swatch").forEach(x => x.classList.remove("active"));
      s.classList.add("active");
      ava.style.background = avatarCss(draft);
      sndClick();
    });

    const pfCam = $("#pfCam"), pfAvatarFile = $("#pfAvatarFile");
    if (pfCam) {
      pfCam.addEventListener("click", () => pfAvatarFile.click());
      pfAvatarFile.addEventListener("change", e => {
        const f = e.target.files[0];
        if (f) readImgFile(f, data => {
          draft.avatarImg = data;
          ava.style.background = `url('${data}') center/cover no-repeat, ${AVATAR_GRADIENTS[draft.avatar]}`;
          ava.classList.add("photo");
          sndClick();
        });
        pfAvatarFile.value = "";
      });
    }
    const pfRemoveImg = $("#pfRemoveImg");
    if (pfRemoveImg) pfRemoveImg.addEventListener("click", () => {
      draft.avatarImg = null;
      ava.style.background = avatarCss(draft);
      ava.classList.remove("photo");
      sndClick();
    });

    const pfBannerEl = $("#pfBanner"), bannerGrid = $("#pfBanners");
    bannerGrid.addEventListener("click", e => {
      const s = e.target.closest(".banner-swatch");
      if (!s) return;
      if (s.dataset.i === "custom") {
        $("#pfBannerFile").click();
        return;
      }
      const i = Number(s.dataset.i);
      if (i >= 0 && PREMIUM_BANNER_IDS.includes(i) && !isPremium()) {
        toast("Эксклюзивно для lilbru+");
        sndClick();
        go("premium");
        return;
      }
      draft.banner = i < 0 ? null : i;
      draft.bannerImg = null;
      bannerGrid.querySelectorAll(".banner-swatch").forEach(x => x.classList.toggle("active", x === s));
      pfBannerEl.style.background = pfBannerStyle(draft);
      document.querySelector(".profile-head").classList.toggle("has-banner", hasBanner(draft));
      sndClick();
    });

    const pfBannerFile = $("#pfBannerFile");
    if (pfBannerFile) pfBannerFile.addEventListener("change", e => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 2.5 * 1024 * 1024) { toast("Баннер слишком большой — максимум 2,5 МБ"); }
      else readImgFile(f, data => {
        draft.banner = null;
        draft.bannerImg = data;
        pfBannerEl.style.background = bannerImageCss(data);
        document.querySelector(".profile-head").classList.add("has-banner");
        sndClick();
      }, 1000);
      e.target.value = "";
    });

    $("#premiumRow").addEventListener("click", () => go("premium"));
    $("#pfName").addEventListener("input", () => {
      draft.name = $("#pfName").value.trim() || "Я";
      ava.textContent = draft.name[0];
      $("#pfNameLabel").textContent = $("#pfName").value.trim() || "Я";
    });
    $("#pfStatus").addEventListener("change", () => { $("#pfStatusPill").textContent = $("#pfStatus").value; });

    $("#pfSave").addEventListener("click", () => {
      profile.name = $("#pfName").value.trim() || "Вы";
      profile.status = $("#pfStatus").value;
      profile.bio = $("#pfBio").value.trim();
      profile.phone = $("#pfPhone").value.trim();
      profile.username = $("#pfUser").value.trim().replace(/^@/, "");
      profile.avatar = draft.avatar;
      profile.avatarImg = draft.avatarImg || null;
      profile.banner = draft.banner;
      profile.bannerImg = draft.bannerImg || null;
      store.set(LS_PROFILE, profile);
      toast("Профиль обновлён");
      sndSend();
      go("chat");
    });
    $("#pfCancel").addEventListener("click", () => go("chat"));
    $("#backBtn").addEventListener("click", () => go("chat"));
  }

  // ====== СТРАНИЦА: lilbru+ ======
  function renderPremiumView() {
    const active = isPremium();
    const plan = (profile.premium && profile.premium.plan) || "yearly";
    const price = plan === "monthly" ? 199 : 1499;
    const until = profile.premium ? new Date(profile.premium.until).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "";

    $("#app").innerHTML = `
      <div class="view">
        <div class="page-wrap">
          <div class="page-card glass">
            <div class="back-bar">
              <button class="icon-btn" id="backBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>
              <h2>lilbru+</h2>
            </div>
            <div class="premium-hero">
              <div class="premium-logo">⭐</div>
              <div class="p-name">lilbru+</div>
              ${active
                ? `<div class="status-pill premium">Активна до ${esc(until)}</div>`
                : `<div class="premium-subtitle">Больше красоты в обычных мелочах</div>`}
            </div>
            <div class="perk-list">
              <div class="perk"><span>🎨</span> Эксклюзивные баннеры профиля</div>
              <div class="perk"><span>🌈</span> 2 фирменных акцентных цвета</div>
              <div class="perk"><span>🖼️</span> Фоны оформления чатов</div>
              <div class="perk"><span>⭐</span> Премиум-бейдж у имени</div>
              <div class="perk"><span>🔮</span> Фиолетовая плашка Premium</div>
            </div>
            ${active ? `
              <div class="premium-active">
                <p>Спасибо за поддержку! Ваши эксклюзивные баннеры и акценты уже разблокированы.</p>
                <button class="btn ghost" id="pbDeactivate">Отменить подписку</button>
              </div>` : `
              <div class="plans" id="plans">
                <button type="button" class="plan ${plan === "monthly" ? "active" : ""}" data-plan="monthly"><strong>Месяц</strong><span>199 ₽</span><small>гибко</small></button>
                <button type="button" class="plan ${plan === "yearly" ? "active" : ""}" data-plan="yearly"><strong>Год</strong><span>1499 ₽</span><small>экономия 37%</small></button>
              </div>
              <button class="btn" id="pbPay" style="width:100%;justify-content:center">Оформить lilbru+</button>
              <div class="pay-wrap" id="payWrap" hidden>
                <div class="field"><label>Номер карты</label><input id="cardNum" inputmode="numeric" autocomplete="off" placeholder="0000 0000 0000 0000" maxlength="19"></div>
                <div class="pay-row">
                  <div class="field" style="flex:1"><label>ММ/ГГ</label><input id="cardExp" placeholder="12/28" maxlength="5"></div>
                  <div class="field" style="flex:1"><label>CVC</label><input id="cardCvc" type="password" placeholder="•••" maxlength="3"></div>
                </div>
                <p class="pay-note">Демо-режим: реальные платежи не выполняются. Любые данные подойдут.</p>
                <button class="btn" id="cardPay" style="width:100%;justify-content:center">Оплатить ${price} ₽</button>
              </div>`}
          </div>
        </div>
      </div>`;

    let chosen = plan;
    const plans = $("#plans");
    if (plans) {
      plans.addEventListener("click", e => {
        const b = e.target.closest(".plan");
        if (!b) return;
        chosen = b.dataset.plan;
        plans.querySelectorAll(".plan").forEach(x => x.classList.toggle("active", x === b));
        $("#payWrap").setAttribute("hidden", "");
        sndClick();
      });
    }
    if ($("#pbPay")) {
      $("#pbPay").addEventListener("click", () => {
        $("#payWrap").removeAttribute("hidden");
        $("#cardNum").focus();
        sndClick();
      });
    }
    if ($("#pbDeactivate")) {
      $("#pbDeactivate").addEventListener("click", () => {
        profile.premium = null;
        store.set(LS_PROFILE, profile);
        toast("Подписка отменена");
        sndClick();
        renderPremiumView();
      });
    }
    if ($("#cardPay")) {
      $("#cardPay").addEventListener("click", () => {
        const num = $("#cardNum").value.replace(/\D/g, "");
        const cvc = $("#cardCvc").value;
        if (num.length < 16 || cvc.length < 3) { toast("Заполните данные карты"); return; }
        const priceNow = chosen === "monthly" ? 199 : 1499;
        const btn = $("#cardPay");
        btn.disabled = true;
        btn.textContent = "Проверяем карту…";
        setTimeout(() => {
          profile.premium = {
            active: true,
            plan: chosen,
            until: Date.now() + (chosen === "monthly" ? 30 : 365) * 86400000,
          };
          store.set(LS_PROFILE, profile);
          toast("⭐ lilbru+ активен! Спасибо");
          sndIn();
          renderPremiumView();
        }, 1700);
      });
    }
    $("#backBtn").addEventListener("click", () => go("chat"));
  }

  // ====== СТРАНИЦА: ПРОФИЛЬ СОБЕСЕДНИКА ======
  function renderContactView() {
    const chat = chatById(activeId);
    if (!chat) { go("chat"); return; }
    const isG = chat.isGroup;
    const avOf = Object.fromEntries(chats.map(c => [c.name, c.avatar]));
    const memberRows = isG && chat.members
      ? chat.members.map(m => `
          <li class="member-row" style="cursor:default">
            <span class="avatar" style="background:${AVATAR_GRADIENTS[avOf[m] ?? 0]}">${esc(m[0])}</span>
            <span class="m-name">${esc(m)}${m === profile.name ? " <small>(вы)</small>" : ""}</span>
          </li>`).join("")
      : "";

    $("#app").innerHTML = `
      <div class="view">
        <div class="page-wrap">
          <div class="page-card glass">
            <div class="back-bar">
              <button class="icon-btn" id="backBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>
              <h2>${esc(chat.name)}</h2>
            </div>
            <div class="profile-head">
              <div class="avatar big-avatar" style="background:${AVATAR_GRADIENTS[chat.avatar]}">${esc(chat.name[0])}</div>
              <div class="p-name">${esc(chat.name)}</div>
              <div class="status-pill${chat.status === "в сети" ? " online" : ""}">${esc(chat.status)}</div>
            </div>
            <div class="info-rows">
              ${isG
                ? `<div class="info-row"><span class="k">Создатель группы</span><span class="v">${esc(profile.name)}</span></div>
                   <div class="info-row"><span class="k">Участники</span><span class="v">${chat.members ? chat.members.length + 1 : 1}</span></div>`
                : `<div class="info-row"><span class="k">Телефон</span><span class="v">${esc(chat.phone || "—")}</span></div>
                   <div class="info-row"><span class="k">О себе</span><span class="v">${esc(chat.about || "Нет информации")}</span></div>`}
            </div>
            ${isG && chat.members ? `<div class="member-list" style="max-height:none">${memberRows}</div>` : ""}
            <div class="info-actions">
              <button class="btn ghost" id="cArchive">${chat.archived ? "Разархивировать" : "Архивировать чат"}</button>
              <button class="btn ghost danger" id="cDelete">Удалить чат</button>
            </div>
            <div class="info-actions">
              <button class="btn ghost" id="cPin">${chat.pinned ? "Открепить чат" : "Закрепить чат"}</button>
              <button class="btn" id="cWrite">Открыть чат</button>
            </div>
          </div>
        </div>
      </div>`;

    $("#cArchive").addEventListener("click", () => {
      chat.archived = !chat.archived;
      if (chat.archived) chat.pinned = false;
      saveChats();
      toast(chat.archived ? "Чат перемещён в архив" : "Чат разархивирован");
      sndClick();
      go("chat");
    });
    $("#cDelete").addEventListener("click", () => {
      confirmBox("Удалить чат?", `Безвозвратно удалить «${chat.name}» вместе со всей перепиской?`, () => {
        if (chats.length <= 1) { toast("Это последний чат — удалить нельзя"); return; }
        const i = chats.findIndex(c => c.id === chat.id);
        if (i >= 0) chats.splice(i, 1);
        saveChats();
        if (activeId === chat.id) activeId = chats[0].id;
        toast("Чат удалён");
        sndSend();
        go("chat");
      });
    });
    $("#cPin").addEventListener("click", () => {
      chat.pinned = !chat.pinned;
      saveChats();
      toast(chat.pinned ? "Чат закреплён" : "Чат откреплён");
      sndClick();
      renderContactView();
    });
    $("#cWrite").addEventListener("click", () => go("chat"));
    $("#backBtn").addEventListener("click", () => go("chat"));
  }

  // ====== СТРАНИЦА: НАСТРОЙКИ ======
  function renderSettingsView() {
    $("#app").innerHTML = `
      <div class="view">
        <div class="page-wrap">
          <div class="page-card glass">
            <div class="back-bar">
              <button class="icon-btn" id="backBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>
              <h2>Настройки</h2>
            </div>

            <div class="option-row">
              <div class="option-info"><strong>Тема</strong><small>Выберите оформление фона</small></div>
            </div>
            <div class="theme-grid" id="themeGrid" style="margin-bottom:${settings.theme === "custom" ? "12px" : "20px"}">
              ${PRESET_THEMES.map(t => `
                <button type="button" class="theme-card ${settings.theme === t.id ? "active" : ""}" data-theme="${t.id}">
                  <i class="theme-prev" style="${t.id === "custom" ? "" : `background:linear-gradient(135deg,${t.bg1},${t.bg2})`}"></i>
                  <span>${t.label}</span>
                </button>`).join("")}
            </div>
            ${settings.theme === "custom" ? `
            <div class="field" style="margin-bottom:18px">
              <label>Цвет фона</label>
              <div class="color-row">
                <input type="color" id="customBgColor" value="${esc(settings.customBg || "#0a0d1c")}">
                <span id="customBgLabel">${esc(settings.customBg || "#0a0d1c")}</span>
              </div>
            </div>` : ""}

            <div class="option-row">
              <div class="option-info"><strong>Анимации</strong><small>Плавные переходы и эффекты. Выключите, если приложение подлагивает</small></div>
              <label class="switch"><input type="checkbox" id="animSwitch" ${settings.anim ? "checked" : ""}><span class="track"></span></label>
            </div>

            <div class="option-row">
              <div class="option-info"><strong>Акцентный цвет</strong><small>Оформление приложения</small></div>
            </div>
            <div class="accent-grid" id="accentGrid" style="margin-bottom:8px">
              ${ACCENTS.map((a, i) =>
                `<button class="accent-swatch ${settings.accent[0] === a[0] ? "active" : ""}" data-i="${i}" style="--c1:${a[0]};--c2:${a[1]}"></button>`).join("")}
            </div>
            ${isPremium()
              ? `<div class="accent-grid" id="premiumAccentGrid" style="margin-bottom:18px">
                  ${PREMIUM_ACCENTS.map((a, i) =>
                    `<button class="accent-swatch premium ${settings.accent[0] === a[0] ? "active" : ""}" data-i="${i}" style="--c1:${a[0]};--c2:${a[1]}"></button>`).join("")}
                </div>`
              : `<button class="premium-lock-btn" id="unlockAccents" style="margin-bottom:18px">🔒 Ещё 2 акцента — эксклюзивно в lilbru+</button>`}

            <div class="option-row">
              <div class="option-info"><strong>Фон чата</strong><small>Подложка за перепиской</small></div>
            </div>
            <div class="banner-grid" id="bgGrid" style="margin-bottom:10px">
              <button class="banner-swatch none ${(settings.chatBg < 0 && !settings.chatBgImg) ? "active" : ""}" data-i="-1">Нет</button>
              ${BANNERS.map((b, i) =>
                `<button class="banner-swatch ${i === settings.chatBg ? "active" : ""} ${PREMIUM_BANNER_IDS.includes(i) && !isPremium() ? "locked" : ""}" data-i="${i}" style="background:${b}">${PREMIUM_BANNER_IDS.includes(i) && !isPremium() ? "🔒" : ""}</button>`).join("")}
              <button class="banner-swatch custom ${settings.chatBgImg ? "active hasimg" : ""}" data-i="custom" style="${settings.chatBgImg ? bannerImageCss(settings.chatBgImg) : ""}">${settings.chatBgImg ? "" : ICONS.camera}</button>
            </div>
            <div class="bg-upload-row" style="display:flex;gap:8px;margin-bottom:18px">
              <button class="btn ghost" id="bgUploadBtn" style="padding:9px 14px;font-size:13px;display:inline-flex;align-items:center;gap:6px">${ICONS.image}<span>${settings.chatBgImg ? "Заменить фон" : "Загрузить фото/GIF"}</span></button>
              ${settings.chatBgImg ? `<button class="btn ghost" id="bgClearBtn" style="padding:9px 14px;font-size:13px;color:var(--danger)">Убрать</button>` : ""}
            </div>
            <input type="file" id="bgUploadFile" accept="image/*,.gif" hidden>

            <div class="option-row">
              <div class="option-info"><strong>lilbru+</strong><small>${isPremium() ? "Подписка активна" : "Эксклюзивные баннеры и акценты"}</small></div>
              <button class="btn ghost" id="premBtn" style="padding:10px 16px">${isPremium() ? "Управлять" : "Оформить"}</button>
            </div>

            <div class="option-row">
              <div class="option-info"><strong>Стекло</strong><small>Размытие фона. Слева — лёгкий режим (быстро), справа — сильное размытие</small></div>
              <input type="range" class="slider" id="glassSlider" min="0.2" max="1" step="0.05" value="${settings.glass}">
            </div>

            <div class="option-row">
              <div class="option-info"><strong>Звуки</strong><small>Уведомления о сообщениях</small></div>
              <label class="switch"><input type="checkbox" id="soundSwitch" ${settings.sound ? "checked" : ""}><span class="track"></span></label>
            </div>

            <div class="option-row">
              <div class="option-info"><strong>Системные уведомления</strong><small>Браузерный попап о новых сообщениях</small></div>
              <label class="switch"><input type="checkbox" id="notifySwitch" ${settings.notify ? "checked" : ""}><span class="track"></span></label>
            </div>

            <div class="option-row">
              <div class="option-info"><strong>Отправка по Enter</strong><small>Если выключено — по Ctrl+Enter</small></div>
              <label class="switch"><input type="checkbox" id="enterSwitch" ${settings.enterSend ? "checked" : ""}><span class="track"></span></label>
            </div>

            <div class="option-row">
              <div class="option-info"><strong>Резервная копия</strong><small>Экспорт всех чатов и настроек в JSON или импорт из файла</small></div>
            </div>
            <div class="data-actions" style="display:flex;gap:8px;margin-bottom:8px">
              <button class="btn ghost" id="exportBtn" style="padding:10px 14px;flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px">${ICONS.download}<span>Экспорт</span></button>
              <button class="btn ghost" id="importBtn" style="padding:10px 14px;flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px">${ICONS.upload}<span>Импорт</span></button>
            </div>
            <input type="file" id="importFile" accept="application/json,.json" hidden>

            <div class="option-row">
              <div class="option-info"><strong>Сбросить данные</strong><small>Вернуть фейковые чаты и профиль</small></div>
              <button class="btn ghost" id="resetBtn" style="padding:10px 16px">Сбросить</button>
            </div>
          </div>
        </div>
      </div>`;

    const themeGrid = $("#themeGrid");
    themeGrid.addEventListener("click", e => {
      const b = e.target.closest(".theme-card");
      if (!b) return;
      settings.theme = b.dataset.theme;
      saveSettings();
      sndClick();
      renderSettingsView();
    });
    const customBgColor = $("#customBgColor");
    if (customBgColor) {
      customBgColor.addEventListener("input", () => {
        settings.customBg = customBgColor.value;
        const lbl = $("#customBgLabel");
        if (lbl) lbl.textContent = customBgColor.value;
        saveSettings();
      });
    }

    $("#animSwitch").addEventListener("change", e => {
      settings.anim = e.target.checked;
      saveSettings();
      sndClick();
    });

    $("#accentGrid").addEventListener("click", e => {
      const b = e.target.closest(".accent-swatch");
      if (!b) return;
      settings.accent = ACCENTS[Number(b.dataset.i)];
      $("#accentGrid").querySelectorAll(".accent-swatch").forEach(x => x.classList.toggle("active", x === b));
      saveSettings();
      sndClick();
    });

    $("#glassSlider").addEventListener("input", e => {
      settings.glass = parseFloat(e.target.value);
      saveSettings();
    });

    const premiumAccentGrid = $("#premiumAccentGrid");
    if (premiumAccentGrid) {
      premiumAccentGrid.addEventListener("click", e => {
        const b = e.target.closest(".accent-swatch");
        if (!b) return;
        settings.accent = PREMIUM_ACCENTS[Number(b.dataset.i)];
        premiumAccentGrid.querySelectorAll(".accent-swatch").forEach(x => x.classList.toggle("active", x === b));
        saveSettings();
        sndClick();
      });
    }
    const unlockAccents = $("#unlockAccents");
    if (unlockAccents) unlockAccents.addEventListener("click", () => go("premium"));

    $("#bgGrid").addEventListener("click", e => {
      const s = e.target.closest(".banner-swatch");
      if (!s) return;
      if (s.dataset.i === "custom") {
        $("#bgUploadFile").click();
        return;
      }
      const i = Number(s.dataset.i);
      if (i >= 0 && PREMIUM_BANNER_IDS.includes(i) && !isPremium()) {
        toast("Эксклюзивно для lilbru+");
        sndClick();
        go("premium");
        return;
      }
      settings.chatBg = i < 0 ? -1 : i;
      settings.chatBgImg = null;
      saveSettings();
      renderSettingsView();
      sndClick();
    });

    const bgUploadBtn = $("#bgUploadBtn");
    if (bgUploadBtn) bgUploadBtn.addEventListener("click", () => $("#bgUploadFile").click());
    const bgClearBtn = $("#bgClearBtn");
    if (bgClearBtn) bgClearBtn.addEventListener("click", () => {
      settings.chatBgImg = null;
      settings.chatBg = -1;
      saveSettings();
      renderSettingsView();
      sndClick();
    });
    const bgUploadFile = $("#bgUploadFile");
    if (bgUploadFile) bgUploadFile.addEventListener("change", e => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 2.5 * 1024 * 1024) { toast("Фон слишком большой — максимум 2,5 МБ"); }
      else if (isGif(f)) readRawFile(f, data => {
        settings.chatBgImg = data;
        settings.chatBg = -1;
        saveSettings();
        toast("Фон чата обновлён");
        renderSettingsView();
        sndClick();
      });
      else readImgFile(f, data => {
        settings.chatBgImg = data;
        settings.chatBg = -1;
        saveSettings();
        toast("Фон чата обновлён");
        renderSettingsView();
        sndClick();
      }, 1400);
      e.target.value = "";
    });

    $("#premBtn").addEventListener("click", () => go("premium"));

    $("#soundSwitch").addEventListener("change", e => {
      settings.sound = e.target.checked;
      saveSettings();
      sndIn();
    });
    $("#notifySwitch").addEventListener("change", e => {
      settings.notify = e.target.checked;
      saveSettings();
      if (e.target.checked) requestNotify();
    });
    $("#enterSwitch").addEventListener("change", e => {
      settings.enterSend = e.target.checked;
      saveSettings();
    });

    $("#exportBtn").addEventListener("click", exportData);
    $("#importBtn").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", e => {
      const f = e.target.files[0];
      if (!f) return;
      readTextFile(f, importData);
      e.target.value = "";
    });

    $("#resetBtn").addEventListener("click", () => {
      localStorage.removeItem(LS_CHATS);
      localStorage.removeItem(LS_PROFILE);
      localStorage.removeItem("gc_draft");
      localStorage.removeItem(LS_DRAFTS);
      location.hash = "login";
      location.reload();
    });

    $("#backBtn").addEventListener("click", () => go("chat"));
  }

  function saveSettings() {
    store.set(LS_SETTINGS, settings);
    applyTheme();
  }

  // ====== ЭКСПОРТ / ИМПОРТ ======
  function readTextFile(file, cb) {
    const r = new FileReader();
    r.onload = () => cb(String(r.result));
    r.onerror = () => toast("Не удалось прочитать файл");
    r.readAsText(file);
  }
  function exportData() {
    const data = {
      app: "lilbrumessage",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      settings,
      chats,
      msgDrafts,
    };
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "lilbrumessage-backup.json";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast("Резервная копия скачана");
      sndClick();
    } catch {
      toast("Не удалось создать файл");
    }
  }
  function importData(text) {
    let d;
    try { d = JSON.parse(text); } catch { d = null; }
    if (!d || d.app !== "lilbrumessage" || !Array.isArray(d.chats)) {
      toast("Ошибка: неверный файл резервной копии");
      return;
    }
    profile = { ...DEFAULT_PROFILE, ...(d.profile || {}) };
    settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
    chats = d.chats;
    msgDrafts = d.msgDrafts || {};
    store.set(LS_PROFILE, profile);
    store.set(LS_SETTINGS, settings);
    saveChats();
    store.set(LS_DRAFTS, msgDrafts);
    toast("Данные импортированы");
    location.hash = "chat";
    location.reload();
  }

  // ====== МУЛЬТИТАБ-СИНХРОНИЗАЦИЯ ======
  const LS_LEAD = "gc_lead";
  const LS_TYPING = "gc_typing";
  const LEAD_TTL = 5000;
  const MY_TAB_ID = Math.floor(Math.random() * 1e9);
  let isLeader = false;

  function syncMergeChats(next) {
    const localById = new Map(chats.map(c => [c.id, c]));
    const seen = new Set();
    const merged = [];
    for (const n of next) {
      seen.add(n.id);
      const l = localById.get(n.id);
      if (!l) { merged.push(n); continue; }
      const byId = new Map();
      l.messages.forEach(m => byId.set(m.id, m));
      n.messages.forEach(m => {
        const ex = byId.get(m.id);
        if (!ex || (ex.ts != null && m.ts != null && m.ts > ex.ts)) byId.set(m.id, m);
      });
      merged.push({ ...n, messages: [...byId.values()].sort((a, b) => (a.ts || 0) - (b.ts || 0)) });
    }
    for (const c of chats) if (!seen.has(c.id)) merged.push(c);
    return merged;
  }

  function syncReloadChats() {
    const next = store.get(LS_CHATS, null);
    if (!next || !next.length) return;
    chats = syncMergeChats(next);
    normalizeChats();
    replyIdx.clear();
    chats.forEach(c => replyIdx.set(c.id, 0));
    sortChats();
    if (activeId != null && !chatById(activeId)) {
      activeId = chats.length ? chats[0].id : null;
      unreadCut = null;
      fabCount = 0;
    }
  }

  function syncRerenderChats() {
    const r = (location.hash || "#chat").slice(1).replace(/^\/+/, "");
    if (r !== "chat") { renderChatList(); return; }
    renderChatList();
    if (activeId != null) {
      renderChatHeader();
      renderMessages(true);
    } else {
      renderChatView();
    }
  }

  let remoteTypingTimer = 0;
  function handleRemoteTyping(raw) {
    let st = null;
    try { st = raw ? JSON.parse(raw) : null; } catch {}
    if (!st || st.chatId == null) {
      typingChats.clear();
      renderChatList();
      hideTyping();
      return;
    }
    const wait = Math.max(0, (st.until || 0) - Date.now());
    clearTimeout(remoteTypingTimer);
    if (st.chatId === activeId) {
      showTyping();
      if (wait) remoteTypingTimer = setTimeout(hideTyping, wait);
    } else {
      typingChats.add(st.chatId);
      renderChatList();
      if (wait) remoteTypingTimer = setTimeout(() => { typingChats.delete(st.chatId); renderChatList(); hideTyping(); }, wait);
    }
  }

  let myLastClaimTs = 0;
  function leadState() { try { return JSON.parse(localStorage.getItem(LS_LEAD)) || null; } catch { return null; } }
  function claimLeadership() {
    myLastClaimTs = Date.now();
    try { localStorage.setItem(LS_LEAD, JSON.stringify({ tab: MY_TAB_ID, ts: myLastClaimTs })); } catch {}
  }
  function onLeadership() { startBackgroundTraffic(); }
  function evalLeadership() {
    const st = leadState();
    const now = Date.now();
    if (st && st.tab !== MY_TAB_ID && now - st.ts <= LEAD_TTL) {
      if (st.ts > myLastClaimTs) isLeader = false;
      return;
    }
    if (!isLeader) { isLeader = true; onLeadership(); }
    claimLeadership();
  }

  window.addEventListener("storage", e => {
    if (!e.key) return;
    if (e.key === LS_CHATS) {
      syncReloadChats();
      syncRerenderChats();
    } else if (e.key === LS_PROFILE) {
      const p = store.get(LS_PROFILE, null);
      if (p) { profile = { ...DEFAULT_PROFILE, ...p }; onRoute(); }
    } else if (e.key === LS_SETTINGS) {
      let s = store.get(LS_SETTINGS, {});
      if (!s.v || s.v < 4) s = { ...s, v: 4, glass: DEFAULT_SETTINGS.glass, accent: DEFAULT_SETTINGS.accent };
      settings = { ...DEFAULT_SETTINGS, ...s };
      applyTheme();
      onRoute();
    } else if (e.key === LS_DRAFTS) {
      msgDrafts = store.get(LS_DRAFTS, {}) || {};
    } else if (e.key === LS_TYPING) {
      handleRemoteTyping(e.newValue);
    } else if (e.key === LS_LEAD) {
      evalLeadership();
    }
  });

  setInterval(() => { if (isLeader) claimLeadership(); else evalLeadership(); }, LEAD_TTL / 2);
  evalLeadership();

  // ====== СТАРТ ======
  function ensureBlobs() {
    if (document.querySelector(".bg-blobs")) return;
    const wrap = document.createElement("div");
    wrap.className = "bg-blobs";
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = '<i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i>';
    document.body.appendChild(wrap);
  }
  ensureBlobs();

  // ====== RIPPLE (волна при нажатии) ======
  function addRipple(e) {
    const el = e.target.closest(".btn, .icon-btn, .rail-btn, .mini-btn, .gradient-swatch, .banner-swatch, .accent-swatch, .theme-card, .reaction-chip, .media-thumb, .pin-x");
    if (!el) return;
    const r = el.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2.2;
    const sp = document.createElement("span");
    sp.className = "ripple";
    sp.style.width = sp.style.height = d + "px";
    sp.style.left = (e.clientX - r.left - d / 2) + "px";
    sp.style.top = (e.clientY - r.top - d / 2) + "px";
    el.appendChild(sp);
    sp.addEventListener("animationend", () => sp.remove());
  }
  document.addEventListener("pointerdown", e => { if (settings.anim) addRipple(e); }, { passive: true });

  normalizeChats();
  onRoute();

  // Загрузочный экран
  const loader = $("#loader");
  if (loader && settings.anim !== false) {
    const msgs = [
      "Подключаемся к серверам…",
      "Грузим непрочитанные…",
      "Раскладываем эмодзи…",
      "Гладим пузыри…",
      "Завариваем чай ☕",
      "Чистим аватарки…",
      "Почти готово…",
    ];
    const msgEl = $("#loaderMsg");
    const fill = $("#loaderBarFill");
    const pctEl = $("#loaderPercent");
    const iconEl = $(".loader-icon");
    const bubblesEl = $(".loader-bubbles");
    const toastsEl = $("#loaderToasts");
    const iconSeq = ["💬", "✉️", "💌", "📨"];
    const bubbleTexts = [
      "Привет! 👋", "Как дела?", "Скинь фото 😅", "Го кофе ☕",
      "Ты тут?", "Спасибо! ❤️", "До завтра!", "Обсудим на созвоне",
      "Хаха, точно 😂", "Кину файл потом", "Окей 👌", "Круто! 🔥",
    ];
    const toastList = [
      "Привет! Ты видел моё фото? 📸",
      "Собрание перенесли на 18:00",
      "Позвони вечером!",
      "Го в футбол в субботу ⚽",
      "Скинь презентацию, плиз",
      "Поздравляю! 🎉",
    ];
    const DUR = 2200;
    const t0 = performance.now();
    let msgIdx = 0, iconIdx = 0, finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      [msgTimer, iconTimer, bubbleTimer, toastTimer].forEach(t => clearInterval(t));
      if (fill) fill.style.width = "100%";
      if (pctEl) pctEl.textContent = "100%";
      loader.classList.add("done");
      setTimeout(() => loader.remove(), 600);
    };

    const swapMsg = () => {
      if (!msgEl) return;
      msgEl.classList.add("swap");
      setTimeout(() => {
        msgEl.textContent = msgs[msgIdx = (msgIdx + 1) % msgs.length];
        msgEl.classList.remove("swap");
      }, 240);
    };

    const swapIcon = () => {
      if (!iconEl) return;
      iconEl.classList.remove("pop");
      void iconEl.offsetWidth;
      iconEl.textContent = iconSeq[iconIdx = (iconIdx + 1) % iconSeq.length];
      iconEl.classList.add("pop");
    };

    const spawnBubble = () => {
      if (!bubblesEl) return;
      const b = document.createElement("span");
      b.className = "loader-bubble " + (Math.random() < 0.5 ? "own" : "other");
      b.textContent = bubbleTexts[Math.floor(Math.random() * bubbleTexts.length)];
      b.style.left = (6 + Math.random() * 74) + "%";
      b.style.animationDuration = (3.6 + Math.random() * 1.6).toFixed(2) + "s";
      bubblesEl.appendChild(b);
      b.addEventListener("animationend", () => b.remove(), { once: true });
    };

    const spawnToast = () => {
      if (!toastsEl) return;
      const t = document.createElement("div");
      t.className = "loader-toast";
      t.textContent = toastList[Math.floor(Math.random() * toastList.length)];
      toastsEl.appendChild(t);
      setTimeout(() => t.classList.add("leave"), 2300);
      t.addEventListener("animationend", () => { if (t.classList.contains("leave")) t.remove(); });
    };

    const msgTimer = setInterval(swapMsg, 520);
    const iconTimer = setInterval(swapIcon, 650);
    const bubbleTimer = setInterval(spawnBubble, 520);
    const toastTimer = setInterval(spawnToast, 1300);
    spawnBubble();
    setTimeout(spawnToast, 600);

    const step = now => {
      const p = Math.min(1, (now - t0) / DUR);
      const w = p * 100;
      if (fill) fill.style.width = w.toFixed(1) + "%";
      if (pctEl) pctEl.textContent = Math.round(w) + "%";
      if (p < 1) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);

    loader.addEventListener("click", () => finish(), { once: true });
    setTimeout(finish, DUR + 2600);
  } else if (loader) {
    loader.remove();
  }
})();