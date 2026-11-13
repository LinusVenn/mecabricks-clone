const DEFAULT_DB_NAME = 'mecabricks-component-templates';
const DEFAULT_STORE_NAME = 'templates';
const FALLBACK_KEY = 'mecabricks-component-templates-v1';

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB-Anfrage fehlgeschlagen.'));
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB-Transaktion fehlgeschlagen.'));
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB-Transaktion abgebrochen.'));
    });
}

/**
 * Projektunabhängige Speicherung der Vorlagen.
 * IndexedDB ist der Primärspeicher. Falls IndexedDB nicht verfügbar ist,
 * wird localStorage verwendet. Projektdateien und ProjectStorage werden
 * bewusst nicht verändert.
 */
export class ComponentStorage {
    constructor({ dbName = DEFAULT_DB_NAME, storeName = DEFAULT_STORE_NAME } = {}) {
        this.dbName = dbName;
        this.storeName = storeName;
        this._dbPromise = null;
    }

    async _openDatabase() {
        if (typeof indexedDB === 'undefined') return null;
        if (this._dbPromise) return this._dbPromise;

        this._dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('category', 'category', { unique: false });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Die Vorlagen-Datenbank konnte nicht geöffnet werden.'));
            request.onblocked = () => reject(new Error('Die Vorlagen-Datenbank ist durch einen anderen Tab blockiert.'));
        }).catch(() => {
            // IndexedDB kann z. B. im privaten Modus oder bei blockierten
            // Browserberechtigungen ausfallen. Dann localStorage verwenden.
            this._dbPromise = null;
            return null;
        });

        return this._dbPromise;
    }

    _readFallback() {
        if (typeof localStorage === 'undefined') return [];
        try {
            const parsed = JSON.parse(localStorage.getItem(FALLBACK_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    _writeFallback(items) {
        if (typeof localStorage === 'undefined') {
            throw new Error('Weder IndexedDB noch localStorage sind verfügbar.');
        }
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(items));
    }

    async getAll() {
        const db = await this._openDatabase();
        if (!db) return clone(this._readFallback());
        const tx = db.transaction(this.storeName, 'readonly');
        const result = await requestToPromise(tx.objectStore(this.storeName).getAll());
        await transactionDone(tx);
        return clone(result || []);
    }

    async get(id) {
        if (!id) return null;
        const db = await this._openDatabase();
        if (!db) return clone(this._readFallback().find(item => item.id === id) || null);
        const tx = db.transaction(this.storeName, 'readonly');
        const result = await requestToPromise(tx.objectStore(this.storeName).get(id));
        await transactionDone(tx);
        return clone(result || null);
    }

    async put(template) {
        if (!template?.id) throw new Error('Eine Vorlage benötigt eine eindeutige ID.');
        const value = clone(template);
        const db = await this._openDatabase();
        if (!db) {
            const items = this._readFallback();
            const index = items.findIndex(item => item.id === value.id);
            if (index >= 0) items[index] = value;
            else items.push(value);
            this._writeFallback(items);
            return clone(value);
        }
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(value);
        await transactionDone(tx);
        return clone(value);
    }

    async delete(id) {
        if (!id) return false;
        const db = await this._openDatabase();
        if (!db) {
            const items = this._readFallback();
            const next = items.filter(item => item.id !== id);
            this._writeFallback(next);
            return next.length !== items.length;
        }
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const existed = await requestToPromise(store.getKey(id));
        store.delete(id);
        await transactionDone(tx);
        return existed !== undefined;
    }

    async clear() {
        const db = await this._openDatabase();
        if (!db) {
            this._writeFallback([]);
            return;
        }
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).clear();
        await transactionDone(tx);
    }

    close() {
        if (!this._dbPromise) return;
        this._dbPromise.then(db => db?.close()).catch(() => {});
        this._dbPromise = null;
    }
}
