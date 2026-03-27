const SESSION_KEY = "mindscreen-pro-session";

export function setSession(active) {
  if (active) {
    localStorage.setItem(SESSION_KEY, "active");
    return;
  }
  localStorage.removeItem(SESSION_KEY);
}

export function getSession() {
  return localStorage.getItem(SESSION_KEY) === "active";
}
