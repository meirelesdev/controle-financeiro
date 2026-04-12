export async function deleteTransaction(repo, id) {
    await repo.delete(id);
}
