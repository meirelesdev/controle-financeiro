export async function addTransaction(repo, input) {
    const now = new Date().toISOString();
    const transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: input.type,
        status: input.status,
        amount: input.amount,
        description: input.description,
        category: input.category,
        date: input.date,
        paymentMethod: input.paymentMethod,
        cardId: input.cardId,
        createdAt: now,
        updatedAt: now,
    };
    await repo.add(transaction);
    return transaction;
}
