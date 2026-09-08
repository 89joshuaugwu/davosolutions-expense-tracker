import { requireUser } from "@/lib/auth/session";
import { getActiveCategories } from "@/lib/server/repositories/categories";
import { getOrCreateDefaultSettings } from "@/lib/server/repositories/settings";
import { NewExpenseForm } from "@/components/expenses/new-expense-form";
import type { CurrencyCode } from "@/domain/money";

export default async function NewExpensePage() {
  const user = await requireUser();
  const [categories, settings] = await Promise.all([getActiveCategories(), getOrCreateDefaultSettings()]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Record an expense</h1>
          <p>All fields marked * are required. Amounts are computed and verified by the server.</p>
        </div>
      </div>
      <NewExpenseForm
        categories={categories}
        baseCurrency={settings.baseCurrency}
        enabledCurrencies={settings.enabledCurrencies as CurrencyCode[]}
        userRole={user.role}
      />
    </>
  );
}
