import { api } from "./apiClient";

function pickUploadData(response) {
  return response?.data?.data ?? response?.data ?? null;
}

function getFileExtension(value) {
  const source = String(value || "").trim().toLowerCase().split("?")[0].split("#")[0];
  const dotIndex = source.lastIndexOf(".");
  return dotIndex >= 0 ? source.slice(dotIndex) : "";
}

function normalizeMimeType(value, name = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (
    raw.startsWith("image/") ||
    raw.startsWith("video/") ||
    raw.startsWith("model/")
  ) {
    return raw;
  }

  switch (getFileExtension(name)) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".m4v":
      return "video/x-m4v";
    case ".glb":
      return "model/gltf-binary";
    case ".gltf":
      return "model/gltf+json";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

export async function uploadFileApi(file, options = {}) {
  if (!file?.uri) {
    throw new Error("Missing file uri");
  }

  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name || `upload-${Date.now()}.jpg`,
    type: normalizeMimeType(file.type, file.name),
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
