import { CsvImport } from "@/components/CsvImport";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Import CSV</h1>
        <p className="mt-1 text-slate-400">
          Upload brokerage activity (Fidelity or Robinhood). Map columns once we have your export format.
        </p>
      </div>
      <CsvImport />
    </div>
  );
}
