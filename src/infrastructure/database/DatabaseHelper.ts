import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Transaction } from '../../domain/entities/Transaction'
import type { CreditCard } from '../../domain/entities/CreditCard'
import type { Savings } from '../../domain/entities/Savings'

interface CfpDB extends DBSchema {
  transactions: {
    key: string
    value: Transaction
    indexes: {
      'by-date':   string
      'by-type':   string
      'by-status': string
    }
  }
  creditCards: {
    key: string
    value: CreditCard
  }
  savings: {
    key: string
    value: Savings
  }
  settings: {
    key: string
    value: { key: string; value: unknown }
  }
}

const DB_NAME    = 'controle-financeiro'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<CfpDB> | null = null

export async function getDB(): Promise<IDBPDatabase<CfpDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<CfpDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
        txStore.createIndex('by-date',   'date')
        txStore.createIndex('by-type',   'type')
        txStore.createIndex('by-status', 'status')

        db.createObjectStore('creditCards', { keyPath: 'id' })
        db.createObjectStore('savings',     { keyPath: 'id' })
        db.createObjectStore('settings',    { keyPath: 'key' })
      }
      // Adicionar blocos `if (oldVersion < N)` para migrações futuras
    },
    blocked() {
      console.warn('IndexedDB blocked — feche outras abas do app')
    },
    blocking() {
      dbInstance?.close()
      dbInstance = null
    },
  })

  return dbInstance
}

export type { CfpDB }
