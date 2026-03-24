export const REFUND_BANK_OPTIONS = [
  { code: "VCB", name: "Vietcombank" },
  { code: "BIDV", name: "BIDV" },
  { code: "CTG", name: "VietinBank" },
  { code: "TCB", name: "Techcombank" },
  { code: "MBB", name: "MB Bank" },
  { code: "ACB", name: "ACB" },
  { code: "VPB", name: "VPBank" },
  { code: "TPB", name: "TPBank" },
  { code: "VIB", name: "VIB" },
  { code: "STB", name: "Sacombank" },
  { code: "HDB", name: "HDBank" },
  { code: "OCB", name: "OCB" },
  { code: "SHB", name: "SHB" },
  { code: "MSB", name: "MSB" },
  { code: "EIB", name: "Eximbank" },
  { code: "LPB", name: "LPBank" },
  { code: "SEAB", name: "SeABank" },
];

function normalizeLookupText(value = "") {
  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findRefundBankByCode(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) return null;
  return REFUND_BANK_OPTIONS.find((bank) => bank.code === normalizedCode) || null;
}

export function findRefundBankByName(name) {
  const normalizedName = normalizeLookupText(name);
  if (!normalizedName) return null;
  return (
    REFUND_BANK_OPTIONS.find(
      (bank) => normalizeLookupText(bank.name) === normalizedName,
    ) || null
  );
}

export function normalizeRefundAccountNumber(value = "") {
  return value.toString().replace(/[^\d]/g, "");
}

export function isRefundAccountNumberFormatValid(value = "") {
  return /^\d{8,19}$/.test(normalizeRefundAccountNumber(value));
}
