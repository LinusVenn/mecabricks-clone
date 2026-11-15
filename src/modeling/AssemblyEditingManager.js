export class AssemblyEditingManager {
    constructor({ isolationManager, library, groupManager, assemblyManager = null, collaborationManager = null }) {
        if (!isolationManager || !library) throw new Error('AssemblyEditingManager benötigt isolationManager und library.');
        this._isolation = isolationManager;
        this._lib = library;
        this._groups = groupManager ?? null;
        this._assemblies = assemblyManager ?? null;
        this._collab = collaborationManager;
        this._activeAssembly = null;
        this._locked = new Set();
        this._listeners = new Set();
    }

    _resolveAssembly(assembly) {
        if (!assembly?.id) throw new Error('Ungültige Baugruppe.');
        const groupId = assembly.groupId ?? assembly.id;
        const group = this._groups?.getGroup?.(groupId) ?? null;
        const brickIds = assembly.brickIds ?? group?.brickIds ?? [];
        return { ...assembly, groupId, brickIds: [...brickIds] };
    }

    _resolveBricks(ids) { return ids.map(id => this._lib.getById(id)).filter(Boolean); }

    enterAssembly(assembly) {
        const resolved = this._resolveAssembly(assembly);
        if (this._activeAssembly) this.exitAssembly();
        const bricks = this._resolveBricks(resolved.brickIds);
        if (!bricks.length) return false;
        if (!this._isolation.isolate(bricks)) return false;
        this._activeAssembly = resolved;
        this._notify();
        return true;
    }

    exitAssembly() {
        if (!this._activeAssembly) return false;
        this._isolation.exitIsolation();
        this._activeAssembly = null;
        this._notify();
        return true;
    }

    isolateAssembly(assembly) {
        const resolved = this._resolveAssembly(assembly);
        const bricks = this._resolveBricks(resolved.brickIds);
        return bricks.length > 0 && this._isolation.isolate(bricks);
    }

    showAll() {
        this._isolation.showAll();
        if (this._activeAssembly) {
            this._activeAssembly = null;
            this._notify();
        }
    }

    async lockAssembly(assembly, { broadcast = true } = {}) {
        const resolved = this._resolveAssembly(assembly);
        this._locked.add(resolved.groupId);
        this._notify();
        if (broadcast && this._collab?.isCollaborating) {
            await this._collab.sendOperation('ASSEMBLY_LOCKED', { assemblyId: resolved.groupId });
        }
        return true;
    }

    async unlockAssembly(assembly, { broadcast = true } = {}) {
        const resolved = this._resolveAssembly(assembly);
        this._locked.delete(resolved.groupId);
        this._notify();
        if (broadcast && this._collab?.isCollaborating) {
            await this._collab.sendOperation('ASSEMBLY_UNLOCKED', { assemblyId: resolved.groupId });
        }
        return true;
    }

    isLocked(assembly) {
        if (!assembly) return false;
        const groupId = assembly.groupId ?? assembly.id;
        return this._locked.has(groupId) || this._locked.has(assembly.id);
    }

    canTransform(brick) {
        if (!brick?.id || !this._groups) return true;
        const group = this._groups.getGroupByBrickId(brick.id);
        if (!group) return true;
        return !this._locked.has(group.id);
    }

    getActiveAssembly() { return this._activeAssembly ? { ...this._activeAssembly, brickIds: [...this._activeAssembly.brickIds] } : null; }
    get isEditing() { return this._activeAssembly !== null; }
    get lockedAssemblyIds() { return [...this._locked]; }

    subscribe(callback) {
        if (typeof callback !== 'function') throw new TypeError('callback muss eine Funktion sein.');
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }

    _notify() {
        const state = { activeAssembly: this.getActiveAssembly(), lockedAssemblyIds: this.lockedAssemblyIds };
        for (const callback of this._listeners) {
            try { callback(state); } catch (error) { console.error('[AssemblyEditingManager] Listener-Fehler:', error); }
        }
    }
}
