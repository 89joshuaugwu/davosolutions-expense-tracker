import { BillList } from "@/components/bills/bill-list";

export const metadata = {
  title: "Bills | Davo Solutions",
};

export default function BillsPage() {
  return (
    <div className="max-w-6xl mx-auto py-8">
      <BillList />
    </div>
  );
}
