export class IdbSavingsRepository {
    constructor(db) {
        Object.defineProperty(this, "db", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: db
        });
    }
    async add(s) {
        await this.db.put('savings', s);
    }
    async update(s) {
        await this.db.put('savings', s);
    }
    async delete(id) {
        await this.db.delete('savings', id);
    }
    async getById(id) {
        return this.db.get('savings', id);
    }
    async getAll() {
        return this.db.getAll('savings');
    }
}
