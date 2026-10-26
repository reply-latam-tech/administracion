import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export type UserRole = 'propietario' | 'directivo' | 'administracion' | 'analista';

export interface UserItem {
  id: string;
  email: string;
  nombre: string;
  avatar_url?: string;
  rol: UserRole;
  creado_el: string;
  ultimo_login?: string | null;
}

const OWNER_EMAIL = 'matias.molesini@replylatam.com';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 100
    });

    if (error) {
      console.error('Error listUsers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rawUsers = data?.users || [];

    // Opcional: intentar consultar tabla public.usuarios_perfiles si existe
    let dbRolesMap: Record<string, UserRole> = {};
    try {
      const { data: dbProfiles } = await supabaseAdmin
        .from('usuarios_perfiles')
        .select('id, email, rol');
      if (dbProfiles) {
        dbProfiles.forEach((p: any) => {
          if (p.id) dbRolesMap[p.id] = p.rol;
          if (p.email) dbRolesMap[p.email.toLowerCase()] = p.rol;
        });
      }
    } catch {
      // Si la tabla no existe en la base, usamos app_metadata de auth.users
    }

    const users: UserItem[] = rawUsers.map((u) => {
      const email = u.email || '';
      const emailLower = email.toLowerCase();
      const meta = u.user_metadata || {};
      const appMeta = u.app_metadata || {};

      // Determinar rol con jerarquía:
      // 1. Si es el propietario root -> 'propietario'
      // 2. Si está en dbProfiles -> rol de db
      // 3. Si tiene app_metadata.role -> rol de app_metadata
      // 4. Default -> 'analista'
      let rol: UserRole = 'analista';
      if (emailLower === OWNER_EMAIL) {
        rol = 'propietario';
      } else if (dbRolesMap[u.id] || dbRolesMap[emailLower]) {
        rol = dbRolesMap[u.id] || dbRolesMap[emailLower];
      } else if (appMeta.role) {
        rol = appMeta.role as UserRole;
      }

      const nombre = meta.full_name || meta.name || email.split('@')[0] || 'Usuario';
      const avatar_url = meta.avatar_url || meta.picture || '';

      return {
        id: u.id,
        email,
        nombre,
        avatar_url,
        rol,
        creado_el: u.created_at,
        ultimo_login: u.last_sign_in_at || null
      };
    });

    // Ordenar: primero propietario, luego directivo, luego administracion, luego analista
    const rolePriority: Record<UserRole, number> = {
      propietario: 1,
      directivo: 2,
      administracion: 3,
      analista: 4
    };

    users.sort((a, b) => {
      const pA = rolePriority[a.rol] || 99;
      const pB = rolePriority[b.rol] || 99;
      if (pA !== pB) return pA - pB;
      return new Date(b.creado_el).getTime() - new Date(a.creado_el).getTime();
    });

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error('Error in GET /api/admin/users:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios: userId y role' }, { status: 400 });
    }

    const validRoles: UserRole[] = ['propietario', 'directivo', 'administracion', 'analista'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `Rol inválido: ${role}` }, { status: 400 });
    }

    // 1. Actualizar app_metadata en Supabase Auth
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role }
    });

    if (authError) {
      console.error('Error al actualizar app_metadata:', authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // 2. Si existe la tabla public.usuarios_perfiles, sincronizar también allí
    try {
      await supabaseAdmin.from('usuarios_perfiles').upsert({
        id: userId,
        email: userData.user.email,
        rol: role,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch {
      // Ignorar si la tabla aún no fue creada
    }

    return NextResponse.json({ 
      success: true, 
      userId, 
      newRole: role,
      user: {
        id: userData.user.id,
        email: userData.user.email,
        role
      }
    });
  } catch (err: any) {
    console.error('Error in PATCH /api/admin/users:', err);
    return NextResponse.json({ error: err.message || 'Error interno al actualizar rol' }, { status: 500 });
  }
}
