const CARD_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6'];
export async function addCreditCard(repo, input) {
    const cards = await repo.getAll();
    const card = {
        id: `card_${Date.now()}`,
        name: input.name,
        limit: input.limit,
        currentBalance: 0,
        closingDay: input.closingDay,
        dueDay: input.dueDay,
        color: input.color ?? CARD_COLORS[cards.length % CARD_COLORS.length],
        createdAt: new Date().toISOString(),
    };
    await repo.add(card);
    return card;
}
export async function updateCreditCard(repo, id, changes) {
    const existing = await repo.getById(id);
    if (!existing)
        throw new Error(`Cartão ${id} não encontrado`);
    const updated = { ...existing, ...changes, id, createdAt: existing.createdAt };
    await repo.update(updated);
    return updated;
}
export async function deleteCreditCard(repo, id) {
    await repo.delete(id);
}
