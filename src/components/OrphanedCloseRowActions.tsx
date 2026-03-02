"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function OrphanedCloseRowActions({ id }: { id: string }) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Delete this trade? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.refresh();
    } catch {
      alert("Failed to delete trade");
    }
  };

  return (
    <td className="px-4 py-2 text-right">
      <Link href={`/orphaned-closes/${id}/resolve`} className="mr-2 text-green-400 hover:underline">
        Resolve
      </Link>
      <Link href={`/trades/${id}/edit`} className="mr-2 text-sky-400 hover:underline">
        Edit
      </Link>
      <button type="button" onClick={handleDelete} className="text-red-400 hover:underline">
        Delete
      </button>
    </td>
  );
}
