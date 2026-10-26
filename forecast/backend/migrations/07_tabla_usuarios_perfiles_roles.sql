-- ==============================================================================
-- MIGRACIÓN 07: TABLA DE PERFILES DE USUARIOS Y CONTROL DE ROLES (RBAC)
-- ==============================================================================
-- Gestiona los roles de acceso corporativo a la plataforma de Forecast & Administración.
-- Roles:
--   - 'propietario': Matias Molesini (Control total, administración de roles y auditoría)
--   - 'directivo': Lucas, Pablo, Alfredo, Carlos (Lectura ejecutiva, KPIs, flujo de caja)
--   - 'administracion': Lisbeth González (Edición de directorio, escalas, novedades, facturación)
--   - 'analista': Rol por defecto para cualquier nuevo ingreso de @replylatam.com
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CREACIÓN DE TABLA: USUARIOS_PERFILES
-- ------------------------------------------------------------------------------
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

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_usuarios_perfiles_email ON public.usuarios_perfiles(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_perfiles_rol ON public.usuarios_perfiles(rol);

-- ------------------------------------------------------------------------------
-- 2. FUNCIÓN Y TRIGGER: SINCRONIZACIÓN AUTOMÁTICA AL CREARSE USUARIO EN AUTH.USERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_rol VARCHAR(50);
    v_nombre VARCHAR(255);
    v_avatar TEXT;
BEGIN
    -- Asignar rol: Propietario para Matias, Analista para el resto por defecto
    IF LOWER(NEW.email) = 'matias.molesini@replylatam.com' THEN
        v_rol := 'propietario';
    ELSE
        -- Si viene un rol especificado en app_metadata, respetarlo, si no 'analista'
        v_rol := COALESCE(NEW.raw_app_meta_data->>'role', 'analista');
    END IF;

    -- Extraer nombre y avatar desde los metadatos de Google
    v_nombre := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        SPLIT_PART(NEW.email, '@', 1)
    );
    v_avatar := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture',
        ''
    );

    INSERT INTO public.usuarios_perfiles (id, email, nombre, avatar_url, rol, ultimo_login, created_at, updated_at)
    VALUES (NEW.id, LOWER(NEW.email), v_nombre, v_avatar, v_rol, NOW(), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        nombre = COALESCE(EXCLUDED.nombre, usuarios_perfiles.nombre),
        avatar_url = COALESCE(EXCLUDED.avatar_url, usuarios_perfiles.avatar_url),
        ultimo_login = NOW(),
        updated_at = NOW();

    -- También actualizar app_metadata en auth.users para que el JWT contenga el rol
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_rol)
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;

-- Trigger disparador en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE OF last_sign_in_at ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ------------------------------------------------------------------------------
-- 3. HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.usuarios_perfiles ENABLE ROW LEVEL SECURITY;

-- Lectura: Todos los usuarios autenticados de @replylatam.com pueden leer perfiles
DROP POLICY IF EXISTS "Permitir lectura autenticados usuarios_perfiles" ON public.usuarios_perfiles;
CREATE POLICY "Permitir lectura autenticados usuarios_perfiles"
    ON public.usuarios_perfiles FOR SELECT
    TO authenticated
    USING (true);

-- Modificación: Solo el Propietario o el Service Role pueden modificar roles
DROP POLICY IF EXISTS "Solo propietario puede modificar roles" ON public.usuarios_perfiles;
CREATE POLICY "Solo propietario puede modificar roles"
    ON public.usuarios_perfiles FOR ALL
    TO authenticated, service_role
    USING (
        auth.jwt()->>'email' = 'matias.molesini@replylatam.com'
        OR auth.jwt()->'app_metadata'->>'role' = 'propietario'
    )
    WITH CHECK (
        auth.jwt()->>'email' = 'matias.molesini@replylatam.com'
        OR auth.jwt()->'app_metadata'->>'role' = 'propietario'
    );

-- ------------------------------------------------------------------------------
-- 4. POBLAR PERFIL INICIAL SI YA EXISTE EL USUARIO EN AUTH.USERS
-- ------------------------------------------------------------------------------
INSERT INTO public.usuarios_perfiles (id, email, nombre, avatar_url, rol)
SELECT 
    id, 
    LOWER(email), 
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Matias Molesini'),
    COALESCE(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture', ''),
    'propietario'
FROM auth.users
WHERE LOWER(email) = 'matias.molesini@replylatam.com'
ON CONFLICT (id) DO UPDATE 
SET rol = 'propietario', updated_at = NOW();

COMMIT;
