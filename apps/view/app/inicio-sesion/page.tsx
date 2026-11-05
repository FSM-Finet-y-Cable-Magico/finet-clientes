"use client";

import { useState, Suspense } from "react";
import AuthSwitch from "../components/AuthSwitch";
import LoginForm from "../components/LoginForm";
import RegistroForm from "../components/RegistroForm";

function AuthContent() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <>
      <AuthSwitch active={mode} onChange={setMode} />
      {mode === "login" ? (
        <LoginForm />
      ) : (
        <RegistroForm onIniciarSesion={() => setMode("login")} />
      )}
    </>
  );
}

export default function InicioSesionPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md">
        <Suspense fallback={
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-full rounded-lg bg-border" />
            <div className="h-10 w-full rounded-lg bg-border" />
          </div>
        }>
          <AuthContent />
        </Suspense>
      </div>
    </main>
  );
}
