const LENS_TYPE_ADD_REQUIRED = new Set(["progressive", "bifocal", "multifocal"]);

export const LENS_PRESCRIPTION_METHODS = Object.freeze({
  SAVED: "saved",
  MANUAL: "manual",
  UPLOAD: "upload",
});

export const EMPTY_LENS_EYE = Object.freeze({
  sphere: "",
  cyl: "",
  axis: "",
  add: "",
});

export const EMPTY_LENS_DRAFT = Object.freeze({
  rightEye: EMPTY_LENS_EYE,
  leftEye: EMPTY_LENS_EYE,
  pd: "",
  note: "",
  attachmentUrls: [],
});

function toText(value) {
  if (value == null) return "";
  return String(value).trim();
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildEyeSummary(prefix, eye = {}) {
  const parts = [`${prefix}: SPH ${toText(eye?.sphere) || "--"}`];

  if (toText(eye?.cyl) || toText(eye?.axis)) {
    parts.push(`CYL ${toText(eye?.cyl) || "--"}`);
    parts.push(`AXIS ${toText(eye?.axis) || "--"}`);
  }

  if (toText(eye?.add)) {
    parts.push(`ADD ${toText(eye?.add)}`);
  }

  return parts.join(" / ");
}

export function normalizeLensEye(eye = {}) {
  return {
    sphere: toText(eye?.sphere ?? eye?.SPH),
    cyl: toText(eye?.cyl ?? eye?.CYL),
    axis: toText(eye?.axis ?? eye?.AXIS),
    add: toText(eye?.add ?? eye?.ADD),
  };
}

export function createEmptyLensDraft() {
  return {
    rightEye: { ...EMPTY_LENS_EYE },
    leftEye: { ...EMPTY_LENS_EYE },
    pd: "",
    note: "",
    attachmentUrls: [],
  };
}

export function normalizeLensPrescriptionDraft(input = {}) {
  return {
    rightEye: normalizeLensEye(input?.rightEye),
    leftEye: normalizeLensEye(input?.leftEye),
    pd: toText(input?.pd),
    note: toText(input?.note),
    attachmentUrls: Array.isArray(input?.attachmentUrls)
      ? input.attachmentUrls.map((item) => toText(item)).filter(Boolean)
      : [],
  };
}

export function normalizeSavedPrescription(input = {}) {
  return {
    _id: toText(input?._id || input?.id),
    name: toText(input?.name),
    isDefault: Boolean(input?.isDefault),
    rightEye: normalizeLensEye(input?.rightEye),
    leftEye: normalizeLensEye(input?.leftEye),
    pd: toText(input?.pd),
    note: toText(input?.note),
  };
}

export function applySavedPrescriptionToDraft(prescription, baseDraft = {}) {
  const saved = normalizeSavedPrescription(prescription);
  const base = normalizeLensPrescriptionDraft(baseDraft);

  return {
    ...base,
    rightEye: saved.rightEye,
    leftEye: saved.leftEye,
    pd: saved.pd,
    note: saved.note || base.note,
    attachmentUrls: [],
  };
}

export function inferLensPrescriptionMethod(prescription = {}, fallbackMethod) {
  const mode = toText(prescription?.mode).toLowerCase();
  const hasAttachment = Array.isArray(prescription?.attachmentUrls)
    ? prescription.attachmentUrls.some(Boolean)
    : false;

  if (mode === "upload" || mode === "attachment" || hasAttachment) {
    return LENS_PRESCRIPTION_METHODS.UPLOAD;
  }

  if (fallbackMethod === LENS_PRESCRIPTION_METHODS.SAVED) {
    return LENS_PRESCRIPTION_METHODS.SAVED;
  }

  return LENS_PRESCRIPTION_METHODS.MANUAL;
}

export function normalizeLensPrescriptionFromPayload(
  prescription = {},
  { fallbackMethod } = {},
) {
  const method = inferLensPrescriptionMethod(prescription, fallbackMethod);
  return {
    method,
    draft: normalizeLensPrescriptionDraft(prescription),
  };
}

export function lensTypeRequiresAdd(lensType) {
  return LENS_TYPE_ADD_REQUIRED.has(toText(lensType).toLowerCase());
}

export function getLensPrescriptionRange(product) {
  return product?.specs?.lens?.prescriptionRange || {};
}

function pushFieldError(fieldErrors, key, message) {
  if (!fieldErrors[key]) {
    fieldErrors[key] = message;
  }
}

function checkRange(warnings, fieldErrors, key, label, value, min, max) {
  const parsed = toNumber(value);
  if (parsed == null) return;

  const hasMin = Number.isFinite(Number(min));
  const hasMax = Number.isFinite(Number(max));
  if (!hasMin && !hasMax) return;

  const belowMin = hasMin && parsed < Number(min);
  const aboveMax = hasMax && parsed > Number(max);
  if (!belowMin && !aboveMax) return;

  const message = `${label} ngoài khoảng hỗ trợ của tròng hiện tại.`;
  warnings.push(message);
  pushFieldError(fieldErrors, key, message);
}

export function validateLensPrescriptionDraft({
  method = LENS_PRESCRIPTION_METHODS.MANUAL,
  draft = {},
  product = null,
} = {}) {
  const normalizedMethod = method || LENS_PRESCRIPTION_METHODS.MANUAL;
  const normalizedDraft = normalizeLensPrescriptionDraft(draft);
  const fieldErrors = {};
  const errors = [];
  const warnings = [];

  if (normalizedMethod === LENS_PRESCRIPTION_METHODS.UPLOAD) {
    if (!normalizedDraft.attachmentUrls.length) {
      errors.push("Vui lòng tải ảnh đơn kính.");
      pushFieldError(fieldErrors, "attachmentUrls", "Vui lòng tải ảnh đơn kính.");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fieldErrors,
      draft: normalizedDraft,
    };
  }

  ["rightEye", "leftEye"].forEach((eyeKey) => {
    const eye = normalizedDraft[eyeKey];
    const prefix = eyeKey === "rightEye" ? "OD" : "OS";

    if (!toText(eye?.sphere)) {
      pushFieldError(fieldErrors, `${eyeKey}.sphere`, `Vui lòng nhập SPH cho mắt ${prefix}.`);
    }

    const hasCyl = Boolean(toText(eye?.cyl));
    const hasAxis = Boolean(toText(eye?.axis));
    if (hasCyl !== hasAxis) {
      const message = `CYL và AXIS của mắt ${prefix} phải nhập cùng nhau hoặc cùng để trống.`;
      pushFieldError(fieldErrors, `${eyeKey}.cyl`, message);
      pushFieldError(fieldErrors, `${eyeKey}.axis`, message);
    }
  });

  if (!toText(normalizedDraft.pd)) {
    pushFieldError(fieldErrors, "pd", "Vui lòng nhập PD.");
  }

  if (lensTypeRequiresAdd(product?.specs?.lens?.lensType)) {
    if (!toText(normalizedDraft?.rightEye?.add)) {
      pushFieldError(fieldErrors, "rightEye.add", "Vui lòng nhập ADD cho mắt OD.");
    }
    if (!toText(normalizedDraft?.leftEye?.add)) {
      pushFieldError(fieldErrors, "leftEye.add", "Vui lòng nhập ADD cho mắt OS.");
    }
  }

  const range = getLensPrescriptionRange(product);
  checkRange(
    warnings,
    fieldErrors,
    "rightEye.sphere",
    "SPH OD",
    normalizedDraft?.rightEye?.sphere,
    range?.sphMin,
    range?.sphMax,
  );
  checkRange(
    warnings,
    fieldErrors,
    "leftEye.sphere",
    "SPH OS",
    normalizedDraft?.leftEye?.sphere,
    range?.sphMin,
    range?.sphMax,
  );
  checkRange(
    warnings,
    fieldErrors,
    "rightEye.cyl",
    "CYL OD",
    normalizedDraft?.rightEye?.cyl,
    range?.cylMin,
    range?.cylMax,
  );
  checkRange(
    warnings,
    fieldErrors,
    "leftEye.cyl",
    "CYL OS",
    normalizedDraft?.leftEye?.cyl,
    range?.cylMin,
    range?.cylMax,
  );
  checkRange(
    warnings,
    fieldErrors,
    "rightEye.axis",
    "AXIS OD",
    normalizedDraft?.rightEye?.axis,
    range?.axisMin,
    range?.axisMax,
  );
  checkRange(
    warnings,
    fieldErrors,
    "leftEye.axis",
    "AXIS OS",
    normalizedDraft?.leftEye?.axis,
    range?.axisMin,
    range?.axisMax,
  );
  checkRange(
    warnings,
    fieldErrors,
    "rightEye.add",
    "ADD OD",
    normalizedDraft?.rightEye?.add,
    range?.addMin,
    range?.addMax,
  );
  checkRange(
    warnings,
    fieldErrors,
    "leftEye.add",
    "ADD OS",
    normalizedDraft?.leftEye?.add,
    range?.addMin,
    range?.addMax,
  );

  Object.values(fieldErrors).forEach((message) => {
    if (!warnings.includes(message)) {
      errors.push(message);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fieldErrors,
    draft: normalizedDraft,
  };
}

export function buildLensPrescriptionPayload({
  method = LENS_PRESCRIPTION_METHODS.MANUAL,
  draft = {},
} = {}) {
  const normalizedDraft = normalizeLensPrescriptionDraft(draft);

  if (method === LENS_PRESCRIPTION_METHODS.UPLOAD) {
    return {
      mode: normalizedDraft.attachmentUrls.length ? "upload" : "none",
      isMyopic: true,
      rightEye: normalizeLensEye(),
      leftEye: normalizeLensEye(),
      pd: "",
      note: normalizedDraft.note,
      attachmentUrls: normalizedDraft.attachmentUrls,
    };
  }

  return {
    mode: "manual",
    isMyopic: true,
    rightEye: normalizedDraft.rightEye,
    leftEye: normalizedDraft.leftEye,
    pd: normalizedDraft.pd,
    note: normalizedDraft.note,
    attachmentUrls: [],
  };
}

export function summarizeLensPrescription(prescription = {}) {
  const method = inferLensPrescriptionMethod(prescription);
  const draft = normalizeLensPrescriptionDraft(prescription);

  if (method === LENS_PRESCRIPTION_METHODS.UPLOAD) {
    return {
      method,
      shortLabel: draft.attachmentUrls.length
        ? "Đã tải ảnh đơn kính"
        : "Chưa tải ảnh đơn kính",
      lines: draft.attachmentUrls.length
        ? ["Ảnh đơn kính đã được đính kèm."]
        : [],
    };
  }

  const lines = [
    buildEyeSummary("OD", draft.rightEye),
    buildEyeSummary("OS", draft.leftEye),
    `PD: ${draft.pd || "--"}`,
  ];

  if (draft.note) {
    lines.push(`Ghi chú: ${draft.note}`);
  }

  return {
    method,
    shortLabel: "Đã nhập thông số tròng",
    lines,
  };
}
