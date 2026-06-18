"use client";

import { useActionState, useState } from "react";
import { login, signup, type AuthState } from "@/app/actions/auth";
import { Loader2, LayoutDashboard } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(
    login,
    null
  );
  const [signupState, signupAction, signupPending] = useActionState<AuthState, FormData>(
    signup,
    null
  );

  const state = mode === "login" ? loginState : signupState;
  const pending = mode === "login" ? loginPending : signupPending;
  const action = mode === "login" ? loginAction : signupAction;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center">
            <LayoutDashboard size={18} className="text-gold" />
          </div>
          <span className="text-lg font-extrabold tracking-tight">Painel DRE</span>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-7">
          <div className="flex gap-1 bg-surface-2 border border-border rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 text-sm font-semibold py-2 rounded-md transition-colors ${
                mode === "login" ? "bg-surface text-foreground" : "text-muted"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 text-sm font-semibold py-2 rounded-md transition-colors ${
                mode === "signup" ? "bg-surface text-foreground" : "text-muted"
              }`}
            >
              Criar conta
            </button>
          </div>

          <form action={action} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">E-mail</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gold transition-colors"
                placeholder="voce@empresa.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">Senha</label>
              <input
                name="password"
                type="password"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gold transition-colors"
                placeholder="••••••••"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-red bg-red-soft rounded-lg px-3 py-2">{state.error}</p>
            )}
            {state?.success && (
              <p className="text-sm text-green bg-green-soft rounded-lg px-3 py-2">{state.success}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-1 bg-gold text-[#1a1305] font-bold text-sm rounded-lg py-2.5 flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-[#ddb52e] transition-colors"
            >
              {pending && <Loader2 size={15} className="spin" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-faint mt-6">
          {mode === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-muted underline underline-offset-2"
          >
            {mode === "login" ? "Criar uma agora" : "Entrar"}
          </button>
        </p>
      </div>
    </main>
  );
}
