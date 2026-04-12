import { openDB } from 'idb';
const DB_NAME = 'controle-financeiro';
const DB_VERSION = 1;
let dbInstance = null;
export async function getDB() {
    if (dbInstance)
        return dbInstance;
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
            if (oldVersion < 1) {
                const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
                txStore.createIndex('by-date', 'date');
                txStore.createIndex('by-type', 'type');
                txStore.createIndex('by-status', 'status');
                db.createObjectStore('creditCards', { keyPath: 'id' });
                db.createObjectStore('savings', { keyPath: 'id' });
                db.createObjectStore('settings', { keyPath: 'key' });
            }
            // Adicionar blocos `if (oldVersion < N)` para migrações futuras
        },
        blocked() {
            console.warn('IndexedDB blocked — feche outras abas do app');
        },
        blocking() {
            dbInstance?.close();
            dbInstance = null;
        },
    });
    return dbInstance;
}
