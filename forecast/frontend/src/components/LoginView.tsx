"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, Mail, ArrowRight, CheckCircle2, Lock, Sparkles, AlertCircle } from "lucide-react";

export function LoginView() {
  const { signInWithGoogle, signInWithEmail, loginAsDevUser, authError, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [localValidationMessage, setLocalValidationMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    clearError();
    await signInWithGoogle();
    setIsGoogleLoading(false);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidationMessage(null);
    clearError();

    const clean = email.trim().toLowerCase();
    if (!clean.endsWith("@replylatam.com")) {
      setLocalValidationMessage("El correo debe finalizar obligatoriamente en @replylatam.com");
      return;
    }

    setIsSubmitting(true);
    const res = await signInWithEmail(clean);
    setIsSubmitting(false);

    if (res.success) {
      setEmailSent(true);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 relative overflow-hidden px-4 select-none">
      
      {/* Decorative ambient background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative w-full max-w-md z-10">
        
        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 sm:p-10 flex flex-col items-center">
          
          {/* Logo Reply */}
          <div className="mb-6 flex flex-col items-center">
            <div className="relative h-10 w-40 mb-2">
              <Image 
                src="/reply-logo-cropped.png" 
                alt="Reply Latam" 
                fill 
                className="object-contain" 
                priority
              />
            </div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 mt-1">
              Forecast & Administración
            </span>
          </div>

          {/* Heading */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Iniciar Sesión
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Acceso institucional exclusivo para colaboradores de Reply Latam.
            </p>
          </div>

          {/* Security Domain Badge */}
          <div className="w-full mb-6 flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700">
            <Lock size={12} className="text-red-600" />
            <span>Restringido a cuentas</span>
            <span className="font-bold text-slate-900 font-mono">@replylatam.com</span>
          </div>

          {/* Error Banner */}
          {(authError || localValidationMessage) && (
            <div className="w-full mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3 text-xs animate-in fade-in duration-200">
              <ShieldAlert size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-950">Acceso Denegado</p>
                <p className="mt-0.5 text-red-800 leading-relaxed">
                  {localValidationMessage || authError}
                </p>
              </div>
            </div>
          )}

          {/* Email Sent Success Banner */}
          {emailSent ? (
            <div className="w-full p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col items-center text-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 size={32} className="text-emerald-600" />
              <h3 className="font-bold text-sm text-emerald-950">¡Enlace de acceso enviado!</h3>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Revisá tu casilla de correo <strong className="text-emerald-950">{email}</strong> y hacé clic en el botón para ingresar.
              </p>
              <button
                onClick={() => { setEmailSent(false); setEmail(""); }}
                className="mt-2 text-xs text-emerald-700 font-medium underline hover:text-emerald-900 transition-colors"
              >
                Volver a intentar con otro correo
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-4">
              
              {/* Botón Google OAuth */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-all shadow-xs hover:shadow-sm active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {isGoogleLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-red-600 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Continuar con Google</span>
              </button>

              {/* Separador */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                  o con correo
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Formulario de Email OTP / Magic Link */}
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
                <div>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (localValidationMessage) setLocalValidationMessage(null);
                      }}
                      placeholder="usuario@replylatam.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                    />
                  </div>
                  <span className="block text-[11px] text-slate-400 mt-1 px-1">
                    Ingresá tu correo con terminación <strong className="text-slate-600">@replylatam.com</strong>
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-sm font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Enviar Enlace de Acceso</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>

              {/* Botón de acceso de desarrollo rápido en localhost */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => loginAsDevUser()}
                  className="w-full py-2 px-3 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-100 text-slate-600 text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles size={13} className="text-amber-500" />
                  <span>Acceso Directo Dev (matias.molesini@replylatam.com)</span>
                </button>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center w-full">
            <p className="text-[11px] text-slate-400">
              Sistema protegido por Supabase Auth & Google Workspace OAuth 2.0.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
