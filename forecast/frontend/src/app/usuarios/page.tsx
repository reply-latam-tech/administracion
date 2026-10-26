"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  Crown, 
  Briefcase, 
  Calculator, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  Copy, 
  Check, 
  UserPlus, 
  Sparkles,
  Lock,
  ChevronDown,
  Layers,
  FileCode2,
  ChevronRight
} from "lucide-react";
import { useAuth, UserRole, OWNER_EMAIL } from "@/context/AuthContext";

interface UserItem {
  id: string;
  email: string;
  nombre: string;
  avatar_url?: string;
  rol: UserRole;
  creado_el: string;
  ultimo_login?: string | null;
}

const ROLES_INFO: Record<UserRole, { label: string; icon: string; color: string; bg: string; border: string; desc: string }> = {
  propietario: {
    label: "Propietario",
    icon: "👑",
    color: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-200",
    desc: "Control total de la plataforma, administración de roles, acceso a todos los módulos y auditoría de novedades."
  },
  directivo: {
    label: "Directivo",
    icon: "👔",
    color: "text-indigo-800",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    desc: "Acceso ejecutivo a tableros consolidados, flujo de caja, simulación macro y reportes gerenciales de alto nivel."
  },
  administracion: {
    label: "Finanzas / Admin",
    icon: "💼",
    color: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    desc: "Gestión operativa: edición del directorio de clientes, registro de novedades/descuentos y estatus de facturas."
  },
  analista: {
    label: "Analista",
    icon: "🔍",
    color: "text-slate-700",
    bg: "bg-slate-100",
    border: "border-slate-200",
    desc: "Rol predeterminado para nuevos ingresos. Acceso de solo lectura a métricas de ventas y reportes operativos básicos."
  }
};

export default function UsuariosPage() {
  const { user, isPropietario, role: currentUserRole, refreshRole } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ id: string; text: string; isError?: boolean } | null>(null);
  const [showSqlMigration, setShowSqlMigration] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Cargar usuarios desde la API
  const fetchUsers = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        console.error("Error al obtener usuarios:", await res.text());
      }
    } catch (err) {
      console.error("Error de red al consultar usuarios:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Actualizar rol de usuario
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setSavingId(userId);
    setFeedbackMsg(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole })
      });

      if (res.ok) {
        // Actualizar estado local
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, rol: newRole } : u));
        setFeedbackMsg({ id: userId, text: `Rol actualizado a "${ROLES_INFO[newRole].label}"` });
        // Si actualizó su propio usuario, refrescar el contexto
        if (user && user.id === userId) {
          await refreshRole();
        }
      } else {
        const errData = await res.json();
        setFeedbackMsg({ id: userId, text: errData.error || "No se pudo actualizar el rol", isError: true });
      }
    } catch (err: any) {
      setFeedbackMsg({ id: userId, text: err.message || "Error al conectar con el servidor", isError: true });
    } finally {
      setSavingId(null);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Filtrado de usuarios
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "ALL" || u.rol === filterRole;
    return matchesSearch && matchesRole;
  });

  // Métricas
  const totalUsers = users.length;
  const countPropietario = users.filter(u => u.rol === "propietario").length;
  const countDirectivo = users.filter(u => u.rol === "directivo").length;
  const countAdmin = users.filter(u => u.rol === "administracion").length;
  const countAnalista = users.filter(u => u.rol === "analista").length;

  // Formato de fechas amigable
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Nunca";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  // Si no es propietario, pantalla de acceso restringido
  if (!isPropietario) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/90 shadow-xl p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-xs">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Acceso Restringido
          </h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Esta sección de <strong>Gestión de Usuarios y Roles</strong> está reservada exclusivamente para el <strong>Propietario de la plataforma</strong> ({OWNER_EMAIL}).
          </p>
          <div className="mt-6 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 text-left w-full space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Tu usuario:</span>
              <span className="font-mono font-semibold text-slate-800">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Tu rol actual:</span>
              <span className="font-bold uppercase tracking-wider text-slate-700">
                {ROLES_INFO[currentUserRole]?.label || currentUserRole}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sqlCode = `-- Ejecutar en Supabase SQL Editor para crear tabla y triggers automáticos:
CREATE TABLE IF NOT EXISTS public.usuarios_perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    nombre VARCHAR(255),
    avatar_url TEXT,
    rol VARCHAR(50) NOT NULL DEFAULT 'analista',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_login TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_usuario_rol CHECK (rol IN ('propietario', 'directivo', 'administracion', 'analista'))
);

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_rol VARCHAR(50);
BEGIN
    IF LOWER(NEW.email) = 'matias.molesini@replylatam.com' THEN
        v_rol := 'propietario';
    ELSE
        v_rol := COALESCE(NEW.raw_app_meta_data->>'role', 'analista');
    END IF;
    INSERT INTO public.usuarios_perfiles (id, email, nombre, avatar_url, rol, ultimo_login)
    VALUES (
        NEW.id, 
        LOWER(NEW.email), 
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
        v_rol, 
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET ultimo_login = NOW(), updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE OF last_sign_in_at ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-300">
      
      {/* 1. Encabezado Ejecutivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center text-2xl shadow-sm shadow-amber-500/20">
            <ShieldCheck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Gestión de Usuarios y Roles (RBAC)
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Crown size={12} /> Propietario
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Supervisá los accesos a la plataforma, auditá inicios de sesión y asigná niveles de permisos a los colaboradores de Reply Latam.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSqlMigration(!showSqlMigration)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <FileCode2 size={14} className="text-slate-500" />
            <span>{showSqlMigration ? "Ocultar SQL" : "Script SQL Supabase"}</span>
          </button>
          
          <button
            onClick={fetchUsers}
            disabled={refreshing}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Accordion opcional de Migración SQL */}
      {showSqlMigration && (
        <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Sparkles size={14} />
              <span>Migración SQL para Supabase (Trigger & Tabla `usuarios_perfiles`)</span>
            </div>
            <button
              onClick={copySqlToClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium transition-colors cursor-pointer border border-slate-700"
            >
              {copiedSql ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copiar SQL</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Podés pegar y ejecutar este script en el <strong>SQL Editor</strong> de Supabase para activar la sincronización automática de nuevos usuarios a nivel base de datos.
          </p>
          <pre className="p-3.5 bg-black/60 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-56 border border-slate-800">
            {sqlCode}
          </pre>
        </div>
      )}

      {/* 2. Tarjetas de KPI de Roles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div 
          onClick={() => setFilterRole("ALL")}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterRole === "ALL" 
              ? "bg-white ring-2 ring-blue-600 shadow-md border-blue-200" 
              : "bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total</span>
            <Users size={16} />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {totalUsers}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Usuarios registrados</span>
        </div>

        <div 
          onClick={() => setFilterRole("propietario")}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterRole === "propietario" 
              ? "bg-white ring-2 ring-amber-500 shadow-md border-amber-200" 
              : "bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-xs font-bold uppercase tracking-wider">Propietario</span>
            <Crown size={16} />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-900 mt-2">
            {countPropietario}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Control total</span>
        </div>

        <div 
          onClick={() => setFilterRole("directivo")}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterRole === "directivo" 
              ? "bg-white ring-2 ring-indigo-500 shadow-md border-indigo-200" 
              : "bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-indigo-600">
            <span className="text-xs font-bold uppercase tracking-wider">Directivos</span>
            <Briefcase size={16} />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-900 mt-2">
            {countDirectivo}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Lectura ejecutiva</span>
        </div>

        <div 
          onClick={() => setFilterRole("administracion")}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterRole === "administracion" 
              ? "bg-white ring-2 ring-emerald-500 shadow-md border-emerald-200" 
              : "bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-bold uppercase tracking-wider">Finanzas</span>
            <Calculator size={16} />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-900 mt-2">
            {countAdmin}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Edición operativa</span>
        </div>

        <div 
          onClick={() => setFilterRole("analista")}
          className={`p-4 rounded-xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            filterRole === "analista" 
              ? "bg-white ring-2 ring-slate-600 shadow-md border-slate-300" 
              : "bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">Analistas</span>
            <Layers size={16} />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800 mt-2">
            {countAnalista}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Por defecto</span>
        </div>
      </div>

      {/* 3. Guía de Roles y Alcance */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-blue-600" />
          Matriz de Privilegios por Nivel de Rol
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {(Object.keys(ROLES_INFO) as UserRole[]).map(roleKey => {
            const info = ROLES_INFO[roleKey];
            return (
              <div 
                key={roleKey} 
                className={`p-3.5 rounded-xl border ${info.bg} ${info.border} space-y-1.5`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{info.icon}</span>
                  <span className={`font-bold ${info.color}`}>{info.label}</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {info.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Tabla de Colaboradores */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        
        {/* Barra de Filtros y Búsqueda */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
              Filtrar Rol:
            </span>
            {[
              { id: "ALL", label: "Todos" },
              { id: "propietario", label: "Propietario" },
              { id: "directivo", label: "Directivos" },
              { id: "administracion", label: "Finanzas" },
              { id: "analista", label: "Analistas" }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterRole(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterRole === f.id
                    ? "bg-slate-900 text-white font-bold shadow-2xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Colaborador</th>
                <th className="py-3.5 px-4">Correo Corporativo</th>
                <th className="py-3.5 px-4">Nivel de Rol</th>
                <th className="py-3.5 px-4">Último Inicio de Sesión</th>
                <th className="py-3.5 px-4">Fecha de Alta</th>
                <th className="py-3.5 px-4 text-right">Acción</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                    <span>Cargando lista de usuarios y credenciales...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No se encontraron usuarios</p>
                    <p className="text-xs text-slate-400 mt-0.5">Probá modificando el término de búsqueda o el filtro de rol.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrentAuthUser = user?.email?.toLowerCase() === u.email.toLowerCase();
                  const isMasterOwner = u.email.toLowerCase() === OWNER_EMAIL;
                  const isSavingThis = savingId === u.id;
                  const currentFeedback = feedbackMsg?.id === u.id ? feedbackMsg : null;
                  const roleConfig = ROLES_INFO[u.rol] || ROLES_INFO.analista;

                  return (
                    <tr 
                      key={u.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCurrentAuthUser ? "bg-amber-50/20" : ""
                      }`}
                    >
                      {/* Colaborador */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            {u.avatar_url ? (
                              <img 
                                src={u.avatar_url} 
                                alt={u.nombre}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-2xs" 
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                                {(u.nombre.charAt(0) || "U").toUpperCase()}
                              </div>
                            )}
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                              <span>{u.nombre}</span>
                              {isCurrentAuthUser && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  Tú
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block -mt-0.5">
                              ID: {u.id.substring(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Correo Corporativo */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <span>{u.email}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                            @replylatam.com
                          </span>
                        </div>
                      </td>

                      {/* Selector de Rol */}
                      <td className="py-3.5 px-4">
                        {isMasterOwner ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs shadow-2xs">
                            <Crown size={14} className="text-amber-600" />
                            <span>Propietario Root</span>
                          </div>
                        ) : (
                          <div className="relative inline-block w-44">
                            <select
                              value={u.rol}
                              disabled={isSavingThis}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                              className={`w-full appearance-none pl-3 pr-8 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 ${
                                roleConfig.bg
                              } ${roleConfig.border} ${roleConfig.color}`}
                            >
                              <option value="analista">🔍 Analista (Default)</option>
                              <option value="administracion">💼 Finanzas / Admin</option>
                              <option value="directivo">👔 Directivo</option>
                              <option value="propietario">👑 Propietario</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                          </div>
                        )}
                        {currentFeedback && (
                          <div className={`text-[10px] mt-1 font-semibold flex items-center gap-1 animate-in fade-in ${
                            currentFeedback.isError ? "text-red-600" : "text-emerald-600"
                          }`}>
                            {currentFeedback.isError ? <AlertCircle size={11} /> : <CheckCircle2 size={11} />}
                            <span>{currentFeedback.text}</span>
                          </div>
                        )}
                      </td>

                      {/* Último Login */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-slate-400" />
                          <span>{formatDate(u.ultimo_login)}</span>
                        </div>
                      </td>

                      {/* Fecha de Creación */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {formatDate(u.creado_el)}
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Habilitado</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>
            Mostrando <strong>{filteredUsers.length}</strong> de <strong>{totalUsers}</strong> cuentas autorizadas.
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Solo las cuentas corporativas @replylatam.com tienen acceso a la plataforma.
          </span>
        </div>
      </div>

    </div>
  );
}
