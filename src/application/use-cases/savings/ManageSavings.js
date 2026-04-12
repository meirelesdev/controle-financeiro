import { addTransaction } from '../transactions/AddTransaction';
const SAVINGS_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#EF4444', '#6366F1'];
export async function addSavings(repo, input) {
    const all = await repo.getAll();
    const savings = {
        id: `sav_${Date.now()}`,
        name: input.name,
        balance: input.balance ?? 0,
        type: input.type,
        color: input.color ?? SAVINGS_COLORS[all.length % SAVINGS_COLORS.length],
        updatedAt: new Date().toISOString(),
    };
    await repo.add(savings);
    return savings;
}
export async function updateSavingsBalance(repo, id, delta) {
    const existing = await repo.getById(id);
    if (!existing)
        throw new Error(`Cofrinho ${id} não encontrado`);
    const updated = {
        ...existing,
        balance: existing.balance + delta,
        updatedAt: new Date().toISOString(),
    };
    await repo.update(updated);
    return updated;
}
export async function deleteSavings(repo, id) {
    await repo.delete(id);
}
/** Transfere valor entre dois cofrinhos e registra transações internas. */
export async function transferBetweenSavings(savingsRepo, txRepo, fromId, toId, amount, description) {
    const from = await savingsRepo.getById(fromId);
    const to = await savingsRepo.getById(toId);
    if (!from)
        throw new Error(`Cofrinho de origem ${fromId} não encontrado`);
    if (!to)
        throw new Error(`Cofrinho de destino ${toId} não encontrado`);
    if (from.balance < amount)
        throw new Error('Saldo insuficiente no cofrinho de origem');
    const today = new Date().toISOString().slice(0, 10);
    await addTransaction(txRepo, {
        type: 'transfer', status: 'confirmado',
        amount, description: `Saída: ${description}`,
        category: 'transfer', date: today,
        paymentMethod: 'cash',
    });
    await addTransaction(txRepo, {
        type: 'transfer', status: 'confirmado',
        amount, description: `Entrada: ${description}`,
        category: 'transfer', date: today,
        paymentMethod: 'cash',
    });
    await updateSavingsBalance(savingsRepo, fromId, -amount);
    await updateSavingsBalance(savingsRepo, toId, +amount);
}
