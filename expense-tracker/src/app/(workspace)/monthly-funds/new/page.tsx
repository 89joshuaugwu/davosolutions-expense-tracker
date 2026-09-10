import { NewFundForm } from "@/components/monthly-funds/new-fund-form";

export const metadata = {
  title: "New Monthly Fund | Davo Solutions",
};

export default function NewMonthlyFundPage() {
  return (
    <div className="max-w-6xl mx-auto py-8">
      <NewFundForm />
    </div>
  );
}
