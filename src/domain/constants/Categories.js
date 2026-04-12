export const INCOME_CATEGORIES = [
    { id: 'clt', label: 'Salário CLT', emoji: '🏢', type: 'income' },
    { id: 'freelancer', label: 'Freelancer', emoji: '💻', type: 'income' },
    { id: 'thirteenth', label: '13º Salário', emoji: '🎁', type: 'income' },
    { id: 'vacation', label: 'Férias', emoji: '🏖️', type: 'income' },
    { id: 'investment', label: 'Rendimento', emoji: '📈', type: 'income' },
    { id: 'other_income', label: 'Outras Entradas', emoji: '💰', type: 'income' },
];
export const EXPENSE_CATEGORIES = [
    { id: 'housing', label: 'Moradia', emoji: '🏠', type: 'expense' },
    { id: 'food', label: 'Alimentação', emoji: '🍔', type: 'expense' },
    { id: 'transport', label: 'Transporte', emoji: '🚗', type: 'expense' },
    { id: 'health', label: 'Saúde', emoji: '🏥', type: 'expense' },
    { id: 'education', label: 'Educação', emoji: '📚', type: 'expense' },
    { id: 'leisure', label: 'Lazer', emoji: '🎬', type: 'expense' },
    { id: 'clothing', label: 'Vestuário', emoji: '👕', type: 'expense' },
    { id: 'subscriptions', label: 'Assinaturas', emoji: '📱', type: 'expense' },
    { id: 'installments', label: 'Parcelas', emoji: '🔄', type: 'expense' },
    { id: 'credit_card', label: 'Fatura Cartão', emoji: '💳', type: 'expense' },
    { id: 'other_expense', label: 'Outras Saídas', emoji: '📦', type: 'expense' },
];
export const TRANSFER_CATEGORY = {
    id: 'transfer', label: 'Transferência', emoji: '↔️', type: 'both',
};
export const ALL_CATEGORIES = [
    ...INCOME_CATEGORIES,
    ...EXPENSE_CATEGORIES,
    TRANSFER_CATEGORY,
];
export function getCategoryById(id) {
    return ALL_CATEGORIES.find(c => c.id === id);
}
export function getCategoriesForType(type) {
    return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}
