export class IdbTransactionRepository {
    constructor(db) {
        Object.defineProperty(this, "db", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: db
        });
    }
    async add(t) {
        await this.db.put('transactions', t);
    }
    async update(t) {
        await this.db.put('transactions', t);
    }
    async delete(id) {
        await this.db.delete('transactions', id);
    }
    async getById(id) {
        return this.db.get('transactions', id);
    }
    async getAll() {
        return this.db.getAll('transactions');
    }
    async getByMonth(year, month) {
        const pad = (n) => String(n).padStart(2, '0');
        const from = `${year}-${pad(month)}-01`;
        const to = `${year}-${pad(month)}-31`;
        const range = IDBKeyRange.bound(from, to);
        return this.db.getAllFromIndex('transactions', 'by-date', range);
    }
}
