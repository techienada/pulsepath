import { isSupabaseConfigured, supabase } from "./supabase.js";

function mapUserToRow(user) {
  return {
    legacy_id: user.id,
    name: user.name,
    age: user.age,
    role: user.role,
    device: user.device,
    wellbeing_score: user.wellbeingScore,
    risk_level: user.riskLevel,
    screen_time_hours: user.screenTimeHours,
    focus_hours: user.focusHours,
    sleep_hours: user.sleepHours,
    unlocks: user.unlocks,
    scrolling_hours: user.scrollingHours,
    typing_speed: user.typingSpeed,
    heart_rate: user.heartRate,
    hydration: user.hydration,
    main_issue: user.mainIssue,
    tags: user.tags,
    goals: user.goals,
    recommendations: user.recommendations,
    weekly_trend: user.weeklyTrend,
    app_usage: user.appUsage,
  };
}

export async function syncUserProfileToCloud(user) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("users")
    .upsert(mapUserToRow(user), { onConflict: "legacy_id" })
    .select("id, legacy_id")
    .single();

  if (error) {
    console.error("Supabase user sync failed:", error);
    return null;
  }

  return data?.id || null;
}

export async function syncBehaviorSnapshotToCloud(userId, snapshot) {
  if (!isSupabaseConfigured || !supabase || !userId) return;

  const { error } = await supabase.from("behavior_snapshots").insert({
    user_id: userId,
    behavior_score: snapshot.behaviorScore,
    behavior_profile: snapshot.behaviorProfile,
    strongest_signal: snapshot.strongestSignal,
    trend_label: snapshot.trendLabel,
    trend_delta: snapshot.trendDelta,
    why_it_matters: snapshot.whyItMatters,
    next_action: snapshot.nextAction,
    weekly_target: snapshot.weeklyTarget,
  });

  if (error) {
    console.error("Supabase behavior snapshot sync failed:", error);
  }
}

export async function syncUserAndBehaviorToCloud(user, snapshot) {
  const cloudUserId = await syncUserProfileToCloud(user);
  if (!cloudUserId) return;
  await syncBehaviorSnapshotToCloud(cloudUserId, snapshot);
}
