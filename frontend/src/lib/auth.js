// Session + JWT token storage. Token stored at `navya_token` (read by api.js).

const SESSION = "navya_session";
const TOKEN = "navya_token";

export const setSession = (s) => {
  localStorage.setItem(SESSION, JSON.stringify(s));
  if (s?.token) localStorage.setItem(TOKEN, s.token);
};
export const getSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION) || "null"); } catch { return null; }
};
export const clearSession = () => {
  localStorage.removeItem(SESSION);
  localStorage.removeItem(TOKEN);
};
