"use client";

import { useState, useEffect } from "react";
import {
  type DatePresetKey,
  type DateRange,
  getPresetRange,
  getPresetLabel,
  getPresetDescription,
  formatDateRange,
} from "@/lib/earnings-filters";

type PresetOnly = Exclude<DatePresetKey, "range">;

const PRESETS: PresetOnly[] = ["last7", "last30", "thisMonth", "lastMonth", "thisYear", "lastYear"];

interface TimeFilterModalProps {
  open: boolean;
  value: DateRange | null;
  onClose: () => void;
  onApply: (range: DateRange | null) => void;
}

function TimeFilterModalContent({
  preset,
  setPreset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  effectiveRange,
  handleSelectPreset,
  handleClear,
  handleApply,
  onClose,
}: {
  preset: DatePresetKey;
  setPreset: (p: DatePresetKey) => void;
  customStart: string;
  setCustomStart: (s: string) => void;
  customEnd: string;
  setCustomEnd: (s: string) => void;
  effectiveRange: DateRange | null;
  handleSelectPreset: (p: DatePresetKey) => void;
  handleClear: () => void;
  handleApply: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 z-40 bg-black/50"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-filter-title"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
      >
        <div className="flex">
          <div className="w-48 border-r border-slate-700 py-2">
            <p id="time-filter-title" className="px-3 py-1.5 text-xs font-medium uppercase text-slate-500">
              Last
            </p>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={
                  preset === p
                    ? "block w-full px-3 py-2 text-left text-sm bg-sky-900/40 text-sky-200"
                    : "block w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800"
                }
              >
                {getPresetLabel(p)}
              </button>
            ))}
            <p className="px-3 py-1.5 text-xs font-medium uppercase text-slate-500">Range</p>
            <button
              type="button"
              onClick={() => handleSelectPreset("range")}
              className={
                preset === "range"
                  ? "block w-full px-3 py-2 text-left text-sm bg-sky-900/40 text-sky-200"
                  : "block w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800"
              }
            >
              Custom range
            </button>
          </div>
          <div className="flex-1 p-5">
            {preset === "range" ? (
              <div className="space-y-3">
                <label className="block text-sm text-slate-400">
                  Start date
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="ml-2 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-white"
                  />
                </label>
                <label className="block text-sm text-slate-400">
                  End date
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="ml-2 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-white"
                  />
                </label>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium text-white">
                  {effectiveRange ? formatDateRange(effectiveRange) : "Select a preset"}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {effectiveRange ? getPresetDescription(preset, effectiveRange) : "—"}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-5 py-3">
          <button
            type="button"
            onClick={handleClear}
            className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={preset === "range" && !(customStart && customEnd)}
            className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export function TimeFilterModal({ open, value, onClose, onApply }: TimeFilterModalProps) {
  const [preset, setPreset] = useState<DatePresetKey>("thisYear");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [currentRange, setCurrentRange] = useState<DateRange | null>(value);

  useEffect(() => {
    if (!open) return;
    setCurrentRange(value);
    if (value) {
      setCustomStart(value.start);
      setCustomEnd(value.end);
    }
  }, [open, value]);

  const effectiveRange =
    preset === "range"
      ? customStart && customEnd
        ? { start: customStart, end: customEnd }
        : null
      : getPresetRange(preset) ?? null;

  const handleSelectPreset = (p: DatePresetKey) => {
    setPreset(p);
    if (p !== "range") {
      const r = getPresetRange(p);
      setCurrentRange(r);
    } else {
      setCurrentRange(customStart && customEnd ? { start: customStart, end: customEnd } : null);
    }
  };

  const handleClear = () => {
    setPreset("thisYear");
    setCurrentRange(null);
    onApply(null);
    onClose();
  };

  const handleApply = () => {
    onApply(effectiveRange);
    onClose();
  };

  if (!open) return null;

  return (
    <TimeFilterModalContent
      preset={preset}
      setPreset={setPreset}
      customStart={customStart}
      setCustomStart={setCustomStart}
      customEnd={customEnd}
      setCustomEnd={setCustomEnd}
      effectiveRange={effectiveRange}
      handleSelectPreset={handleSelectPreset}
      handleClear={handleClear}
      handleApply={handleApply}
      onClose={onClose}
    />
  );
}
