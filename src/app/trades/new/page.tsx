import { TradeForm } from "@/components/TradeForm";

export default function NewTradePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Add trade</h1>
        <p className="mt-1 text-slate-400">Log an options trade manually.</p>
      </div>
      <TradeForm />
    </div>
  );
}
