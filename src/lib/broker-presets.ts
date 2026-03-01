/**
 * Column mapping: CSV header name -> our field name.
 * Add exact Fidelity/Robinhood column names when you have sample exports.
 */
export type OurField =
  | "ticker"
  | "optionType"
  | "strike"
  | "expiry"
  | "action"
  | "quantity"
  | "pricePerContract"
  | "tradeDate"
  | "notes";

export interface BrokerPreset {
  id: string;
  name: string;
  /** CSV column header -> our field */
  columnMap: Record<string, OurField>;
  /** Date format in CSV, e.g. MM/DD/YYYY or YYYY-MM-DD */
  dateFormat?: "MM/DD/YYYY" | "YYYY-MM-DD";
}

export const BROKER_PRESETS: BrokerPreset[] = [
  {
    id: "fidelity",
    name: "Fidelity",
    columnMap: {},
    dateFormat: "MM/DD/YYYY",
  },
  {
    id: "robinhood",
    name: "Robinhood",
    columnMap: {},
    dateFormat: "MM/DD/YYYY",
  },
  {
    id: "custom",
    name: "Custom (map columns yourself)",
    columnMap: {},
    dateFormat: "MM/DD/YYYY",
  },
];
