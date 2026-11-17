"use client";

import { useState, type FormEvent } from "react";
import { sendPasswordReset, setNewPassword, signIn, signUp } from "@/lib/auth";

type Mode = "sign-in" | "sign-up" | "reset";

const MIN_PASSWORD = 8;
const message = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong. Try again.");

function Brand() {
  return (
    <div className="auth-brand">
      <span className="auth-logo" aria-hidden="true" />
      <h1 className="day-title">Minders</h1>
    </div>
  );
}

/** Shown to anyone not signed in: sign in, create an account, or get a password reset email. */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function switchTo(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter your email address.");
      return;
    }
    if (mode !== "reset" && password.length < MIN_PASSWORD) {
      setError(`Use a password of at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setBusy(true);
    try {
      if (mode === "sign-in") await signIn(email, password);
      if (mode === "sign-up" && (await signUp(email, password))) {
        setMode("sign-in");
        setNotice(`Check ${email.trim()} and open the link to confirm your account, then sign in here.`);
      }
      if (mode === "reset") {
        await sendPasswordReset(email);
        setNotice(`If ${email.trim()} has an account, a link to choose a new password is on its way.`);
      }
    } catch (problem) {
      setError(message(problem));
    } finally {
      setBusy(false);
    }
  }

  const labels = {
    "sign-in": { title: "Sign in", button: "Sign in", busy: "Signing in…" },
    "sign-up": { title: "Create account", button: "Create account", busy: "Creating account…" },
    reset: { title: "Reset password", button: "Send reset link", busy: "Sending…" },
  }[mode];

  return (
    <div className="screen auth-screen">
      <div className="status" />
      <div className="scroll auth-body">
        <Brand />
        {mode !== "reset" && (
          <div className="auth-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "sign-in"} onClick={() => switchTo("sign-in")}>
              Sign in
            </button>
            <button type="button" role="tab" aria-selected={mode === "sign-up"} onClick={() => switchTo("sign-up")}>
              Create account
            </button>
          </div>
        )}
        <form className="auth-form" onSubmit={submit} noValidate>
          {mode === "reset" && <h2 className="auth-heading">{labels.title}</h2>}
          <label className="field">
            <span>Email</span>
            <input
              className="text-field"
              id="auth-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {mode !== "reset" && (
            <label className="field">
              <span>Password</span>
              <input
                className="text-field"
                id="auth-password"
                type="password"
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {mode === "sign-up" && <small className="field-hint">At least {MIN_PASSWORD} characters.</small>}
            </label>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          )}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? labels.busy : labels.button}
          </button>
          {mode === "sign-in" && (
            <button className="ghost" type="button" onClick={() => switchTo("reset")}>
              Forgot password?
            </button>
          )}
          {mode === "reset" && (
            <button className="ghost" type="button" onClick={() => switchTo("sign-in")}>
              Back to sign in
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

/** Shown after opening a password reset email: choose the new password. */
export function NewPasswordScreen({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`Use a password of at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await setNewPassword(password);
    } catch (problem) {
      setError(message(problem));
      setBusy(false);
    }
  }

  return (
    <div className="screen auth-screen">
      <div className="status" />
      <div className="scroll auth-body">
        <Brand />
        <form className="auth-form" onSubmit={submit} noValidate>
          <h2 className="auth-heading">Choose a new password</h2>
          <p className="field-hint">For {email}</p>
          <label className="field">
            <span>New password</span>
            <input
              className="text-field"
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
