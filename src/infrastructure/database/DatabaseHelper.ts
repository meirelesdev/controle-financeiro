import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Transaction } from '../../domain/entities/Transaction'
import type { CreditCard }  from '../../domain/entities/CreditCard'
import type { Savings }     from '../../domain/entities/Savings'
import type { Account }     from '../../domain/entities/Account'

interface CfpDB extends DBSchema {
  transactions: {
    key: string
    value: Transaction
    indexes: {
      'by-date':    string
      'by-type':    string
      'by-status':  string
      'by-account': string
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
  accounts: {
    key: string
    value: Account
  }
  settings: {
    key: string
    value: { key: string; value: unknown }
  }
}

const DB_NAME    = 'controle-financeiro'
const DB_VERSION = 2

let dbInstance: IDBPDatabase<CfpDB> | null = null

export async function getDB(): Promise<IDBPDatabase<CfpDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<CfpDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
        txStore.createIndex('by-date',   'date')
        txStore.createIndex('by-type',   'type')
        txStore.createIndex('by-status', 'status')
        txStore.createIndex('by-account', 'accountId')

        db.createObjectStore('creditCards', { keyPath: 'id' })
        db.createObjectStore('savings',     { keyPath: 'id' })
        db.createObjectStore('settings',    { keyPath: 'key' })
        db.createObjectStore('accounts',    { keyPath: 'id' })
      }
      if (oldVersion === 1) {
        // Migração v1 → v2: adicionar store accounts e índice by-account nas transações
        db.createObjectStore('accounts', { keyPath: 'id' })

        const txStore = transaction.objectStore('transactions')
        if (!txStore.indexNames.contains('by-account')) {
          txStore.createIndex('by-account', 'accountId')
        }
      }
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
