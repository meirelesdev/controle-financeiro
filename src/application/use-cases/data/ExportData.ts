import { getDB } from '../../../infrastructure/database/DatabaseHelper'
import { encryptBackup } from '../../../infrastructure/crypto/BackupCrypto'

export interface BackupData {
  version: number
  exportedAt: string
  transactions: unknown[]
  creditCards:  unknown[]
  savings:      unknown[]
}

export async function exportBackupJSON(): Promise<string> {
  const db = await getDB()
  const backup: BackupData = {
    version:      1,
    exportedAt:   new Date().toISOString(),
    transactions: await db.getAll('transactions'),
    creditCards:  await db.getAll('creditCards'),
    savings:      await db.getAll('savings'),
  }
  return JSON.stringify(backup, null, 2)
}

export async function exportBackupEncrypted(password: string): Promise<ArrayBuffer> {
  const json = await exportBackupJSON()
  return encryptBackup(json, password)
}

export function downloadFile(content: string | ArrayBuffer, filename: string): void {
  const blob = typeof content === 'string'
    ? new Blob([content], { type: 'application/json' })
    : new Blob([content], { type: 'application/octet-stream' })

  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
