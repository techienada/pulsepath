import fs from "node:fs";
import path from "node:path";

const [, , inputPath, outputPathArg] = process.argv;

if (!inputPath) {
  console.error("Usage: node scripts/import-survey.mjs <input.csv> [output.json]");
  process.exit(1);
}

const outputPath = outputPathArg || path.join(process.cwd(), "data", "survey-import.json");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  return records
    .filter((record) => record.some((cell) => cell && cell.trim()))
    .map((record) =>
      Object.fromEntries(headers.map((header, index) => [header, (record[index] || "").trim()])),
    );
}

function normalizeText(value) {
  return (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/â€“/g, "-")
    .replace(/–/g, "-")
    .trim();
}

function parseNumber(value, fallback = 0) {
  const clean = normalizeText(value).toLowerCase();
  const matches = clean.match(/\d+(\.\d+)?/g);
  if (!matches) return fallback;
  const numbers = matches.map(Number);
  if (numbers.length === 1) return numbers[0];
  return Number((numbers.reduce((sum, item) => sum + item, 0) / numbers.length).toFixed(1));
}

function mapSleepHours(sleepQuality) {
  const quality = normalizeText(sleepQuality).toLowerCase();
  if (quality === "good") return 7.8;
  if (quality === "average") return 6.7;
  if (quality === "poor") return 5.8;
  return 6.5;
}

function mapStressToHeartRate(stress) {
  const level = normalizeText(stress).toLowerCase();
  if (level === "high") return 92;
  if (level === "medium") return 84;
  return 76;
}

function mapStressToHydration(stress) {
  const level = normalizeText(stress).toLowerCase();
  if (level === "high") return 58;
  if (level === "medium") return 68;
  return 78;
}

function mapSwitchingToUnlocks(value) {
  const text = normalizeText(value).toLowerCase();
  if (text.includes("high")) return 70;
  if (text.includes("medium")) return 42;
  return 18;
}

function mapHabitScore(value) {
  const raw = parseNumber(value, 3);
  return Math.max(0, Math.min(100, raw * 20));
}

function buildRisk(score, screenHours, sleepHours, stress) {
  const stressLevel = normalizeText(stress).toLowerCase();
  if (score >= 80 && screenHours <= 4.5 && sleepHours >= 7 && stressLevel !== "high") return "Low";
  if (score >= 60 && screenHours <= 6.5 && sleepHours >= 6) return "Moderate";
  return "High";
}

function buildIssue(record, apps, overnightPhoneUse, affectsFocus, stress, sleepQuality) {
  const issues = [];
  if (normalizeText(overnightPhoneUse).toLowerCase() === "yes") {
    issues.push("late-night phone use is affecting recovery");
  }
  if (normalizeText(affectsFocus).toLowerCase() === "yes") {
    issues.push("screen use is hurting focus");
  }
  if (normalizeText(sleepQuality).toLowerCase() === "poor") {
    issues.push("sleep quality is poor");
  }
  if (normalizeText(stress).toLowerCase() === "high") {
    issues.push("screen habits are creating mental fatigue");
  }
  if (!issues.length && apps.length) {
    issues.push(`${apps[0]} use is the strongest habit pattern`);
  }
  return `${issues[0].charAt(0).toUpperCase()}${issues[0].slice(1)}.`;
}

function buildTags(apps, overnightPhoneUse, affectsFocus, stress, sleepQuality) {
  const tags = new Set();
  apps.forEach((app) => {
    const lower = app.toLowerCase();
    if (/(instagram|snap|snapchat|tiktok|whatsapp|facebook)/.test(lower)) tags.add("social");
    if (/(youtube|netflix|video)/.test(lower)) tags.add("video");
    if (/(book|books|zoom|drive|chatgpt|ai)/.test(lower)) tags.add("study");
  });
  if (normalizeText(overnightPhoneUse).toLowerCase() === "yes") tags.add("sleep");
  if (normalizeText(affectsFocus).toLowerCase() === "yes") tags.add("focus");
  if (normalizeText(stress).toLowerCase() === "high") tags.add("stress");
  if (normalizeText(sleepQuality).toLowerCase() === "poor") tags.add("sleep");
  return [...tags];
}

function buildAppUsage(screenHours, appField) {
  const apps = normalizeText(appField)
    .split(/,|and/i)
    .map((item) => item.replace(/^\d+\./, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  const totalMinutes = Math.max(60, Math.round(screenHours * 60));
  const colors = ["#8b5cf6", "#10b981", "#0ea5e9"];

  if (!apps.length) {
    return [
      { label: "Social", minutes: Math.round(totalMinutes * 0.4), color: "#8b5cf6" },
      { label: "Study", minutes: Math.round(totalMinutes * 0.3), color: "#10b981" },
      { label: "Other", minutes: Math.round(totalMinutes * 0.3), color: "#0ea5e9" },
    ];
  }

  const distribution = [0.45, 0.32, 0.23];
  return apps.map((app, index) => ({
    label: app,
    minutes: Math.round(totalMinutes * (distribution[index] || 0.18)),
    color: colors[index] || "#f59e0b",
  }));
}

function buildRecommendations(user) {
  const actions = [];
  if (user.sleepHours < user.goals.minSleep) actions.push("Enable bedtime protection and stop phone use before sleep.");
  if (user.screenTimeHours > user.goals.maxScreenTime) actions.push("Set a strict daily limit for the top-used app.");
  if (user.focusHours < user.goals.minFocus) actions.push("Start the day with a protected focus block before social apps.");
  if (user.unlocks > 55) actions.push("Reduce pickups with notification batching and distance from the phone.");
  if (!actions.length) actions.push("Maintain current habits with one weekly wellbeing review.");
  return actions.slice(0, 4);
}

function toUser(record, index) {
  const age = parseNumber(record["  Age:  "], 20);
  const role = normalizeText(record["  Occupation:  "]) || "Student";
  const screenTimeHours = parseNumber(record["Average daily screen time:"], 4);
  const socialHours = parseNumber(record["  Daily social media usage (hours):  "], Math.max(1, screenTimeHours * 0.5));
  const sleepHours = mapSleepHours(record["Sleep quality: "]);
  const wellbeingScore = mapHabitScore(record["How would you rate your digital habits?  "]);
  const focusImpact = normalizeText(record["  Does screen use affect your focus/productivity?  "]).toLowerCase();
  const focusHours = focusImpact === "yes" ? 2.2 : focusImpact === "maybe" ? 3 : 4;
  const apps = normalizeText(record["  Most-used apps (Top 3):  "])
    .split(/,|and/i)
    .map((item) => item.replace(/^\d+\./, "").trim())
    .filter(Boolean);
  const unlocks = mapSwitchingToUnlocks(record["How often do you switch between apps during use?  "]);
  const stress = record["Stress or mental fatigue due to screen use:"];
  const overnightPhoneUse = record["Do you use your phone between 10 PM – 6 AM?  "];
  const sleepQuality = record["Sleep quality: "];
  const tags = buildTags(
    apps,
    overnightPhoneUse,
    record["  Does screen use affect your focus/productivity?  "],
    stress,
    sleepQuality,
  );
  const user = {
    legacy_id: index + 1,
    name: normalizeText(record["Name (optional):"]) || `Survey User ${index + 1}`,
    age,
    role,
    device: "Phone survey",
    wellbeing_score: wellbeingScore,
    screen_time_hours: Number(screenTimeHours.toFixed(1)),
    focus_hours: Number(focusHours.toFixed(1)),
    sleep_hours: Number(sleepHours.toFixed(1)),
    unlocks,
    scrolling_hours: Number(socialHours.toFixed(1)),
    typing_speed: focusImpact === "yes" ? 44 : focusImpact === "maybe" ? 50 : 57,
    heart_rate: mapStressToHeartRate(stress),
    hydration: mapStressToHydration(stress),
    main_issue: buildIssue(record, apps, overnightPhoneUse, focusImpact, stress, sleepQuality),
    tags,
    goals: {
      maxScreenTime: Math.max(3.5, Number((screenTimeHours - 1).toFixed(1))),
      minSleep: 7,
      minFocus: 3.5,
    },
    weekly_trend: [
      Math.max(35, wellbeingScore - 8),
      Math.max(35, wellbeingScore - 6),
      Math.max(35, wellbeingScore - 3),
      Math.max(35, wellbeingScore - 2),
      Math.min(95, wellbeingScore),
      Math.min(95, wellbeingScore + 1),
      Math.min(95, wellbeingScore),
    ],
    app_usage: buildAppUsage(screenTimeHours, record["  Most-used apps (Top 3):  "]),
  };

  user.risk_level = buildRisk(user.wellbeing_score, user.screen_time_hours, user.sleep_hours, stress);
  user.recommendations = buildRecommendations({
    ...user,
    goals: user.goals,
  });

  return user;
}

const csv = fs.readFileSync(inputPath, "utf8");
const records = parseCsv(csv);
const users = records.map(toUser);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: inputPath,
      count: users.length,
      users,
    },
    null,
    2,
  ),
);

console.log(`Imported ${users.length} survey responses to ${outputPath}`);
