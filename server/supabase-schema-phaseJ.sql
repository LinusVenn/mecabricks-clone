-- =====================================================================
-- Supabase Database Schema – Phase J (Collaboration)
--
-- Run this file AFTER the Phase I schema (supabase-schema.sql).
-- It adds four new tables and modifies existing RLS policies to
-- support multi-user collaboration: members, invitations, versions,
-- and activity logs.
--
-- Tables added:
--   • project_members      – Users who have been granted access
--   • project_invitations  – Pending / historical invitations
--   • project_versions     – Named snapshots of project data
--   • project_activity     – Audit log of collaborative events
--
-- Helper functions:
--   • is_project_member(project_uuid, user_uuid) → BOOLEAN
--   • get_project_role(project_uuid, user_uuid)  → VARCHAR
--   • is_project_owner(project_uuid, user_uuid)  → BOOLEAN
--   • next_version_number(project_uuid)          → INTEGER
-- =====================================================================


-- =====================================================================
-- SECTION 0 – Helper functions (used by RLS policies below)
-- These must be created before the policies that reference them.
-- =====================================================================

-- Returns TRUE when the given user is the owner of the project.
CREATE OR REPLACE FUNCTION public.is_project_owner(
    p_project_id UUID,
    p_user_id    UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM   public.projects
        WHERE  id       = p_project_id
          AND  owner_id = p_user_id
    );
$$;

-- Returns TRUE when the user has any row in project_members for this project.
CREATE OR REPLACE FUNCTION public.is_project_member(
    p_project_id UUID,
    p_user_id    UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM   public.project_members
        WHERE  project_id = p_project_id
          AND  user_id    = p_user_id
    )
    OR public.is_project_owner(p_project_id, p_user_id);
$$;

-- Returns the effective role of a user for a project:
--   'owner'  – user is the project owner
--   'editor' / 'viewer' – from project_members
--   NULL     – no access
CREATE OR REPLACE FUNCTION public.get_project_role(
    p_project_id UUID,
    p_user_id    UUID
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_role VARCHAR;
BEGIN
    -- Owner always wins regardless of any member row.
    IF public.is_project_owner(p_project_id, p_user_id) THEN
        RETURN 'owner';
    END IF;

    SELECT role
    INTO   v_role
    FROM   public.project_members
    WHERE  project_id = p_project_id
      AND  user_id    = p_user_id
    LIMIT  1;

    RETURN v_role; -- NULL when no member row found
END;
$$;

-- Returns the next sequential version number for a project.
-- Called when inserting into project_versions.
CREATE OR REPLACE FUNCTION public.next_version_number(p_project_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT COALESCE(MAX(version_number), 0) + 1
    FROM   public.project_versions
    WHERE  project_id = p_project_id;
$$;


-- =====================================================================
-- SECTION 1 – project_members
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_members (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
    role        VARCHAR(16) NOT NULL CHECK (role IN ('viewer', 'editor', 'owner')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  UUID        NOT NULL REFERENCES auth.users(id),

    UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id    ON public.project_members(user_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Any member (including owner) can list the members of a project they belong to.
CREATE POLICY "Members can view project members"
    ON public.project_members FOR SELECT
    USING (public.is_project_member(project_id, auth.uid()));

-- Only the project owner may add a new member row.
CREATE POLICY "Owner can add project members"
    ON public.project_members FOR INSERT
    WITH CHECK (public.is_project_owner(project_id, auth.uid()));

-- Only the project owner may update a member's role.
CREATE POLICY "Owner can update project members"
    ON public.project_members FOR UPDATE
    USING (public.is_project_owner(project_id, auth.uid()));

-- Only the project owner may remove a member.
CREATE POLICY "Owner can delete project members"
    ON public.project_members FOR DELETE
    USING (public.is_project_owner(project_id, auth.uid()));


-- =====================================================================
-- SECTION 2 – project_invitations
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_invitations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    invited_email   VARCHAR(320) NOT NULL,
    invited_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    role            VARCHAR(16) NOT NULL CHECK (role IN ('viewer', 'editor')),
    token_hash      TEXT        NOT NULL UNIQUE,
    status          VARCHAR(16) NOT NULL
                        DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_by      UUID        NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON public.project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_token_hash ON public.project_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_project_invitations_status     ON public.project_invitations(status);
CREATE INDEX IF NOT EXISTS idx_project_invitations_invited_email
    ON public.project_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_invited_user_id
    ON public.project_invitations(invited_user_id)
    WHERE invited_user_id IS NOT NULL;

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- Project owner can view all invitations for their project.
CREATE POLICY "Owner can view project invitations"
    ON public.project_invitations FOR SELECT
    USING (public.is_project_owner(project_id, auth.uid()));

-- The invited user can view their own invitation (needed to accept/decline).
CREATE POLICY "Invited user can view own invitation"
    ON public.project_invitations FOR SELECT
    USING (invited_user_id = auth.uid());

-- Only the project owner may create an invitation.
CREATE POLICY "Owner can create invitations"
    ON public.project_invitations FOR INSERT
    WITH CHECK (public.is_project_owner(project_id, auth.uid()));

-- Only the project owner may revoke (update status → 'revoked').
-- The accept/decline flow is handled by a SECURITY DEFINER function, not direct UPDATE.
CREATE POLICY "Owner can update invitations"
    ON public.project_invitations FOR UPDATE
    USING (public.is_project_owner(project_id, auth.uid()));

-- No direct DELETE; use status changes instead.
-- Cleanup of old records is handled by a scheduled job.


-- =====================================================================
-- SECTION 3 – project_versions
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_versions (
    id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID    NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    project_data   JSONB   NOT NULL,
    created_by     UUID    NOT NULL REFERENCES auth.users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description    TEXT    NOT NULL DEFAULT '',

    UNIQUE (project_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_project_versions_project_id
    ON public.project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id_version
    ON public.project_versions(project_id, version_number DESC);

ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

-- Any project member (owner, editor, viewer) may read versions.
CREATE POLICY "Members can view versions"
    ON public.project_versions FOR SELECT
    USING (public.is_project_member(project_id, auth.uid()));

-- Owner or editor may create a version snapshot.
CREATE POLICY "Owner/editor can create versions"
    ON public.project_versions FOR INSERT
    WITH CHECK (
        public.get_project_role(project_id, auth.uid()) IN ('owner', 'editor')
    );

-- Versions are immutable; no UPDATE policy.
-- Only the project owner may delete a version (cleanup).
CREATE POLICY "Owner can delete versions"
    ON public.project_versions FOR DELETE
    USING (public.is_project_owner(project_id, auth.uid()));


-- =====================================================================
-- SECTION 4 – project_activity
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_activity (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES auth.users(id),
    action     VARCHAR(64) NOT NULL,
    details    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_activity_project_id
    ON public.project_activity(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_user_id
    ON public.project_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_created_at
    ON public.project_activity(project_id, created_at DESC);

ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;

-- Any project member may read the activity log.
CREATE POLICY "Members can view activity"
    ON public.project_activity FOR SELECT
    USING (public.is_project_member(project_id, auth.uid()));

-- Activity is written by the service layer using a SECURITY DEFINER function
-- or via the service-role key; direct INSERT is only allowed for the actor.
CREATE POLICY "Actor can insert own activity"
    ON public.project_activity FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND public.is_project_member(project_id, auth.uid())
    );

-- Activity log is immutable; no UPDATE / DELETE policies for regular users.


-- =====================================================================
-- SECTION 5 – Modify existing projects RLS
--
-- The original policy allows only the owner to SELECT their projects.
-- We add an additional SELECT policy so that members can also read
-- project metadata (but NOT project data – the service layer applies
-- an extra check before returning the JSONB data field).
-- =====================================================================

-- Allow members (non-owners) to read the project row.
-- Named distinctly so it can be dropped without touching the original.
CREATE POLICY "Members can read project"
    ON public.projects FOR SELECT
    USING (public.is_project_member(id, auth.uid()));

-- Members with 'editor' role may update a project.
-- Owners already have their own UPDATE policy from Phase I.
CREATE POLICY "Editor can update project"
    ON public.projects FOR UPDATE
    USING (public.get_project_role(id, auth.uid()) = 'editor');


-- =====================================================================
-- SECTION 6 – SECURITY DEFINER helper for invitation acceptance
--
-- Because the invitation UPDATE policy only allows the owner, we
-- provide a SECURITY DEFINER function so the invited user can change
-- the status to 'accepted' or 'declined' safely without gaining
-- broad UPDATE access.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.respond_to_invitation(
    p_token_hash TEXT,
    p_user_id    UUID,
    p_response   VARCHAR   -- 'accepted' | 'declined'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inv  public.project_invitations%ROWTYPE;
    v_role VARCHAR(16);
BEGIN
    -- Validate response value
    IF p_response NOT IN ('accepted', 'declined') THEN
        RAISE EXCEPTION 'Invalid response: %', p_response;
    END IF;

    -- Fetch the invitation by token hash
    SELECT *
    INTO   v_inv
    FROM   public.project_invitations
    WHERE  token_hash = p_token_hash
      AND  status     = 'pending'
      AND  expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVITATION_NOT_FOUND: No valid pending invitation for provided token.';
    END IF;

    -- Mark as responded
    UPDATE public.project_invitations
    SET    status          = p_response,
           invited_user_id = p_user_id
    WHERE  id = v_inv.id;

    -- When accepted, create the member row
    IF p_response = 'accepted' THEN
        INSERT INTO public.project_members (project_id, user_id, role, created_by)
        VALUES (v_inv.project_id, p_user_id, v_inv.role, v_inv.created_by)
        ON CONFLICT (project_id, user_id) DO UPDATE
            SET role = EXCLUDED.role;
    END IF;

    RETURN jsonb_build_object(
        'invitationId', v_inv.id,
        'projectId',    v_inv.project_id,
        'role',         v_inv.role,
        'response',     p_response
    );
END;
$$;


-- =====================================================================
-- SECTION 7 – SECURITY DEFINER wrapper for activity logging
--
-- The service-role key bypasses RLS, but when using the anon / user
-- key the actor can only log their own actions.  This function allows
-- the server (running as service role) to log on behalf of any user.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.log_project_activity(
    p_project_id UUID,
    p_user_id    UUID,
    p_action     VARCHAR,
    p_details    JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.project_activity (project_id, user_id, action, details)
    VALUES (p_project_id, p_user_id, p_action, p_details)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;


-- =====================================================================
-- SECTION 8 – user_profiles visibility for collaboration
--
-- Members need to look up the display_name of their collaborators.
-- Add a policy so any authenticated user can read another user's profile.
-- =====================================================================

-- Allow any authenticated user to read any profile (display_name only).
-- Restrict columns at the application layer if needed.
DO $$
BEGIN
    -- Only create if it doesn't already exist to keep idempotency.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE  schemaname = 'public'
          AND  tablename  = 'user_profiles'
          AND  policyname = 'Authenticated users can view profiles'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY "Authenticated users can view profiles"
                ON public.user_profiles FOR SELECT
                USING (auth.uid() IS NOT NULL)
        $policy$;
    END IF;
END;
$$;


-- =====================================================================
-- End of Phase J schema
-- =====================================================================
