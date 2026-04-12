export async function listTransactions(repo, filter) {
    let transactions = await repo.getByMonth(filter.year, filter.month);
    if (filter.type)
        transactions = transactions.filter(t => t.type === filter.type);
    if (filter.status)
        transactions = transactions.filter(t => t.status === filter.status);
    if (filter.category)
        transactions = transactions.filter(t => t.category === filter.category);
    return transactions.sort((a, b) => b.date.localeCompare(a.date));
}
