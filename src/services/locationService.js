import { api } from "./apiClient";

function pickData(res) {
  return res?.data?.data ?? res?.data ?? null;
}

const provinceCache = {
  value: null,
  promise: null,
};

const districtCache = new Map();
const wardCache = new Map();

function normalizeProvince(item = {}) {
  return {
    id: String(item.id ?? ""),
    name: String(item.name ?? "").trim(),
    code: String(item.code ?? "").trim(),
  };
}

function normalizeDistrict(item = {}) {
  return {
    id: String(item.id ?? ""),
    provinceId: String(item.provinceId ?? ""),
    name: String(item.name ?? "").trim(),
    code: String(item.code ?? "").trim(),
    type: String(item.type ?? "").trim(),
  };
}

function normalizeWard(item = {}) {
  return {
    code: String(item.code ?? "").trim(),
    districtId: String(item.districtId ?? ""),
    name: String(item.name ?? "").trim(),
  };
}

export async function getProvincesApi({ force = false } = {}) {
  if (!force && Array.isArray(provinceCache.value)) {
    return provinceCache.value;
  }

  if (!force && provinceCache.promise) {
    return provinceCache.promise;
  }

  provinceCache.promise = api
    .get("/api/locations/provinces")
    .then((res) => {
      const rows = Array.isArray(pickData(res)) ? pickData(res) : [];
      const normalized = rows
        .map(normalizeProvince)
        .filter((item) => item.id && item.name);
      provinceCache.value = normalized;
      return normalized;
    })
    .finally(() => {
      provinceCache.promise = null;
    });

  return provinceCache.promise;
}

export async function getDistrictsApi(provinceId, { force = false } = {}) {
  const key = String(provinceId || "").trim();
  if (!key) return [];

  const cached = districtCache.get(key);
  if (!force && Array.isArray(cached?.value)) {
    return cached.value;
  }

  if (!force && cached?.promise) {
    return cached.promise;
  }

  const promise = api
    .get("/api/locations/districts", {
      params: { provinceId: key },
    })
    .then((res) => {
      const rows = Array.isArray(pickData(res)) ? pickData(res) : [];
      const normalized = rows
        .map(normalizeDistrict)
        .filter((item) => item.id && item.name);
      districtCache.set(key, { value: normalized, promise: null });
      return normalized;
    })
    .finally(() => {
      const current = districtCache.get(key) || {};
      districtCache.set(key, { ...current, promise: null });
    });

  districtCache.set(key, { value: null, promise });
  return promise;
}

export async function getWardsApi(districtId, { force = false } = {}) {
  const key = String(districtId || "").trim();
  if (!key) return [];

  const cached = wardCache.get(key);
  if (!force && Array.isArray(cached?.value)) {
    return cached.value;
  }

  if (!force && cached?.promise) {
    return cached.promise;
  }

  const promise = api
    .get("/api/locations/wards", {
      params: { districtId: key },
    })
    .then((res) => {
      const rows = Array.isArray(pickData(res)) ? pickData(res) : [];
      const normalized = rows
        .map(normalizeWard)
        .filter((item) => item.code && item.name);
      wardCache.set(key, { value: normalized, promise: null });
      return normalized;
    })
    .finally(() => {
      const current = wardCache.get(key) || {};
      wardCache.set(key, { ...current, promise: null });
    });

  wardCache.set(key, { value: null, promise });
  return promise;
}
