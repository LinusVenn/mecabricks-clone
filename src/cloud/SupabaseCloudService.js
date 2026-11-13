// =====================================================================
// SupabaseCloudService – Phase 9.3 / 9.7
//
// Konkrete CloudService-Implementierung für Supabase (PostgreSQL + RLS).
//
// Datenbankschema (projects-Tabelle):
//   id              uuid DEFAULT gen_random_uuid() PRIMARY KEY
//   owner_id        uuid REFERENCES auth.users NOT NULL
//   name            text NOT NULL
//   project_version integer DEFAULT 1 NOT NULL
//   schema_version  integer DEFAULT 1 NOT NULL
//   data            jsonb NOT NULL
//   created_at      timestamptz DEFAULT now()
//   updated_at      timestamptz DEFAULT now()
//
// RLS-Richtlinien (Sicherheit liegt ausschließlich auf Datenbankebene):
//   SELECT: owner_id = auth.uid()
//   INSERT: owner_id = auth.uid()
//   UPDATE: owner_id = auth.uid()
//   DELETE: owner_id = auth.uid()
//
// Optimistisches Locking:
//   Beim Update wird project_version geprüft. Stimmt sie nicht überein,
//   wird ein CONFLICT-Fehler geworfen.
// =====================================================================

import { CloudService, CloudError, CloudErrorCodes } from './CloudService.js';


const TABLE = 'projects';

export class SupabaseCloudService extends CloudService {

    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
     */
    constructor(supabaseClient) {
        super();
        if (!supabaseClient) throw new Error('SupabaseCloudService: supabaseClient ist erforderlich.');
        this._client = supabaseClient;
    }


    async listProjects() {
        const { data, error } = await this._client
            .from(TABLE)
            .select('id, name, project_version, schema_version, created_at, updated_at')
            .order('updated_at', { ascending: false });

        this._check(error, 'listProjects');
        return (data ?? []).map(this._fromDb);
    }


    async getProject(id) {
        const { data, error } = await this._client
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .single();

        if (error?.code === 'PGRST116') return null;  // no rows
        this._check(error, 'getProject');
        return data ? this._fromDb(data) : null;
    }


    async createProject({ name, data, schemaVersion = 1 }) {
        const userId = this.getCurrentUserId();
        if (!userId) throw new CloudError('Nicht angemeldet.', CloudErrorCodes.AUTH);

        const { data: row, error } = await this._client
            .from(TABLE)
            .insert({
                owner_id:        userId,
                name,
                project_version: 1,
                schema_version:  schemaVersion,
                data,
            })
            .select()
            .single();

        this._check(error, 'createProject');
        return this._fromDb(row);
    }


    async updateProject(id, { name, data, expectedVersion }) {
        // Optimistisches Locking: aktuelle Version lesen
        if (expectedVersion !== undefined) {
            const current = await this.getProject(id);
            if (!current) throw new CloudError('Projekt nicht gefunden.', CloudErrorCodes.NOT_FOUND);
            if (current.projectVersion !== expectedVersion) {
                throw new CloudError(
                    'Versionskonflikt: Das Projekt wurde auf einem anderen Gerät geändert.',
                    CloudErrorCodes.CONFLICT,
                    { expectedVersion, currentVersion: current.projectVersion }
                );
            }
        }

        const { data: row, error } = await this._client
            .from(TABLE)
            .update({
                name,
                data,
                project_version: this._client.rpc('increment', { x: 1 }),
                updated_at:      new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        this._check(error, 'updateProject');
        return this._fromDb(row);
    }


    async deleteProject(id) {
        const { error } = await this._client.from(TABLE).delete().eq('id', id);
        this._check(error, 'deleteProject');
    }


    getCurrentUserId() {
        // Supabase speichert die Sitzung synchron im Client
        return this._client.auth.session?.()?.user?.id
            ?? this._client.auth.getSession?.()?.then?.(() => null)
            ?? null;
    }


    // ------------------------------------------------------------------
    // Private
    // ------------------------------------------------------------------

    _fromDb(row) {
        return {
            id:             row.id,
            ownerId:        row.owner_id,
            name:           row.name,
            projectVersion: row.project_version,
            schemaVersion:  row.schema_version,
            data:           row.data,
            createdAt:      row.created_at,
            updatedAt:      row.updated_at,
        };
    }

    _check(error, context) {
        if (!error) return;
        const status = error.status ?? error.code;
        if (status === 401 || error.code === 'PGRST301') {
            throw new CloudError('Authentifizierungsfehler.', CloudErrorCodes.AUTH, { originalError: error });
        }
        if (status === 403) {
            throw new CloudError('Kein Zugriff.', CloudErrorCodes.FORBIDDEN, { originalError: error });
        }
        if (status === 404 || error.code === 'PGRST116') {
            throw new CloudError('Nicht gefunden.', CloudErrorCodes.NOT_FOUND, { originalError: error });
        }
        throw new CloudError(
            error.message ?? `Cloud-Fehler in ${context}.`,
            CloudErrorCodes.SERVER_ERROR,
            { originalError: error }
        );
    }
}
