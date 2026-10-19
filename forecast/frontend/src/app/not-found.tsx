import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 select-none">
      <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#ff5100] mb-4 shadow-sm">
        <AlertCircle size={32} />
      </div>
      <h1 className="text-3xl font-black text-slate-900 tracking-tight">404 - Página no encontrada</h1>
      <p className="text-sm text-slate-500 max-w-md mt-2">
        La ruta solicitada no existe o fue reubicada en la arquitectura multicanal de Reply.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
        >
          <ArrowLeft size={14} />
          <span>Volver al Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
