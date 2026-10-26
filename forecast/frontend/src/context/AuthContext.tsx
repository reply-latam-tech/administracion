"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type UserRole = 'propietario' | 'directivo' | 'administracion' | 'analista';

export const OWNER_EMAIL = "matias.molesini@replylatam.com";

export function resolveUserRole(email?: string | null, appMetaRole?: string | null): UserRole {
  if (!email) return 'analista';
  if (email.trim().toLowerCase() === OWNER_EMAIL) return 'propietario';
  if (appMetaRole && ['propietario', 'directivo', 'administracion', 'analista'].includes(appMetaRole)) {
    return appMetaRole as UserRole;
  }
  return 'analista';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthorized: boolean;
  role: UserRole;
  isPropietario: boolean;
  isDirectivo: boolean;
  isAdministracion: boolean;
  isAnalista: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ success: boolean; message?: string }>;
  loginAsDevUser: (email?: string, customRole?: UserRole) => void;
  signOut: () => Promise<void>;
  clearError: () => void;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ALLOWED_DOMAIN = "@replylatam.com";

export function isReplyEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(ALLOWED_DOMAIN);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>('analista');
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Validar y aplicar sesión
  const handleSession = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      // Verificar si hay sesión local de desarrollo
      if (typeof window !== "undefined") {
        const devSaved = localStorage.getItem("reply_dev_session");
        if (devSaved) {
          try {
            const parsed = JSON.parse(devSaved);
            if (parsed?.user?.email && isReplyEmail(parsed.user.email)) {
              setUser(parsed.user);
              setSession(parsed);
              const devRole = resolveUserRole(parsed.user.email, parsed.user.app_metadata?.role);
              setRole(devRole);
              setIsAuthorized(true);
              setLoading(false);
              return;
            }
          } catch (e) {
            localStorage.removeItem("reply_dev_session");
          }
        }
      }
      setUser(null);
      setSession(null);
      setRole('analista');
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    const email = currentSession.user.email || "";

    if (isReplyEmail(email)) {
      setUser(currentSession.user);
      setSession(currentSession);
      const computedRole = resolveUserRole(email, currentSession.user.app_metadata?.role);
      setRole(computedRole);
      setIsAuthorized(true);
      setAuthError(null);
    } else {
      // Bloquear acceso inmediatamente y desloguear
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setRole('analista');
      setIsAuthorized(false);
      setAuthError(
        `Acceso no autorizado: La cuenta (${email}) no pertenece al dominio ${ALLOWED_DOMAIN}. Por favor ingresá con tu correo corporativo de Reply Latam.`
      );
    }
    setLoading(false);
  };

  const loginAsDevUser = (email = OWNER_EMAIL, customRole: UserRole = 'propietario') => {
    const mockUser: User = {
      id: "dev-matias-molesini",
      app_metadata: { provider: "google", role: customRole },
      user_metadata: {
        full_name: "Matias Molesini",
        name: "Matias Molesini",
        email: email,
        avatar_url: ""
      },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      email: email,
      phone: "",
      role: "authenticated",
      updated_at: new Date().toISOString(),
    };
    const mockSession: Session = {
      access_token: "mock-token-dev",
      token_type: "bearer",
      expires_in: 86400,
      refresh_token: "mock-refresh-dev",
      user: mockUser
    };
    if (typeof window !== "undefined") {
      localStorage.setItem("reply_dev_session", JSON.stringify(mockSession));
    }
    setUser(mockUser);
    setSession(mockSession);
    setRole(customRole);
    setIsAuthorized(true);
    setAuthError(null);
  };

  const refreshRole = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        const found = data.users?.find((u: any) => u.id === user.id || u.email?.toLowerCase() === user.email?.toLowerCase());
        if (found?.rol) {
          setRole(found.rol);
        }
      }
    } catch {
      // No-op
    }
  };

  useEffect(() => {
    // 1. Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // 2. Suscribirse a cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        await handleSession(newSession);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: origin,
          queryParams: {
            hd: "replylatam.com",
            prompt: "select_account"
          }
        }
      });
      if (error) {
        setAuthError(error.message);
      }
    } catch (err: any) {
      setAuthError(err.message || "Error al conectar con Google.");
    }
  };

  const signInWithEmail = async (email: string) => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail.endsWith(ALLOWED_DOMAIN)) {
      const msg = `El correo debe pertenecer exclusivamente al dominio corporativo ${ALLOWED_DOMAIN}`;
      setAuthError(msg);
      return { success: false, message: msg };
    }

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: origin
        }
      });

      if (error) {
        setAuthError(error.message);
        return { success: false, message: error.message };
      }

      return { success: true };
    } catch (err: any) {
      const msg = err.message || "Error al enviar el enlace de acceso.";
      setAuthError(msg);
      return { success: false, message: msg };
    }
  };

  const signOut = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("reply_dev_session");
      }
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setIsAuthorized(false);
      setAuthError(null);
    }
  };

  const clearError = () => setAuthError(null);

  const isPropietario = role === 'propietario';
  const isDirectivo = role === 'directivo' || isPropietario;
  const isAdministracion = role === 'administracion' || isPropietario;
  const isAnalista = role === 'analista';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAuthorized,
        role,
        isPropietario,
        isDirectivo,
        isAdministracion,
        isAnalista,
        authError,
        signInWithGoogle,
        signInWithEmail,
        loginAsDevUser,
        signOut,
        clearError,
        refreshRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe utilizarse dentro de un AuthProvider");
  }
  return context;
}
