export async function updateTransaction(repo, id, changes) {
    const existing = await repo.getById(id);
    if (!existing)
        throw new Error(`Transação ${id} não encontrada`);
    const updated = {
        ...existing,
        ...changes,
        id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
    };
    await repo.update(updated);
    return updated;
}
