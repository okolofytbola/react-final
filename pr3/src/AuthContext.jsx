import { createContext, useState, useEffect, useContext, useCallback } from "react";
import * as api from "./api";
import { saveSessionCookie, readSessionCookie } from "./utils";

const AuthContext = createContext();
const STORAGE_KEY = "user";

function readStoredUser() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  const [ready, setReady] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");

  useEffect(() => {
    if (user && user.token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      saveSessionCookie(user.token);
    } else if (ready) {
      localStorage.removeItem(STORAGE_KEY);
      saveSessionCookie("");
    }
  }, [user, ready]);

  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      setUser(null);
      saveSessionCookie("");
      setSessionMessage("Сессия истекла (сервер был перезапущен). Войдите заново.");
    });
    return () => api.setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const stored = readStoredUser();
    const token = (stored && stored.token) || readSessionCookie();
    if (!token) {
      setReady(true);
      return;
    }
    api
      .getProfile(token)
      .then((profile) => {
        if (!cancelled) setUser({ ...profile, token });
      })
      .catch(() => {

      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearSessionMessage = useCallback(() => setSessionMessage(""), []);

  const logout = useCallback(() => {
    const token = readStoredUser()?.token || readSessionCookie();
    if (token) api.logout(token).catch(() => {});
    saveSessionCookie("");
    setUser(null);
  }, []);

  const updateUser = useCallback((patch) => setUser((prev) => (prev ? { ...prev, ...patch, token: prev.token } : prev)), []);

  return (
    <AuthContext.Provider value={{ user, setUser, updateUser, logout, ready, sessionMessage, clearSessionMessage }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
