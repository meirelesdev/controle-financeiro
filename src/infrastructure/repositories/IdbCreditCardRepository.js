export class IdbCreditCardRepository {
    constructor(db) {
        Object.defineProperty(this, "db", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: db
        });
    }
    async add(card) {
        await this.db.put('creditCards', card);
    }
    async update(card) {
        await this.db.put('creditCards', card);
    }
    async delete(id) {
        await this.db.delete('creditCards', id);
    }
    async getById(id) {
        return this.db.get('creditCards', id);
    }
    async getAll() {
        return this.db.getAll('creditCards');
    }
}
