-- =====================================================================
-- Supabase-Datenbankschema – Phase I.2
--
-- Dieses Schema entspricht dem im Plan vorgesehenen Datenbankmodell.
-- Es wird im Supabase SQL-Editor ausgeführt (einmalig bei Setup).
--
-- Tabellen:
--   • projects  – Projektdaten (user_id, name, project_data JSONB, …)
--
-- Hinweis: Supabase verwaltet Benutzer und Sessions intern in der
-- Tabelle auth.users. Eine eigene users-Tabelle ist nur erforderlich,
-- wenn zusätzliche Profilfelder (z. B. display_name) gespeichert werden.
-- =====================================================================


-- =====================================================================
-- 1. Benutzerprofil-Tabelle (optional, ergänzt auth.users)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Automatische Aktualisierung von updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();

-- RLS aktivieren
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Benutzer kann nur das eigene Profil lesen und ändern
CREATE POLICY "Eigenes Profil lesen" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Eigenes Profil ändern" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Profil wird automatisch bei Registrierung angelegt
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, display_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_new_user();


-- =====================================================================
-- 2. Projekttabelle
--
-- Entspricht dem Plan-Datenbankmodell I.2:
--   id              UUID PRIMARY KEY
--   user_id         UUID → auth.users
--   name            TEXT
--   project_data    JSONB  (vollständiges serialisiertes Projekt)
--   format_version  INTEGER (Projektformat-Version)
--   revision        INTEGER (optimistisches Locking, steigt mit jedem Update)
--   created_at      TIMESTAMPTZ
--   updated_at      TIMESTAMPTZ
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.projects (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 255),
    project_version INTEGER     NOT NULL DEFAULT 1,
    schema_version  INTEGER     NOT NULL DEFAULT 1,
    data            JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index für schnelle Abfragen nach Eigentümer
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);

-- updated_at automatisch aktualisieren
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();

-- =====================================================================
-- 3. Row Level Security (RLS) für Projekte
--
-- Jeder Benutzer sieht und ändert nur seine eigenen Projekte.
-- Eine Projekt-ID allein gewährt keinen Zugriff.
-- =====================================================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eigene Projekte lesen" ON public.projects
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Eigene Projekte anlegen" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Eigene Projekte ändern" ON public.projects
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Eigene Projekte löschen" ON public.projects
    FOR DELETE USING (auth.uid() = owner_id);


-- =====================================================================
-- 4. Hilfsfunktion: Atomares Inkrementieren der project_version
--
-- Wird von SupabaseCloudService.updateProject() verwendet, um
-- Versionskonflikte (optimistisches Locking) korrekt zu behandeln.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.increment_project_version(
    project_id      UUID,
    expected_version INTEGER,
    new_name        TEXT,
    new_data        JSONB
)
RETURNS SETOF public.projects
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Prüfen ob die erwartete Version noch aktuell ist
    IF NOT EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = project_id
          AND owner_id = auth.uid()
          AND project_version = expected_version
    ) THEN
        RAISE EXCEPTION 'CONFLICT: Projekt wurde seit dem letzten Laden geändert (Revision %).',
            expected_version
            USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY
        UPDATE public.projects
        SET
            name            = COALESCE(new_name, name),
            data            = new_data,
            project_version = project_version + 1,
            updated_at      = NOW()
        WHERE id = project_id
          AND owner_id = auth.uid()
        RETURNING *;
END;
$$;


-- =====================================================================
-- 5. Größenbeschränkung
--
-- Projekte mit mehr als 10 MB werden abgelehnt.
-- Kann je nach Anwendungsfall angepasst werden.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.check_project_size()
RETURNS TRIGGER AS $$
BEGIN
    IF octet_length(NEW.data::text) > 10 * 1024 * 1024 THEN
        RAISE EXCEPTION 'Projektdaten überschreiten die maximale Größe von 10 MB.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_size_check
    BEFORE INSERT OR UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE PROCEDURE public.check_project_size();
