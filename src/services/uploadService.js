import { api } from "./apiClient";

function pickUploadData(response) {
  return response?.data?.data ?? response?.data ?? null;
}

function normalizeMimeType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.startsWith("image/")) return raw;
  return "image/jpeg";
}

export async function uploadFileApi(file, options = {}) {
  if (!file?.uri) {
    throw new Error("Missing file uri");
  }

  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name || `upload-${Date.now()}.jpg`,
    type: normalizeMimeType(file.type),
  });

  if (options.folder) {
    formData.append("folder", String(options.folder).trim());
  }

  const response = await api.post("/api/uploads", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  const payload = pickUploadData(response);
  if (!payload?.url) {
    throw new Error("Upload response is missing file URL");
  }

  return payload;
}
