const DB_NAME = "mindscreen-pro-db";
const DB_VERSION = 2;
const USER_STORE = "users";
const META_STORE = "meta";
const ACTIVITY_STORE = "activity";
const SESSION_KEY = "mindscreen-pro-session";

const seedAdmin = { email: "admin@mindscreen.app", password: "123456" };

const seedUsers = [
  {
    id: 1,
    name: "Aisha Noor",
    age: 21,
    role: "Student",
    device: "Android + Laptop",
    wellbeingScore: 78,
    riskLevel: "Moderate",
    screenTimeHours: 4.8,
    focusHours: 3.2,
    sleepHours: 6.7,
    unlocks: 49,
    scrollingHours: 1.9,
    typingSpeed: 53,
    heartRate: 82,
    hydration: 72,
    mainIssue: "Late-night social scrolling is reducing sleep consistency.",
    tags: ["sleep", "social"],
    goals: { maxScreenTime: 4.5, minSleep: 7, minFocus: 3.5 },
    recommendations: [
      "Turn on sleep mode at 10:30 PM.",
      "Limit social apps to 25 minutes after 9 PM.",
      "Run one 45-minute focus session before entertainment use.",
    ],
    weeklyTrend: [62, 64, 69, 66, 72, 76, 78],
    appUsage: [
      { label: "Social", minutes: 125, color: "#8b5cf6" },
      { label: "Study", minutes: 102, color: "#10b981" },
      { label: "Video", minutes: 58, color: "#0ea5e9" },
      { label: "Other", minutes: 31, color: "#f59e0b" },
    ],
  },
  {
    id: 2,
    name: "Omar Khalid",
    age: 22,
    role: "Student",
    device: "iPhone + MacBook",
    wellbeingScore: 85,
    riskLevel: "Low",
    screenTimeHours: 3.9,
    focusHours: 4.1,
    sleepHours: 7.4,
    unlocks: 34,
    scrollingHours: 1.1,
    typingSpeed: 58,
    heartRate: 76,
    hydration: 80,
    mainIssue: "Frequent messaging interruptions affect deep work sessions.",
    tags: ["focus", "notifications"],
    goals: { maxScreenTime: 4, minSleep: 7.2, minFocus: 4 },
    recommendations: [
      "Mute messaging apps during your two main study blocks.",
      "Keep one 15-minute break between long sessions.",
      "Use app grouping so social tools stay off the first home screen.",
    ],
    weeklyTrend: [70, 73, 77, 79, 82, 84, 85],
    appUsage: [
      { label: "Study", minutes: 148, color: "#10b981" },
      { label: "Messaging", minutes: 63, color: "#0ea5e9" },
      { label: "Social", minutes: 46, color: "#8b5cf6" },
      { label: "Other", minutes: 28, color: "#f59e0b" },
    ],
  },
  {
    id: 3,
    name: "Sara Ahmed",
    age: 20,
    role: "Student",
    device: "Android",
    wellbeingScore: 61,
    riskLevel: "High",
    screenTimeHours: 6.1,
    focusHours: 2,
    sleepHours: 5.9,
    unlocks: 71,
    scrollingHours: 2.8,
    typingSpeed: 46,
    heartRate: 91,
    hydration: 58,
    mainIssue: "Entertainment usage is crowding out study time and sleep recovery.",
    tags: ["addiction", "sleep", "focus"],
    goals: { maxScreenTime: 4.5, minSleep: 7, minFocus: 3 },
    recommendations: [
      "Cut entertainment apps by 20 minutes per day this week.",
      "Start each day with study-first usage before social media.",
      "Place the phone away from the bed and enable bedtime reminders.",
    ],
    weeklyTrend: [49, 54, 56, 58, 60, 63, 61],
    appUsage: [
      { label: "Video", minutes: 138, color: "#0ea5e9" },
      { label: "Social", minutes: 110, color: "#8b5cf6" },
      { label: "Study", minutes: 72, color: "#10b981" },
      { label: "Other", minutes: 46, color: "#f59e0b" },
    ],
  },
];

const activityTemplates = [
  { type: "screen", tone: "sky", title: "Screen spike detected", detail: "Entertainment usage crossed the hourly baseline." },
  { type: "focus", tone: "green", title: "Focus streak complete", detail: "A protected focus block was completed without interruptions." },
  { type: "alert", tone: "amber", title: "Break reminder sent", detail: "The system pushed a posture and hydration reminder." },
  { type: "sleep", tone: "violet", title: "Sleep protection enabled", detail: "Wind-down mode was suggested before bedtime." },
];

const state = {
  screen: "login",
  route: "overview",
  users: [],
  admin: seedAdmin,
  selectedUserId: null,
  activeUserTab: "tracking",
  search: "",
  riskFilter: "All",
  sortBy: "score-desc",
  message: "",
  liveTick: 0,
  trackerStarted: false,
  activity: [],
  sessionStartedAt: null,
};

const app = document.getElementById("app");

const openDb = () =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(USER_STORE)) db.createObjectStore(USER_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(ACTIVITY_STORE)) {
        const activityStore = db.createObjectStore(ACTIVITY_STORE, { keyPath: "id" });
        activityStore.createIndex("userId", "userId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const waitTx = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

function buildUsageFromScreenTime(screenTimeHours) {
  const totalMinutes = Math.max(60, Math.round(Number(screenTimeHours) * 60));
  return [
    { label: "Social", minutes: Math.round(totalMinutes * 0.32), color: "#8b5cf6" },
    { label: "Study", minutes: Math.round(totalMinutes * 0.28), color: "#10b981" },
    { label: "Video", minutes: Math.round(totalMinutes * 0.24), color: "#0ea5e9" },
    { label: "Other", minutes: Math.round(totalMinutes * 0.16), color: "#f59e0b" },
  ];
}

function buildTrendFromScore(score) {
  const safeScore = Math.max(35, Math.min(95, Number(score)));
  return [-9, -6, -4, -2, 1, 3, 0].map((offset) => Math.max(30, Math.min(97, safeScore + offset)));
}

function buildRecommendations(riskLevel, goals) {
  const suggestions = {
    Low: [
      "Keep your notification batching enabled during deep work blocks.",
      `Maintain sleep above ${goals.minSleep.toFixed(1)} hours with nightly wind-down reminders.`,
      `Protect your current focus average with a target of ${goals.minFocus.toFixed(1)} hours daily.`,
    ],
    Moderate: [
      `Reduce daily screen time below ${goals.maxScreenTime.toFixed(1)} hours this week.`,
      "Schedule one uninterrupted focus block before entertainment apps.",
      "Enable break reminders every 45 minutes to reduce scrolling drift.",
    ],
    High: [
      "Apply strict limits to the most distracting apps and lock them after the threshold.",
      "Start the day in focus mode before opening social or video apps.",
      `Raise sleep toward ${goals.minSleep.toFixed(1)} hours with bedtime protection and device cut-off.`,
    ],
  };
  return suggestions[riskLevel] || suggestions.Moderate;
}

function classifyRisk(score, screenTimeHours, sleepHours) {
  if (score >= 80 && screenTimeHours <= 4.5 && sleepHours >= 7) return "Low";
  if (score >= 65 && screenTimeHours <= 5.5 && sleepHours >= 6.2) return "Moderate";
  return "High";
}

function scoreClass(score) {
  if (score >= 80) return "score-green";
  if (score >= 65) return "score-amber";
  return "score-rose";
}

function pillClass(risk) {
  if (risk === "Low") return "pill-green";
  if (risk === "Moderate") return "pill-amber";
  return "pill-rose";
}

function iconToneClass(tone) {
  return `icon-${tone}`;
}

function cardRiskClass(risk) {
  if (risk === "Low") return "card-risk-low";
  if (risk === "Moderate") return "card-risk-moderate";
  return "card-risk-high";
}

function formatDateTime(value) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatTimeAgo(value) {
  const diffMinutes = Math.max(1, Math.round((Date.now() - value) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  return `${Math.round(diffMinutes / 60)} hr ago`;
}

function nextUserId() {
  return state.users.length ? Math.max(...state.users.map((user) => user.id)) + 1 : 1;
}

function nextActivityId() {
  return state.activity.length ? Math.max(...state.activity.map((item) => item.id)) + 1 : 1;
}

function setSession(active) {
  if (active) localStorage.setItem(SESSION_KEY, "active");
  else localStorage.removeItem(SESSION_KEY);
}

function getSession() {
  return localStorage.getItem(SESSION_KEY) === "active";
}

function createUserRecord(partial) {
  const score = Number(partial.wellbeingScore);
  const screenTimeHours = Number(partial.screenTimeHours);
  const focusHours = Number(partial.focusHours);
  const sleepHours = Number(partial.sleepHours);
  const goals = {
    maxScreenTime: Number(partial.goals?.maxScreenTime ?? Math.max(3.5, screenTimeHours - 0.5)),
    minSleep: Number(partial.goals?.minSleep ?? Math.max(7, sleepHours + 0.3)),
    minFocus: Number(partial.goals?.minFocus ?? Math.max(3, focusHours + 0.4)),
  };
  const riskLevel = partial.riskLevel || classifyRisk(score, screenTimeHours, sleepHours);
  return {
    id: partial.id,
    name: partial.name,
    age: Number(partial.age),
    role: partial.role || "Student",
    device: partial.device || "Smartphone",
    wellbeingScore: score,
    riskLevel,
    screenTimeHours,
    focusHours,
    sleepHours,
    unlocks: Number(partial.unlocks ?? Math.round(screenTimeHours * 10 + 8)),
    scrollingHours: Number(partial.scrollingHours ?? Math.max(0.6, screenTimeHours * 0.38).toFixed(1)),
    typingSpeed: Number(partial.typingSpeed ?? 50),
    heartRate: Number(partial.heartRate ?? 80),
    hydration: Number(partial.hydration ?? 70),
    mainIssue: partial.mainIssue,
    tags: partial.tags || [],
    goals,
    recommendations: partial.recommendations || buildRecommendations(riskLevel, goals),
    weeklyTrend: partial.weeklyTrend || buildTrendFromScore(score),
    appUsage: partial.appUsage || buildUsageFromScreenTime(screenTimeHours),
  };
}

function createActivityEntry(userId, userName, templateIndex = 0, overrides = {}) {
  const template = activityTemplates[templateIndex % activityTemplates.length];
  return {
    id: overrides.id ?? nextActivityId(),
    userId,
    userName,
    type: overrides.type ?? template.type,
    tone: overrides.tone ?? template.tone,
    title: overrides.title ?? template.title,
    detail: overrides.detail ?? template.detail,
    impact: overrides.impact ?? `${Math.max(4, 12 - templateIndex)}% shift vs baseline`,
    createdAt: overrides.createdAt ?? Date.now(),
    source: overrides.source ?? "system",
    action: overrides.action ?? template.type,
  };
}

function getSelectedUser() {
  return state.users.find((user) => user.id === state.selectedUserId) || null;
}

function getUserActivity(userId) {
  return state.activity.filter((item) => item.userId === userId).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
}

function getGlobalStats() {
  const userCount = state.users.length || 1;
  const avgScore = Math.round(state.users.reduce((sum, user) => sum + user.wellbeingScore, 0) / userCount);
  const avgScreen = state.users.reduce((sum, user) => sum + user.screenTimeHours, 0) / userCount;
  return {
    avgScore,
    avgScreen: avgScreen.toFixed(1),
    highRisk: state.users.filter((user) => user.riskLevel === "High").length,
    alerts: state.activity.filter((item) => item.type === "alert").length,
  };
}

function getRealTrackingStats() {
  const realEvents = state.activity.filter((item) => item.source === "real");
  const countByAction = (action) => realEvents.filter((item) => item.action === action).length;
  const lastActive = realEvents.length ? formatTimeAgo(realEvents[0].createdAt) : "No activity";
  const sessionMinutes = state.sessionStartedAt ? Math.max(1, Math.round((Date.now() - state.sessionStartedAt) / 60000)) : 0;
  return {
    total: realEvents.length,
    signIns: countByAction("sign-in"),
    routeViews: countByAction("route-view"),
    profileOpens: countByAction("profile-open"),
    exports: countByAction("export"),
    searches: countByAction("search"),
    syncs: countByAction("sync"),
    formUpdates: countByAction("create-user") + countByAction("edit-user"),
    sessionMinutes,
    lastActive,
  };
}

function trackRealEvent({ userId = 0, userName = "Admin", type = "focus", tone = "sky", title, detail, impact, action }) {
  const entry = createActivityEntry(userId, userName, 0, {
    type,
    tone,
    title,
    detail,
    impact,
    source: "real",
    action,
    createdAt: Date.now(),
  });
  state.activity = [entry, ...state.activity].sort((a, b) => b.createdAt - a.createdAt);
  saveActivityEntry(entry).catch(() => {});
}

function getFilteredUsers() {
  const search = state.search.trim().toLowerCase();
  let list = [...state.users];
  if (search) {
    list = list.filter((user) => [user.name, user.role, user.device, user.mainIssue, user.riskLevel].join(" ").toLowerCase().includes(search));
  }
  if (state.riskFilter !== "All") list = list.filter((user) => user.riskLevel === state.riskFilter);
  const sorters = {
    "score-desc": (a, b) => b.wellbeingScore - a.wellbeingScore,
    "screen-desc": (a, b) => b.screenTimeHours - a.screenTimeHours,
    "name-asc": (a, b) => a.name.localeCompare(b.name),
  };
  list.sort(sorters[state.sortBy] || sorters["score-desc"]);
  return list;
}

function getLiveStatus(user) {
  const appLabels = user.appUsage.map((item) => item.label);
  return {
    activeApp: appLabels[state.liveTick % appLabels.length],
    sessionMinutes: 16 + ((state.liveTick * 4 + user.id * 6) % 42),
    pickups: 3 + ((state.liveTick + user.id) % 7),
    typingState: state.liveTick % 2 === 0 ? "Consistent" : "Slowing down",
    posture: state.liveTick % 3 === 0 ? "Needs break" : "Stable",
    syncTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

async function seedDatabase() {
  const db = await openDb();
  const tx = db.transaction([USER_STORE, META_STORE, ACTIVITY_STORE], "readwrite");
  const userStore = tx.objectStore(USER_STORE);
  const metaStore = tx.objectStore(META_STORE);
  const activityStore = tx.objectStore(ACTIVITY_STORE);

  const userCount = await new Promise((resolve, reject) => {
    const request = userStore.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (userCount === 0) seedUsers.map(createUserRecord).forEach((user) => userStore.put(user));

  const admin = await new Promise((resolve, reject) => {
    const request = metaStore.get("admin");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (!admin) metaStore.put({ key: "admin", value: seedAdmin });

  const activityCount = await new Promise((resolve, reject) => {
    const request = activityStore.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (activityCount === 0) {
    [
      createActivityEntry(1, "Aisha Noor", 0, { createdAt: Date.now() - 1000 * 60 * 35, detail: "Social use increased after 10:00 PM for two nights in a row." }),
      createActivityEntry(2, "Omar Khalid", 1, { createdAt: Date.now() - 1000 * 60 * 78, detail: "Focus mode stayed active for a full study block." }),
      createActivityEntry(3, "Sara Ahmed", 2, { createdAt: Date.now() - 1000 * 60 * 14, detail: "The user exceeded the recommended break interval." }),
      createActivityEntry(3, "Sara Ahmed", 3, { createdAt: Date.now() - 1000 * 60 * 150, detail: "Bedtime intervention was triggered after midnight scrolling." }),
    ].forEach((item) => activityStore.put(item));
  }

  await waitTx(tx);
  db.close();
}

async function getUsers() {
  await seedDatabase();
  const db = await openDb();
  const tx = db.transaction(USER_STORE, "readonly");
  const users = await new Promise((resolve, reject) => {
    const request = tx.objectStore(USER_STORE).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.id - b.id));
    request.onerror = () => reject(request.error);
  });
  db.close();
  return users;
}

async function getAdmin() {
  await seedDatabase();
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readonly");
  const admin = await new Promise((resolve, reject) => {
    const request = tx.objectStore(META_STORE).get("admin");
    request.onsuccess = () => resolve(request.result?.value || seedAdmin);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return admin;
}

async function getActivity() {
  await seedDatabase();
  const db = await openDb();
  const tx = db.transaction(ACTIVITY_STORE, "readonly");
  const activity = await new Promise((resolve, reject) => {
    const request = tx.objectStore(ACTIVITY_STORE).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
  db.close();
  return activity;
}

async function saveUser(user) {
  await seedDatabase();
  const db = await openDb();
  const tx = db.transaction(USER_STORE, "readwrite");
  tx.objectStore(USER_STORE).put(user);
  await waitTx(tx);
  db.close();
}

async function deleteUserById(userId) {
  await seedDatabase();
  const db = await openDb();
  const tx = db.transaction([USER_STORE, ACTIVITY_STORE], "readwrite");
  tx.objectStore(USER_STORE).delete(userId);
  const activityStore = tx.objectStore(ACTIVITY_STORE);
  const items = await new Promise((resolve, reject) => {
    const request = activityStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  items.filter((item) => item.userId === userId).forEach((item) => activityStore.delete(item.id));
  await waitTx(tx);
  db.close();
}

async function saveActivityEntry(entry) {
  await seedDatabase();
  const db = await openDb();
  const tx = db.transaction(ACTIVITY_STORE, "readwrite");
  tx.objectStore(ACTIVITY_STORE).put(entry);
  await waitTx(tx);
  db.close();
}

async function resetDatabase() {
  const request = window.indexedDB.deleteDatabase(DB_NAME);
  await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Database reset blocked"));
  });
  await seedDatabase();
}

function shellHeader() {
  const signedIn = getSession();
  return `
    <header class="shell-header">
      <div class="brand">
        <div class="brand-badge">PP</div>
        <div>
          <h1>PulsePath</h1>
          <p>Personalized wellbeing analytics</p>
        </div>
      </div>
      ${signedIn ? `
        <nav class="nav-tabs">
          <button class="nav-tab ${state.route === "overview" ? "is-active" : ""}" data-action="route-overview">Overview</button>
          <button class="nav-tab ${state.route === "directory" ? "is-active" : ""}" data-action="route-directory">Users</button>
          <button class="nav-tab ${state.route === "reports" ? "is-active" : ""}" data-action="route-reports">Reports</button>
        </nav>
        <div class="header-actions">
          <button class="btn btn-outline" type="button" data-action="simulate-sync">Sync</button>
          <button class="btn btn-outline" type="button" data-action="reset-db">Reset</button>
          <button class="btn btn-outline" type="button" data-action="sign-out">Sign out</button>
        </div>
      ` : '<div class="signin-badge">Secure sign in</div>'}
    </header>
  `;
}

function summaryCard(label, value, helper, tone) {
  return `
    <div class="card metric-card">
      <div class="icon-box ${iconToneClass(tone)}">${label.slice(0, 2).toUpperCase()}</div>
      <p class="list-meta metric-label">${label}</p>
      <h3>${value}</h3>
      <p class="subtext">${helper}</p>
    </div>
  `;
}

function buildActivityMarkup(items) {
  if (!items.length) return '<div class="empty-state">No activity tracked yet.</div>';
  return items.map((item) => `
      <div class="timeline-item timeline-${item.tone}">
        <div>
          <strong>${item.title}</strong>
          <p>${item.detail}</p>
        </div>
        <div class="timeline-meta">
          <span>${item.impact}</span>
          <span>${formatTimeAgo(item.createdAt)}</span>
        </div>
      </div>
    `).join("");
}

function loginScreen() {
  const stats = getGlobalStats();
  app.innerHTML = `
    ${shellHeader()}
    <main class="grid grid-login">
      <section class="hero-card hero-grid">
        <div>
          <div class="hero-chip">PulsePath</div>
          <h2 class="hero-title">Personal insights. Better habits.</h2>
          <p class="hero-text">Sign in to view focused analytics and actions.</p>
          <div class="stats-inline">
            <div class="tile tile-sky"><h3>${stats.avgScore}</h3><p>Avg score</p></div>
            <div class="tile tile-green"><h3>${stats.alerts}</h3><p>Active alerts</p></div>
            <div class="tile tile-violet"><h3>${state.users.length}</h3><p>User profiles</p></div>
          </div>
        </div>
      </section>
      <section class="panel panel-sky signin-card">
        <div class="panel-head">
          <div>
            <div class="signin-badge">Secure access</div>
            <h3 class="signin-title">Sign in</h3>
            <p class="signin-copy">Access your dashboard.</p>
          </div>
        </div>
        <form id="login-form">
          <div class="form-group">
            <label class="label" for="email">Email</label>
            <div class="input-wrap">
              <span class="input-icon">ID</span>
              <input class="input input-sky" id="email" value="${state.admin.email}" />
            </div>
          </div>
          <div class="form-group">
            <label class="label" for="password">Password</label>
            <div class="input-wrap">
              <span class="input-icon">PW</span>
              <input class="input input-green" id="password" type="password" value="${state.admin.password}" />
            </div>
          </div>
          <button class="btn btn-primary wide-btn" type="submit">Open dashboard</button>
          <p id="login-error" class="error"></p>
        </form>
        <div class="hint-box">
          <p><strong>Demo login</strong></p>
          <p class="muted">Email: ${state.admin.email}</p>
          <p class="muted">Password: ${state.admin.password}</p>
        </div>
      </section>
    </main>
  `;
  document.getElementById("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value.trim();
    if (email === state.admin.email.toLowerCase() && password === state.admin.password) {
      setSession(true);
      state.sessionStartedAt = Date.now();
      state.screen = "dashboard";
      state.route = "overview";
      state.message = "";
      trackRealEvent({
        type: "focus",
        tone: "green",
        title: "Admin signed in",
        detail: "A real sign-in event was recorded for the dashboard.",
        impact: "Session started",
        action: "sign-in",
      });
      trackRealEvent({
        type: "screen",
        tone: "sky",
        title: "Overview opened",
        detail: "The overview dashboard was opened after sign-in.",
        impact: "Route view",
        action: "route-view",
      });
      render();
      return;
    }
    document.getElementById("login-error").textContent = "Invalid credentials.";
  });
}

function buildOverviewScreen() {
  const stats = getGlobalStats();
  const topUsers = getFilteredUsers().slice(0, 3);
  return `
    <main class="grid">
      <section class="hero-card dashboard-hero">
        <div>
          <div class="hero-chip">PulsePath dashboard</div>
          <h2 class="hero-title">Personalized analytics at a glance.</h2>
          <p class="hero-text">Track users and see actions fast.</p>
        </div>
        <div class="cards stats compact-stats">
          ${summaryCard("Avg score", `${stats.avgScore}/100`, "Overall balance", "green")}
          ${summaryCard("Avg screen", `${stats.avgScreen}h`, "Daily average", "sky")}
          ${summaryCard("High risk", `${stats.highRisk}`, "Needs attention", "amber")}
        </div>
      </section>
      <section class="cards stats">
        ${summaryCard("Users", `${state.users.length}`, "Tracked users", "violet")}
        ${summaryCard("Alerts", `${stats.alerts}`, "Active alerts", "amber")}
        ${summaryCard("Data sync", "Live", "Auto refresh", "sky")}
      </section>
      <section class="panel panel-green">
          <div class="panel-head">
            <div>
              <h3>Latest events</h3>
              <p>Recent tracking activity</p>
            </div>
          </div>
          <div class="timeline-list">${buildActivityMarkup(state.activity.slice(0, 5))}</div>
      </section>
      <section class="panel panel-sky">
        <div class="panel-head">
          <div>
            <h3>Priority users</h3>
            <p>Quick access into the strongest or riskiest profiles</p>
          </div>
        </div>
        <div class="cards three">
          ${topUsers.map((user) => `
              <button class="card ${cardRiskClass(user.riskLevel)}" data-action="select-user" data-id="${user.id}">
                <div class="card-top">
                  <div class="icon-box ${iconToneClass(user.riskLevel === "Low" ? "green" : user.riskLevel === "Moderate" ? "amber" : "rose")}">${user.riskLevel === "High" ? "!" : "OK"}</div>
                  <span class="score-pill ${pillClass(user.riskLevel)}">${user.riskLevel}</span>
                </div>
                <h3>${user.name}</h3>
                <p class="subtext">${user.device}</p>
                <div class="card-info">
                  <span>Score: ${user.wellbeingScore}</span>
                  <span>Screen: ${user.screenTimeHours.toFixed(1)}h</span>
                  <span>Sleep: ${user.sleepHours.toFixed(1)}h</span>
                </div>
                <div class="link-action">Open detailed tracking</div>
              </button>
            `).join("")}
        </div>
      </section>
    </main>
  `;
}

function userDirectoryScreen() {
  const users = getFilteredUsers();
  return `
    <main class="grid">
      <section class="panel panel-violet">
        <div class="panel-head">
          <div>
            <h3>User directory</h3>
            <p>Manage users</p>
          </div>
          <div class="chip" style="background:var(--sky-soft); color:#0369a1;">${users.length} shown</div>
        </div>
        <div class="toolbar">
          <input class="input input-sky toolbar-search" id="search-input" placeholder="Search name, issue, device..." value="${state.search}" />
          <select class="input input-green toolbar-select" id="risk-filter">
            <option value="All" ${state.riskFilter === "All" ? "selected" : ""}>All risk levels</option>
            <option value="Low" ${state.riskFilter === "Low" ? "selected" : ""}>Low</option>
            <option value="Moderate" ${state.riskFilter === "Moderate" ? "selected" : ""}>Moderate</option>
            <option value="High" ${state.riskFilter === "High" ? "selected" : ""}>High</option>
          </select>
          <select class="input input-violet toolbar-select" id="sort-by">
            <option value="score-desc" ${state.sortBy === "score-desc" ? "selected" : ""}>Highest score</option>
            <option value="screen-desc" ${state.sortBy === "screen-desc" ? "selected" : ""}>Highest screen time</option>
            <option value="name-asc" ${state.sortBy === "name-asc" ? "selected" : ""}>Name A-Z</option>
          </select>
        </div>
      </section>
      <section class="cards split">
        <div class="panel panel-green">
          <div class="panel-head">
            <div>
              <h3>Create profile</h3>
              <p>Add a user</p>
            </div>
          </div>
          <form id="add-user-form" class="form-grid">
            <div class="form-group"><label class="label" for="new-name">Name</label><input class="input input-sky" id="new-name" required /></div>
            <div class="form-group"><label class="label" for="new-age">Age</label><input class="input input-green" id="new-age" type="number" min="10" max="99" required /></div>
            <div class="form-group"><label class="label" for="new-role">Role</label><input class="input input-sky" id="new-role" value="Student" required /></div>
            <div class="form-group"><label class="label" for="new-device">Primary device</label><input class="input input-violet" id="new-device" value="Android" required /></div>
            <div class="form-group"><label class="label" for="new-score">Wellbeing score</label><input class="input input-sky" id="new-score" type="number" min="0" max="100" required /></div>
            <div class="form-group"><label class="label" for="new-screen">Screen time (hours)</label><input class="input input-green" id="new-screen" type="number" min="0" step="0.1" required /></div>
            <div class="form-group"><label class="label" for="new-focus">Focus time (hours)</label><input class="input input-sky" id="new-focus" type="number" min="0" step="0.1" required /></div>
            <div class="form-group"><label class="label" for="new-sleep">Sleep (hours)</label><input class="input input-violet" id="new-sleep" type="number" min="0" step="0.1" required /></div>
            <div class="form-group form-group-wide"><label class="label" for="new-issue">Main issue</label><textarea class="input input-amber textarea" id="new-issue" required></textarea></div>
            <div class="form-group form-group-wide"><button class="btn btn-primary" type="submit">Save profile</button></div>
          </form>
          ${state.message ? `<p class="success-message">${state.message}</p>` : ""}
        </div>
        <div class="panel panel-sky">
          <div class="panel-head">
            <div>
              <h3>Tracked users</h3>
              <p>Profiles</p>
            </div>
          </div>
          <div class="directory-list">
            ${users.map((user) => `
                <button class="directory-item ${cardRiskClass(user.riskLevel)}" data-action="select-user" data-id="${user.id}">
                  <div>
                    <div class="directory-head">
                      <strong>${user.name}</strong>
                      <span class="mini-pill ${pillClass(user.riskLevel)}">${user.wellbeingScore}</span>
                    </div>
                    <p>${user.role} • ${user.device}</p>
                    <p class="muted">${user.mainIssue}</p>
                  </div>
                  <div class="directory-meta">
                    <span>${user.screenTimeHours.toFixed(1)}h</span>
                    <span>${user.unlocks} unlocks</span>
                  </div>
                </button>
              `).join("")}
          </div>
        </div>
      </section>
    </main>
  `;
}

function chartBlock(user) {
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  return user.weeklyTrend.map((value, index) => {
    let color = "linear-gradient(180deg,#fbbf24,#f59e0b)";
    if (value >= 80) color = "linear-gradient(180deg,#34d399,#10b981)";
    else if (value >= 65) color = "linear-gradient(180deg,#38bdf8,#0ea5e9)";
    return `<div class="chart-col"><div class="chart-bar" style="height:${value}%; background:${color}"></div><span class="muted">${labels[index]}</span></div>`;
  }).join("");
}

function usageBlock(user) {
  const total = user.appUsage.reduce((sum, item) => sum + item.minutes, 0) || 1;
  return user.appUsage.map((item) => `
      <div class="usage-item">
        <div class="usage-head">
          <div class="usage-left">
            <span class="usage-dot" style="background:${item.color}"></span>
            <strong>${item.label}</strong>
          </div>
          <span class="muted">${item.minutes} min</span>
        </div>
        <div class="progress"><div class="progress-fill" style="width:${(item.minutes / total) * 100}%; background:${item.color}"></div></div>
      </div>
    `).join("");
}

function reportSummary(user) {
  const goalsMet = [user.screenTimeHours <= user.goals.maxScreenTime, user.sleepHours >= user.goals.minSleep, user.focusHours >= user.goals.minFocus].filter(Boolean).length;
  return `
    <div class="report-grid">
      <div class="report-card"><span class="report-label">Personal status</span><strong>${user.riskLevel}</strong><p>${user.mainIssue}</p></div>
      <div class="report-card"><span class="report-label">Goal completion</span><strong>${goalsMet}/3 goals</strong><p>Measured against this user's targets.</p></div>
      <div class="report-card"><span class="report-label">Best next step</span><strong>${user.recommendations[0]}</strong><p>Chosen from the personal analysis.</p></div>
    </div>
  `;
}

function userDetailScreen() {
  const user = getSelectedUser();
  if (!user) {
    state.route = "directory";
    return userDirectoryScreen();
  }
  const live = getLiveStatus(user);
  const activity = getUserActivity(user.id);
  return `
    <main class="grid grid-main">
      <section>
        <section class="hero-card">
          <div class="detail-topbar">
            <button class="btn btn-secondary" data-action="route-directory">Back to users</button>
            <div class="chip ${pillClass(user.riskLevel)}">${user.riskLevel} risk</div>
          </div>
          <div class="detail-header">
            <div class="score-ring"><div style="text-align:center;"><strong class="${scoreClass(user.wellbeingScore)}">${user.wellbeingScore}</strong><div class="score-caption">score</div></div></div>
            <div>
              <h2 class="hero-title detail-title">${user.name}</h2>
              <p class="hero-text">${user.mainIssue}</p>
              <div class="tabs">
                <button class="tab ${state.activeUserTab === "tracking" ? "active-blue" : ""}" data-action="tab-tracking">Tracking</button>
                <button class="tab ${state.activeUserTab === "analysis" ? "active-green" : ""}" data-action="tab-analysis">Analysis</button>
                <button class="tab ${state.activeUserTab === "reports" ? "active-amber" : ""}" data-action="tab-reports">Reports</button>
              </div>
            </div>
          </div>
        </section>
        ${state.activeUserTab === "tracking" ? `
          <section class="cards stats" style="margin-top:24px;">
            ${summaryCard("Screen time", `${user.screenTimeHours.toFixed(1)}h`, "Collected from device activity", "sky")}
            ${summaryCard("Focus hours", `${user.focusHours.toFixed(1)}h`, "Protected productive sessions", "green")}
            ${summaryCard("Sleep", `${user.sleepHours.toFixed(1)}h`, "Recovery and bedtime tracking", "violet")}
          </section>
          <section class="cards split" style="margin-top:24px;">
            <div class="panel panel-violet">
              <div class="panel-head">
                <div><h3>Live tracking</h3><p>Current activity</p></div>
                <div class="chip live-chip">Sync ${live.syncTime}</div>
              </div>
              <div class="cards stats live-stats">
                ${summaryCard("Active app", live.activeApp, "Foreground app currently active", "violet")}
                ${summaryCard("Session", `${live.sessionMinutes} min`, "Continuous session length", "sky")}
                ${summaryCard("Pickups", `${live.pickups}`, "Phone pickups this cycle", "amber")}
              </div>
              <div class="live-feed">
                <div class="live-feed-item"><strong>Typing pattern</strong><span>${live.typingState}</span></div>
                <div class="live-feed-item"><strong>Posture / fatigue</strong><span>${live.posture}</span></div>
                <div class="live-feed-item"><strong>Status</strong><span>${live.activeApp} active</span></div>
              </div>
            </div>
            <div class="panel panel-green">
              <div class="panel-head"><div><h3>Signals</h3><p>Tracked metrics</p></div></div>
              <div class="signal-grid">
                <div class="signal-item"><span>Unlocks</span><strong>${user.unlocks}</strong></div>
                <div class="signal-item"><span>Scrolling</span><strong>${user.scrollingHours.toFixed(1)}h</strong></div>
                <div class="signal-item"><span>Typing speed</span><strong>${user.typingSpeed} wpm</strong></div>
                <div class="signal-item"><span>Heart rate</span><strong>${user.heartRate} bpm</strong></div>
                <div class="signal-item"><span>Hydration</span><strong>${user.hydration}%</strong></div>
                <div class="signal-item"><span>Device</span><strong>${user.device}</strong></div>
              </div>
            </div>
          </section>
          <section class="cards split" style="margin-top:24px;">
            <div class="panel panel-sky">
              <div class="panel-head"><div><h3>Weekly wellbeing trend</h3><p>Seven-day score movement</p></div></div>
              <div class="chart-bars">${chartBlock(user)}</div>
            </div>
            <div class="panel panel-green">
              <div class="panel-head"><div><h3>App usage distribution</h3><p>Current usage breakdown</p></div></div>
              <div class="usage-list">${usageBlock(user)}</div>
            </div>
          </section>
        ` : state.activeUserTab === "analysis" ? `
          <section class="cards split" style="margin-top:24px;">
            <div class="panel panel-violet">
              <div class="panel-head"><div><h3>Personalized analytics</h3><p>Risk summary</p></div></div>
              <div class="analysis-grid">
                <div class="analysis-card"><span class="report-label">Risk</span><strong>${user.riskLevel}</strong><p>From score, sleep, and screen use.</p></div>
                <div class="analysis-card"><span class="report-label">Trigger</span><strong>${user.tags.join(", ") || "general imbalance"}</strong><p>Top behavior signal.</p></div>
                <div class="analysis-card"><span class="report-label">Action</span><strong>${user.recommendations[0]}</strong><p>Best next step.</p></div>
              </div>
            </div>
            <div class="panel panel-amber">
              <div class="panel-head"><div><h3>Personalized solutions</h3><p>Suggested actions</p></div></div>
              <div class="solution-list">
                ${user.recommendations.map((item, index) => `<div class="solution-item ${["solution-green", "solution-sky", "solution-violet"][index % 3]}"><strong>${index + 1}.</strong><span>${item}</span></div>`).join("")}
              </div>
            </div>
          </section>
          <section class="panel panel-green" style="margin-top:24px;">
            <div class="panel-head"><div><h3>Timeline</h3><p>Recent events</p></div></div>
            <div class="timeline-list">${buildActivityMarkup(activity)}</div>
          </section>
        ` : `
          <section class="panel panel-sky" style="margin-top:24px;">
            <div class="panel-head"><div><h3>Report summary</h3><p>Quick overview</p></div></div>
            ${reportSummary(user)}
          </section>
          <section class="cards split" style="margin-top:24px;">
            <div class="panel panel-green">
              <div class="panel-head"><div><h3>Goal tracking</h3><p>Targets vs actual</p></div></div>
              <div class="goal-list">
                <div class="goal-row"><span>Max screen time</span><strong>${user.screenTimeHours.toFixed(1)}h / ${user.goals.maxScreenTime.toFixed(1)}h</strong></div>
                <div class="goal-row"><span>Minimum sleep</span><strong>${user.sleepHours.toFixed(1)}h / ${user.goals.minSleep.toFixed(1)}h</strong></div>
                <div class="goal-row"><span>Minimum focus</span><strong>${user.focusHours.toFixed(1)}h / ${user.goals.minFocus.toFixed(1)}h</strong></div>
              </div>
            </div>
            <div class="panel panel-violet">
              <div class="panel-head"><div><h3>Export</h3><p>Download report</p></div></div>
              <div class="flow-list">
                <button class="btn btn-primary" data-action="export-user">Export JSON report</button>
                <button class="btn btn-outline" data-action="simulate-user-event">Add tracking event</button>
                <p class="muted">The exported file includes profile data, live metrics, trend history, and recommendations.</p>
              </div>
            </div>
          </section>
        `}
      </section>
      <aside class="grid sidebar-grid">
        <section class="panel panel-violet">
          <div class="panel-head"><div><h3>User profile</h3><p>Info</p></div></div>
          <div class="profile-meta">
            <div><span>Role</span><strong>${user.role}</strong></div>
            <div><span>Age</span><strong>${user.age}</strong></div>
            <div><span>Device</span><strong>${user.device}</strong></div>
            <div><span>Tracked since</span><strong>${formatDateTime(Date.now() - user.id * 86400000)}</strong></div>
          </div>
        </section>
        <section class="panel issue-box"><div class="panel-head"><div><h3>Main issue</h3></div></div><p>${user.mainIssue}</p></section>
        <section class="panel panel-sky">
          <div class="panel-head"><div><h3>Edit profile</h3><p>Update user</p></div></div>
          <form id="edit-user-form" class="form-grid">
            <div class="form-group"><label class="label" for="edit-name">Name</label><input class="input input-sky" id="edit-name" value="${user.name}" required /></div>
            <div class="form-group"><label class="label" for="edit-age">Age</label><input class="input input-green" id="edit-age" type="number" min="10" max="99" value="${user.age}" required /></div>
            <div class="form-group"><label class="label" for="edit-role">Role</label><input class="input input-sky" id="edit-role" value="${user.role}" required /></div>
            <div class="form-group"><label class="label" for="edit-device">Device</label><input class="input input-violet" id="edit-device" value="${user.device}" required /></div>
            <div class="form-group"><label class="label" for="edit-score">Score</label><input class="input input-sky" id="edit-score" type="number" min="0" max="100" value="${user.wellbeingScore}" required /></div>
            <div class="form-group"><label class="label" for="edit-screen">Screen time</label><input class="input input-green" id="edit-screen" type="number" min="0" step="0.1" value="${user.screenTimeHours}" required /></div>
            <div class="form-group"><label class="label" for="edit-focus">Focus time</label><input class="input input-sky" id="edit-focus" type="number" min="0" step="0.1" value="${user.focusHours}" required /></div>
            <div class="form-group"><label class="label" for="edit-sleep">Sleep</label><input class="input input-violet" id="edit-sleep" type="number" min="0" step="0.1" value="${user.sleepHours}" required /></div>
            <div class="form-group form-group-wide"><label class="label" for="edit-issue">Main issue</label><textarea class="input input-amber textarea" id="edit-issue" required>${user.mainIssue}</textarea></div>
            <div class="form-actions"><button class="btn btn-primary" type="submit">Save changes</button><button class="btn btn-danger" type="button" data-action="delete-user">Delete profile</button></div>
          </form>
          ${state.message ? `<p class="success-message">${state.message}</p>` : ""}
        </section>
      </aside>
    </main>
  `;
}

function reportsScreen() {
  const highRiskUsers = state.users.filter((user) => user.riskLevel === "High");
  const trackingStats = getRealTrackingStats();
  return `
    <main class="grid">
      <section class="panel panel-sky">
        <div class="panel-head">
          <div><h3>System reports</h3><p>Overall summary</p></div>
          <button class="btn btn-primary" type="button" data-action="export-system">Export report</button>
        </div>
        <div class="report-grid">
          <div class="report-card"><span class="report-label">Total users</span><strong>${state.users.length}</strong><p>Profiles stored in IndexedDB and available offline.</p></div>
          <div class="report-card"><span class="report-label">High-risk users</span><strong>${highRiskUsers.length}</strong><p>Users currently marked for urgent intervention.</p></div>
          <div class="report-card"><span class="report-label">Total events</span><strong>${state.activity.length}</strong><p>Tracking and recommendation events recorded in the system.</p></div>
        </div>
      </section>
      <section class="cards stats">
        ${summaryCard("Sign-ins", `${trackingStats.signIns}`, "Real login events", "sky")}
        ${summaryCard("Profile opens", `${trackingStats.profileOpens}`, "Actual profile views", "green")}
        ${summaryCard("Exports", `${trackingStats.exports}`, "Report downloads", "amber")}
      </section>
      <section class="cards split">
        <div class="panel panel-violet">
          <div class="panel-head"><div><h3>Real app tracking</h3><p>Measured in this website</p></div></div>
          <div class="watchlist">
            <div class="report-card"><span class="report-label">Live session</span><strong>${trackingStats.sessionMinutes} min</strong><p>Time since the current sign-in.</p></div>
            <div class="report-card"><span class="report-label">Route views</span><strong>${trackingStats.routeViews}</strong><p>Overview, Users, and Reports visits.</p></div>
            <div class="report-card"><span class="report-label">Searches / edits</span><strong>${trackingStats.searches} / ${trackingStats.formUpdates}</strong><p>Real interactions saved in IndexedDB.</p></div>
            <div class="report-card"><span class="report-label">Last activity</span><strong>${trackingStats.lastActive}</strong><p>Most recent tracked action in the app.</p></div>
          </div>
        </div>
        <div class="panel panel-green">
          <div class="panel-head"><div><h3>Recent tracked events</h3><p>Real and system activity</p></div></div>
          <div class="timeline-list">${buildActivityMarkup(state.activity.slice(0, 8))}</div>
        </div>
      </section>
      <section class="panel panel-violet">
        <div class="panel-head"><div><h3>High-risk watchlist</h3><p>Needs follow-up</p></div></div>
        <div class="watchlist">
          ${highRiskUsers.length ? highRiskUsers.map((user) => `<button class="other-user-item other-high" type="button" data-action="select-user" data-id="${user.id}"><div><strong>${user.name}</strong><div class="list-meta">${user.mainIssue}</div></div><span>${user.wellbeingScore}</span></button>`).join("") : '<div class="empty-state">No high-risk users.</div>'}
        </div>
      </section>
    </main>
  `;
}

function dashboardScreen() {
  const body = state.route === "overview" ? buildOverviewScreen() : state.route === "directory" ? userDirectoryScreen() : state.route === "reports" ? reportsScreen() : userDetailScreen();
  app.innerHTML = `${shellHeader()}${body}`;
}

function exportJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function refreshState() {
  state.users = await getUsers();
  state.admin = await getAdmin();
  state.activity = await getActivity();
}

async function simulateSync(selectedOnly = false) {
  const targetUsers = selectedOnly && getSelectedUser() ? [getSelectedUser()] : state.users;
  if (!targetUsers.length) return;
  for (const user of targetUsers) {
    const nextScore = Math.max(40, Math.min(95, user.wellbeingScore + (user.riskLevel === "High" ? -1 : 1)));
    const updated = createUserRecord({
      ...user,
      screenTimeHours: Number((user.screenTimeHours + Math.random() * 0.2).toFixed(1)),
      focusHours: Number(Math.max(0.5, user.focusHours + Math.random() * 0.15).toFixed(1)),
      sleepHours: Number(Math.max(4.5, user.sleepHours - Math.random() * 0.08).toFixed(1)),
      wellbeingScore: nextScore,
      unlocks: user.unlocks + 1 + (state.liveTick % 3),
      heartRate: Math.min(110, user.heartRate + (state.liveTick % 2 === 0 ? 1 : -1)),
      hydration: Math.max(45, Math.min(100, user.hydration - 1 + (state.liveTick % 3))),
    });
    await saveUser(updated);
    await saveActivityEntry(createActivityEntry(user.id, user.name, (state.liveTick + user.id) % activityTemplates.length, {
      detail: `${user.name} synced new screen, unlock, and focus metrics.`,
      impact: `${Math.abs(nextScore - user.wellbeingScore)} point score change`,
    }));
  }
  await refreshState();
  state.message = "Tracking sync completed.";
  render();
}

function attachGlobalActions() {
  app.querySelectorAll("button:not([type])").forEach((button) => {
    button.type = "button";
  });

  app.querySelectorAll("[data-action='sign-out']").forEach((button) => button.addEventListener("click", () => {
    trackRealEvent({
      type: "sleep",
      tone: "violet",
      title: "Admin signed out",
      detail: "The current dashboard session was closed.",
      impact: `${state.sessionStartedAt ? Math.max(1, Math.round((Date.now() - state.sessionStartedAt) / 60000)) : 0} min session`,
      action: "sign-out",
    });
    setSession(false);
    state.sessionStartedAt = null;
    state.screen = "login";
    state.route = "overview";
    state.selectedUserId = null;
    state.activeUserTab = "tracking";
    state.message = "";
    render();
  }));

  app.querySelectorAll("[data-action='reset-db']").forEach((button) => button.addEventListener("click", async () => {
    await resetDatabase();
    await refreshState();
    setSession(false);
    state.screen = "login";
    state.route = "overview";
    state.selectedUserId = null;
    state.activeUserTab = "tracking";
    state.message = "Database reset to the original sample project data.";
    render();
  }));

  app.querySelectorAll("[data-action='simulate-sync']").forEach((button) => button.addEventListener("click", async () => {
    trackRealEvent({
      type: "screen",
      tone: "sky",
      title: "Manual sync started",
      detail: "The sync button was used to refresh tracking values.",
      impact: "Sync",
      action: "sync",
    });
    await simulateSync(false);
  }));
  app.querySelectorAll("[data-action='route-overview']").forEach((button) => button.addEventListener("click", () => {
    state.route = "overview";
    state.message = "";
    trackRealEvent({ type: "screen", tone: "sky", title: "Overview opened", detail: "The overview dashboard was visited.", impact: "Route view", action: "route-view" });
    render();
  }));
  app.querySelectorAll("[data-action='route-directory']").forEach((button) => button.addEventListener("click", () => {
    state.route = "directory";
    state.message = "";
    trackRealEvent({ type: "screen", tone: "sky", title: "User directory opened", detail: "The user management page was visited.", impact: "Route view", action: "route-view" });
    render();
  }));
  app.querySelectorAll("[data-action='route-reports']").forEach((button) => button.addEventListener("click", () => {
    state.route = "reports";
    state.message = "";
    trackRealEvent({ type: "screen", tone: "sky", title: "Reports opened", detail: "The reports page was visited.", impact: "Route view", action: "route-view" });
    render();
  }));
  app.querySelectorAll("[data-action='select-user']").forEach((button) => button.addEventListener("click", () => {
    state.selectedUserId = Number(button.dataset.id);
    state.route = "user-detail";
    state.activeUserTab = "tracking";
    state.message = "";
    const selectedUser = state.users.find((user) => user.id === state.selectedUserId);
    trackRealEvent({
      userId: selectedUser?.id ?? 0,
      userName: selectedUser?.name ?? "Admin",
      type: "focus",
      tone: "green",
      title: "Profile opened",
      detail: `${selectedUser?.name || "User"} was opened from the dashboard.`,
      impact: "Profile view",
      action: "profile-open",
    });
    render();
  }));
  app.querySelectorAll("[data-action='tab-tracking']").forEach((button) => button.addEventListener("click", () => { state.activeUserTab = "tracking"; render(); }));
  app.querySelectorAll("[data-action='tab-analysis']").forEach((button) => button.addEventListener("click", () => {
    state.activeUserTab = "analysis";
    trackRealEvent({ type: "focus", tone: "green", title: "Analytics tab opened", detail: "A personalized analytics panel was viewed.", impact: "Analytics", action: "analytics-view" });
    render();
  }));
  app.querySelectorAll("[data-action='tab-reports']").forEach((button) => button.addEventListener("click", () => {
    state.activeUserTab = "reports";
    trackRealEvent({ type: "screen", tone: "sky", title: "User report opened", detail: "A personalized user report was viewed.", impact: "Report view", action: "report-view" });
    render();
  }));
  app.querySelectorAll("[data-action='delete-user']").forEach((button) => button.addEventListener("click", async () => {
    const currentUser = getSelectedUser();
    if (!currentUser || !window.confirm(`Delete ${currentUser.name}?`)) return;
    await deleteUserById(currentUser.id);
    await refreshState();
    state.selectedUserId = null;
    state.route = "directory";
    state.message = `${currentUser.name} was deleted.`;
    trackRealEvent({ userId: currentUser.id, userName: currentUser.name, type: "alert", tone: "amber", title: "Profile deleted", detail: `${currentUser.name} was removed from the dashboard.`, impact: "Delete", action: "delete-user" });
    render();
  }));
  app.querySelectorAll("[data-action='export-user']").forEach((button) => button.addEventListener("click", () => {
    const currentUser = getSelectedUser();
    if (!currentUser) return;
    trackRealEvent({ userId: currentUser.id, userName: currentUser.name, type: "screen", tone: "sky", title: "User report exported", detail: `${currentUser.name}'s report was exported.`, impact: "Export", action: "export" });
    exportJson(`${currentUser.name.toLowerCase().replace(/\s+/g, "-")}-report.json`, {
      profile: currentUser,
      activity: getUserActivity(currentUser.id),
      exportedAt: new Date().toISOString(),
    });
  }));
  app.querySelectorAll("[data-action='export-system']").forEach((button) => button.addEventListener("click", () => {
    trackRealEvent({ type: "screen", tone: "sky", title: "System report exported", detail: "The overall system report was exported.", impact: "Export", action: "export" });
    exportJson("mindscreen-system-report.json", {
      users: state.users,
      activity: state.activity,
      exportedAt: new Date().toISOString(),
    });
  }));
  app.querySelectorAll("[data-action='simulate-user-event']").forEach((button) => button.addEventListener("click", async () => {
    trackRealEvent({ type: "screen", tone: "sky", title: "User sync started", detail: "A user-level sync event was requested.", impact: "Sync", action: "sync" });
    await simulateSync(true);
  }));

  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.addEventListener("change", (event) => {
    state.search = event.target.value;
    trackRealEvent({ type: "focus", tone: "green", title: "User search used", detail: `Search query: ${state.search || "cleared"}.`, impact: "Search", action: "search" });
    render();
  });
  const riskFilter = document.getElementById("risk-filter");
  if (riskFilter) riskFilter.addEventListener("change", (event) => {
    state.riskFilter = event.target.value;
    trackRealEvent({ type: "focus", tone: "green", title: "Risk filter changed", detail: `Risk filter set to ${state.riskFilter}.`, impact: "Filter", action: "filter" });
    render();
  });
  const sortBy = document.getElementById("sort-by");
  if (sortBy) sortBy.addEventListener("change", (event) => {
    state.sortBy = event.target.value;
    trackRealEvent({ type: "focus", tone: "green", title: "Sort order changed", detail: `Sort order set to ${state.sortBy}.`, impact: "Sort", action: "sort" });
    render();
  });

  const addUserForm = document.getElementById("add-user-form");
  if (addUserForm) {
    addUserForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const user = createUserRecord({
        id: nextUserId(),
        name: document.getElementById("new-name").value.trim(),
        age: Number(document.getElementById("new-age").value),
        role: document.getElementById("new-role").value.trim(),
        device: document.getElementById("new-device").value.trim(),
        wellbeingScore: Number(document.getElementById("new-score").value),
        screenTimeHours: Number(document.getElementById("new-screen").value),
        focusHours: Number(document.getElementById("new-focus").value),
        sleepHours: Number(document.getElementById("new-sleep").value),
        mainIssue: document.getElementById("new-issue").value.trim(),
        tags: ["new-user"],
      });
      await saveUser(user);
      await saveActivityEntry(createActivityEntry(user.id, user.name, 1, {
        detail: `${user.name} was registered and initial tracking defaults were created.`,
        impact: "New profile",
      }));
      await refreshState();
      state.message = `${user.name} was added successfully.`;
      state.search = "";
      trackRealEvent({ userId: user.id, userName: user.name, type: "focus", tone: "green", title: "Profile created", detail: `${user.name} was created from the user form.`, impact: "Create", action: "create-user" });
      render();
    });
  }

  const editUserForm = document.getElementById("edit-user-form");
  if (editUserForm) {
    editUserForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const currentUser = getSelectedUser();
      if (!currentUser) return;
      const updated = createUserRecord({
        ...currentUser,
        name: document.getElementById("edit-name").value.trim(),
        age: Number(document.getElementById("edit-age").value),
        role: document.getElementById("edit-role").value.trim(),
        device: document.getElementById("edit-device").value.trim(),
        wellbeingScore: Number(document.getElementById("edit-score").value),
        screenTimeHours: Number(document.getElementById("edit-screen").value),
        focusHours: Number(document.getElementById("edit-focus").value),
        sleepHours: Number(document.getElementById("edit-sleep").value),
        mainIssue: document.getElementById("edit-issue").value.trim(),
      });
      await saveUser(updated);
      await saveActivityEntry(createActivityEntry(updated.id, updated.name, 0, {
        detail: `${updated.name}'s profile was updated from the dashboard.`,
        impact: "Profile updated",
      }));
      await refreshState();
      state.selectedUserId = updated.id;
      state.message = `${updated.name} was updated successfully.`;
      trackRealEvent({ userId: updated.id, userName: updated.name, type: "focus", tone: "green", title: "Profile updated", detail: `${updated.name}'s values were updated from the edit form.`, impact: "Edit", action: "edit-user" });
      render();
    });
  }
}

function render() {
  if (state.screen === "login") loginScreen();
  else dashboardScreen();
  attachGlobalActions();
}

async function init() {
  await refreshState();
  setSession(false);
  state.screen = "login";
  state.route = "overview";
  state.selectedUserId = null;
  if (!state.trackerStarted) {
    state.trackerStarted = true;
    window.setInterval(() => {
      state.liveTick += 1;
      if (state.screen === "dashboard" && state.route === "user-detail") render();
    }, 5000);
  }
  render();
}

init();
