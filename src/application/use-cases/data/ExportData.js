import { getDB } from '../../../infrastructure/database/DatabaseHelper';
import { encryptBackup } from '../../../infrastructure/crypto/BackupCrypto';
export async function exportBackupJSON() {
    const db = await getDB();
    const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        transactions: await db.getAll('transactions'),
        creditCards: await db.getAll('creditCards'),
        savings: await db.getAll('savings'),
    };
    return JSON.stringify(backup, null, 2);
}
export async function exportBackupEncrypted(password) {
    const json = await exportBackupJSON();
    return encryptBackup(json, password);
}
export function downloadFile(content, filename) {
    const blob = typeof content === 'string'
        ? new Blob([content], { type: 'application/json' })
        : new Blob([content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
