import { useSyncExternalStore } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabase } from "./sync";

export type AuthState =
  /** This build has no database, so there are no accounts and everything stays on the device. */
  | { status: "off" }
  | { status: "loading" }
  | { status: "signed-out" }
  /** Opened from a password reset email: the person is signed in only to choose a new password. */
  | { status: "recovering"; userId: string; email: string }
  | { status: "signed-in"; userId: string; email: string };

let state: AuthState = { status: "loading" };
let started = false;
const listeners = new Set<() => void>();
const accountListeners = new Set<(userId: string | null) => void>();

function set(next: AuthState) {
  state = next;
  listeners.forEach((listener) => listener());
  accountListeners.forEach((listener) => listener(next.status === "signed-in" ? next.userId : null));
}

function fromSession(session: Session | null, event?: AuthChangeEvent): AuthState {
  if (!session) return { status: "signed-out" };
  const account = { userId: session.user.id, email: session.user.email ?? "" };
  // Stays in recovery until the new password is saved, even if the session refreshes meanwhile.
  if (event === "PASSWORD_RECOVERY" || (state.status === "recovering" && event !== "USER_UPDATED")) {
    return { status: "recovering", ...account };
  }
  return { status: "signed-in", ...account };
}

function start() {
  if (started) return;
  started = true;
  const supabase = getSupabase();
  if (!supabase) {
    set({ status: "off" });
    return;
  }
  supabase.auth.onAuthStateChange((event, session) => set(fromSession(session, event)));
  void supabase.auth.getSession().then(({ data }) => {
    if (state.status === "loading") set(fromSession(data.session));
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const loading: AuthState = { status: "loading" };
export function useAuth() {
  return useSyncExternalStore(subscribe, () => state, () => loading);
}

/** Calls back with the signed-in account's id, or null, whenever that changes. */
export function onAccountChange(listener: (userId: string | null) => void) {
  start();
  accountListeners.add(listener);
  listener(state.status === "signed-in" ? state.userId : null);
  return () => accountListeners.delete(listener);
}

/** Turns Supabase's messages into ones that say what to do. */
function explain(message: string) {
  if (/invalid login credentials/i.test(message)) return "Wrong email or password.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first: open the link we sent you, then sign in.";
  if (/already registered|already exists/i.test(message)) return "There's already an account with this email. Sign in instead.";
  if (/password.*(at least|short|characters)/i.test(message)) return "Use a password of at least 8 characters.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Wait a few minutes and try again.";
  if (/fetch|network/i.test(message)) return "No internet connection. Connect and try again.";
  return message;
}

function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("This version of the app has no accounts.");
  return supabase;
}

export async function signIn(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(explain(error.message));
}

/** Creates an account. Returns true when the email still needs confirming before signing in. */
export async function signUp(email: string, password: string) {
  const { data, error } = await client().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw new Error(explain(error.message));
  // Supabase answers like this for an email that already has an account, so the email can't be probed.
  if (data.user && !data.user.identities?.length) {
    throw new Error("There's already an account with this email. Sign in instead.");
  }
  return !data.session;
}

export async function sendPasswordReset(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
  if (error) throw new Error(explain(error.message));
}

export async function setNewPassword(password: string) {
  const { error } = await client().auth.updateUser({ password });
  if (error) throw new Error(explain(error.message));
}

export async function signOutOfAccount() {
  // Signs out on this device only; other devices stay signed in.
  const { error } = await client().auth.signOut({ scope: "local" });
  if (error) throw new Error(explain(error.message));
}
