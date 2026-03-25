const BANK_LOGOS_BY_CODE = {
  VCB: require("../assets/banks/vietcombank.png"),
  BIDV: require("../assets/banks/bidv.png"),
  CTG: require("../assets/banks/viettinbank.png"),
  TCB: require("../assets/banks/techcombank.png"),
  MBB: require("../assets/banks/MB-Bank.png"),
  ACB: require("../assets/banks/acb.png"),
  VPB: require("../assets/banks/vpbank.png"),
  TPB: require("../assets/banks/tpbank.png"),
};

export const REFUND_BANK_OPTIONS = [
  { code: "VCB", name: "Vietcombank", logo: BANK_LOGOS_BY_CODE.VCB },
  { code: "BIDV", name: "BIDV", logo: BANK_LOGOS_BY_CODE.BIDV },
  { code: "CTG", name: "VietinBank", logo: BANK_LOGOS_BY_CODE.CTG },
  { code: "TCB", name: "Techcombank", logo: BANK_LOGOS_BY_CODE.TCB },
  { code: "MBB", name: "MB Bank", logo: BANK_LOGOS_BY_CODE.MBB },
  { code: "ACB", name: "ACB", logo: BANK_LOGOS_BY_CODE.ACB },
  { code: "VPB", name: "VPBank", logo: BANK_LOGOS_BY_CODE.VPB },
  { code: "TPB", name: "TPBank", logo: BANK_LOGOS_BY_CODE.TPB },
  { code: "VIB", name: "VIB", logo: null },
  { code: "STB", name: "Sacombank", logo: null },
  { code: "HDB", name: "HDBank", logo: null },
  { code: "OCB", name: "OCB", logo: null },
  { code: "SHB", name: "SHB", logo: null },
  { code: "MSB", name: "MSB", logo: null },
  { code: "EIB", name: "Eximbank", logo: null },
  { code: "LPB", name: "LPBank", logo: null },
  { code: "SEAB", name: "SeABank", logo: null },
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

export function getRefundBankLogo(bank) {
  if (!bank) return null;
  if (bank.logo) return bank.logo;
  const matched =
    findRefundBankByCode(bank.code) ||
    findRefundBankByName(bank.name);
  return matched?.logo || null;
}

export function normalizeRefundAccountNumber(value = "") {
  return value.toString().replace(/[^\d]/g, "");
}

export function isRefundAccountNumberFormatValid(value = "") {
  return /^\d{8,19}$/.test(normalizeRefundAccountNumber(value));
}
