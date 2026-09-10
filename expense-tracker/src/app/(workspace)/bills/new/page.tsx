import { NewBillForm } from "@/components/bills/new-bill-form";

export const metadata = {
  title: "New Bill | Davo Solutions",
};

export default function NewBillPage() {
  return (
    <div className="max-w-6xl mx-auto py-8">
      <NewBillForm />
    </div>
  );
}
