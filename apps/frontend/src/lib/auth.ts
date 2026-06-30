export interface User {
  email: string;
  orgId: string;
  role: "ADMIN" | "STUDENT";
}

export interface Session {
  token: string;
  user: User;
}

export const getSession = (): Session | null => {
  if (typeof window === "undefined") return null;
  const session = localStorage.getItem("feeflow_session");
  return session ? JSON.parse(session) : null;
};

export const setSession = (session: Session) => {
  if (typeof window === "undefined") return;
  localStorage.setItem("feeflow_session", JSON.stringify(session));
};

export const clearSession = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("feeflow_session");
};
