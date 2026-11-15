// =====================================================================
// initializeCloudPhase9 – Phase 9.9
//
// Einsprungpunkt für die vollständige Phase-9-Integration.
//
// Ablauf:
//   1. Supabase-Client erstellen (falls env vars vorhanden)
//   2. AuthManager + AuthService initialisieren
//   3. CloudService + CloudProjectManager initialisieren
//   4. SyncStatusManager + CloudSyncManager initialisieren
//   5. UI-Panels erstellen und registrieren
//   6. AutoSaveManager-Hook für Dirty-Tracking verdrahten
//   7. Sitzung wiederherstellen (falls vorhanden)
//   8. Globale Zugriffspunkte setzen
//
// Wenn keine Supabase-Konfiguration vorhanden ist (kein VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY), werden Null-Implementierungen verwendet und
// der Editor läuft vollständig ohne Cloud-Funktionen weiter.
// =====================================================================

import { AuthManager }          from '../auth/AuthManager.js';
import { AuthService, AuthError }from '../auth/AuthService.js';
import { CloudService, CloudError, CloudErrorCodes } from './CloudService.js';
import { CloudProjectManager }  from './CloudProjectManager.js';
import { CloudSyncManager }     from './CloudSyncManager.js';
import { CloudStorage }         from './CloudStorage.js';
import { SyncStatusManager, SyncStatus } from './SyncStatusManager.js';
import { CloudErrorHandler }    from './CloudErrorHandler.js';
import { LoginPanel }           from '../auth/LoginPanel.js';
import { RegisterPanel }        from '../auth/RegisterPanel.js';
import { AccountPanel }         from '../auth/AccountPanel.js';
import { CloudProjectPanel }    from '../ui/CloudProjectPanel.js';
import { AccountMenu }          from '../ui/AccountMenu.js';


// -----------------------------------------------------------------------
// Null-Implementierungen (Fallback ohne Supabase)
// -----------------------------------------------------------------------

class NullAuthService extends AuthService {
    async register()  { throw new AuthError('Cloud nicht konfiguriert.', 'NOT_CONFIGURED'); }
    async login()     { throw new AuthError('Cloud nicht konfiguriert.', 'NOT_CONFIGURED'); }
    async logout()    {}
    async getSession(){ return null; }
    async resetPassword() {}
    onAuthStateChange()   { return () => {}; }
}

class NullCloudService extends CloudService {
    async listProjects()          { return []; }
    async getProject()            { return null; }
    async createProject()         { throw new CloudError('Cloud nicht konfiguriert.', CloudErrorCodes.SERVER_ERROR); }
    async updateProject()         { throw new CloudError('Cloud nicht konfiguriert.', CloudErrorCodes.SERVER_ERROR); }
    async deleteProject()         {}
    getCurrentUserId()            { return null; }
}


// -----------------------------------------------------------------------
// Initialisierer
// -----------------------------------------------------------------------

/**
 * @param {{
 *   sidebar:              HTMLElement
 *   projectManager:       import('../project/ProjectManager.js').ProjectManager
 *   autoSaveManager:      object
 *   historyManager:       object
 *   editor:               object
 *   panelManager?:        import('../ui/EditorPanelManager.js').EditorPanelManager
 *   errorHandler?:        import('../core/EditorErrorHandler.js').EditorErrorHandler
 *   supabaseUrl?:         string
 *   supabaseKey?:         string
 *   onProjectLoaded?:     () => void
 * }} options
 */
export async function initializeCloudPhase9({
    sidebar,
    projectManager,
    autoSaveManager,
    historyManager,
    editor,
    panelManager   = null,
    errorHandler   = null,
    supabaseUrl    = (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL  : null) ?? null,
    supabaseKey    = (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_ANON_KEY : null) ?? null,
    onProjectLoaded = () => {},
}) {
    if (!sidebar || !projectManager) {
        throw new Error('initializeCloudPhase9: sidebar und projectManager sind Pflichtparameter.');
    }

    // ------------------------------------------------------------------
    // 1. Services auflösen
    // ------------------------------------------------------------------
    let authService, cloudService;
    let supabaseAvailable = false;

    if (supabaseUrl && supabaseKey) {
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(supabaseUrl, supabaseKey);

            const { SupabaseAuthService }  = await import('../auth/SupabaseAuthService.js');
            const { SupabaseCloudService } = await import('./SupabaseCloudService.js');

            authService   = new SupabaseAuthService(supabase);
            cloudService  = new SupabaseCloudService(supabase);
            supabaseAvailable = true;
            console.log('[Phase 9] Supabase-Integration aktiv.');
        } catch (err) {
            console.warn('[Phase 9] Supabase konnte nicht geladen werden:', err.message);
        }
    }

    if (!supabaseAvailable) {
        console.warn('[Phase 9] Keine Supabase-Konfiguration – Cloud-Funktionen deaktiviert.');
        authService  = new NullAuthService();
        cloudService = new NullCloudService();
    }

    // ------------------------------------------------------------------
    // 2. Manager initialisieren
    // ------------------------------------------------------------------
    const authManager         = new AuthManager(authService);
    const cloudProjectManager = new CloudProjectManager(cloudService);
    const syncStatusManager   = new SyncStatusManager();
    const cloudErrorHandler   = new CloudErrorHandler({
        onError: entry => console.error('[CloudError]', entry.context, entry.message)
    });
    const cloudSyncManager    = new CloudSyncManager({
        projectManager,
        cloudProjectManager,
        syncStatusManager,
        authManager,
        cloudErrorHandler,
    });

    // ------------------------------------------------------------------
    // 3. UI-Panels erstellen
    // ------------------------------------------------------------------

    function createContainer(id, title) {
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.className = 'phase-panel-container';
            const h = document.createElement('h3');
            h.textContent = title;
            el.appendChild(h);
            sidebar.appendChild(el);
        }
        return el;
    }

    const loginContainer   = createContainer('login-panel-container',    'Anmelden');
    const registerContainer= createContainer('register-panel-container', 'Registrieren');
    const accountContainer = createContainer('account-panel-container',  'Konto');
    const cloudContainer   = createContainer('cloud-project-container',  'Cloud-Projekte');

    const loginPanel = new LoginPanel(loginContainer, authManager, {
        onSuccess: () => { loginPanel.hide(); accountPanel.show(); cloudPanel.refresh(); },
        onSwitchToRegister: () => { loginPanel.hide(); registerPanel.show(); },
    });

    const registerPanel = new RegisterPanel(registerContainer, authManager, {
        onSuccess:      () => { registerPanel.hide(); loginPanel.show(); },
        onSwitchToLogin: () => { registerPanel.hide(); loginPanel.show(); },
    });

    const accountPanel = new AccountPanel(accountContainer, authManager, {
        onLogout: () => { accountPanel.hide(); loginPanel.show(); cloudSyncManager.reset(); },
    });

    const cloudPanel = new CloudProjectPanel(cloudContainer, {
        authManager,
        cloudProjectManager,
        syncManager: cloudSyncManager,
        syncStatusManager,
        onProjectLoaded: async () => {
            historyManager?.initialize?.();
            onProjectLoaded();
        },
    });

    // Initiale Sichtbarkeit
    if (!authManager.isLoggedIn) { accountPanel.hide(); }
    else                         { loginPanel.hide(); }

    // ------------------------------------------------------------------
    // 4. AccountMenu in Header
    // ------------------------------------------------------------------
    const header = document.getElementById('header') ?? sidebar;
    const accountMenuEl = document.createElement('div');
    accountMenuEl.id = 'account-menu';
    header.appendChild(accountMenuEl);

    const accountMenu = new AccountMenu(accountMenuEl, authManager, {
        onShowLogin:   () => { loginPanel.show(); accountPanel.hide(); },
        onShowAccount: () => { accountPanel.show(); loginPanel.hide(); },
    });

    // ------------------------------------------------------------------
    // 5. AutoSaveManager-Hook (markDirty bei jeder lokalen Speicherung)
    // ------------------------------------------------------------------
    const _originalScheduleSave = autoSaveManager?.scheduleSave?.bind(autoSaveManager);
    if (_originalScheduleSave) {
        autoSaveManager.scheduleSave = (...args) => {
            cloudSyncManager.markDirty();
            return _originalScheduleSave(...args);
        };
    }

    // ------------------------------------------------------------------
    // 6. Sitzung wiederherstellen
    // ------------------------------------------------------------------
    await authManager.restoreSession();

    if (authManager.isLoggedIn) {
        loginPanel.hide();
        accountPanel.show();
        cloudPanel.refresh();
    }

    // ------------------------------------------------------------------
    // 7. Panel-Manager registrieren (falls vorhanden)
    // ------------------------------------------------------------------
    if (panelManager) {
        panelManager.register('cloud',    cloudPanel,    cloudContainer);
        panelManager.register('account',  accountPanel,  accountContainer);
        panelManager.register('login',    loginPanel,    loginContainer);
        panelManager.register('register', registerPanel, registerContainer);
    }

    // ------------------------------------------------------------------
    // 8. Globale Zugriffspunkte
    // ------------------------------------------------------------------
    window.authManager         = authManager;
    window.cloudProjectManager = cloudProjectManager;
    window.cloudSyncManager    = cloudSyncManager;
    window.syncStatusManager   = syncStatusManager;
    window.cloudPanel          = cloudPanel;
    window.accountMenu         = accountMenu;

    return {
        authManager,
        cloudProjectManager,
        cloudSyncManager,
        syncStatusManager,
        cloudErrorHandler,
        loginPanel,
        registerPanel,
        accountPanel,
        cloudPanel,
        accountMenu,
        supabaseAvailable,
    };
}
