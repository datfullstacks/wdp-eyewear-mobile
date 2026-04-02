import * as ImagePicker from "expo-image-picker";
import { uploadFileApi } from "./uploadService";

export const SUPPORT_ATTACHMENT_MAX_ITEMS = 6;

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const AFTER_SALES_EVIDENCE_REQUIRED_CATEGORIES = new Set([
  "order",
  "refund",
  "return",
  "warranty",
]);

function toText(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function getFileExtension(value) {
  const source = toText(value, "").toLowerCase().split("?")[0].split("#")[0];
  const dotIndex = source.lastIndexOf(".");
  return dotIndex >= 0 ? source.slice(dotIndex) : "";
}

function guessMimeTypeFromExtension(extension) {
  switch (extension) {
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
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "";
  }
}

function normalizeAttachmentSize(value) {
  if (value === undefined || value === null || value === "") return null;
  const size = Number(value);
  return Number.isFinite(size) && size >= 0 ? size : null;
}

function normalizeAttachmentMimeType(value, source = "", fallbackType = "") {
  const raw = toText(value, "").toLowerCase();
  if (raw.startsWith("image/") || raw.startsWith("video/")) {
    return raw;
  }

  const guessedFromExt = guessMimeTypeFromExtension(getFileExtension(source));
  if (guessedFromExt) {
    return guessedFromExt;
  }

  if (fallbackType === "video") return "video/mp4";
  return "image/jpeg";
}

export function inferSupportAttachmentType(raw = {}) {
  const explicitType = toText(
    raw?.type || raw?.kind || raw?.mediaType,
    "",
  ).toLowerCase();
  if (explicitType === "image" || explicitType === "video") {
    return explicitType;
  }

  const mimeType = toText(
    raw?.mimeType || raw?.contentType || raw?.mimetype,
    "",
  ).toLowerCase();
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";

  const extension = getFileExtension(
    raw?.url || raw?.uri || raw?.path || raw?.name || raw?.fileName,
  );
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";

  return "image";
}

export function normalizeSupportAttachment(raw = {}) {
  if (!raw) return null;

  if (typeof raw === "string") {
    const url = toText(raw, "");
    if (!url) return null;
    const type = inferSupportAttachmentType({ url });
    return {
      url,
      type,
      mimeType: normalizeAttachmentMimeType("", url, type),
      name: "",
      path: "",
      size: null,
    };
  }

  const url = toText(raw?.url || raw?.uri || raw?.publicUrl, "");
  if (!url) return null;

  const type = inferSupportAttachmentType(raw);
  return {
    url,
    type,
    mimeType: normalizeAttachmentMimeType(
      raw?.mimeType || raw?.contentType || raw?.mimetype || raw?.type,
      raw?.name || raw?.fileName || raw?.path || url,
      type,
    ),
    name: toText(raw?.name || raw?.fileName, ""),
    path: toText(raw?.path, ""),
    size: normalizeAttachmentSize(raw?.size),
  };
}

export function normalizeSupportAttachments(raw) {
  if (!Array.isArray(raw)) return [];

  const seen = new Set();
  const items = [];
  for (const item of raw) {
    const normalized = normalizeSupportAttachment(item);
    if (!normalized?.url || seen.has(normalized.url)) continue;
    seen.add(normalized.url);
    items.push(normalized);
    if (items.length >= SUPPORT_ATTACHMENT_MAX_ITEMS) break;
  }
  return items;
}

export function buildSupportAttachmentPayload(raw) {
  const normalized = normalizeSupportAttachment(raw);
  if (!normalized) return null;
  return {
    url: normalized.url,
    type: normalized.type,
    mimeType: normalized.mimeType,
    name: normalized.name,
    path: normalized.path,
    size: normalized.size,
  };
}

export function requiresSupportEvidence({ category, orderId } = {}) {
  const normalizedCategory = toText(category, "general").toLowerCase();
  return (
    Boolean(toText(orderId, "")) &&
    AFTER_SALES_EVIDENCE_REQUIRED_CATEGORIES.has(normalizedCategory)
  );
}

function buildUploadName(asset = {}) {
  const explicitName = toText(asset?.fileName || asset?.name, "");
  if (explicitName) return explicitName;

  const type = inferSupportAttachmentType(asset);
  const extension =
    getFileExtension(asset?.uri) || (type === "video" ? ".mp4" : ".jpg");
  return `support-${type}-${Date.now()}${extension}`;
}

function resolveUploadMimeType(asset = {}) {
  const explicitMime = toText(asset?.mimeType, "").toLowerCase();
  if (explicitMime.startsWith("image/") || explicitMime.startsWith("video/")) {
    return explicitMime;
  }

  const type = inferSupportAttachmentType(asset);
  return normalizeAttachmentMimeType("", asset?.fileName || asset?.uri, type);
}

export async function pickAndUploadSupportAttachmentAsync({
  folder = "support-evidence",
} = {}) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Cần quyền truy cập thư viện ảnh/video.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  const name = buildUploadName(asset);
  const mimeType = resolveUploadMimeType(asset);
  const uploaded = await uploadFileApi(
    {
      uri: asset.uri,
      name,
      type: mimeType,
    },
    { folder }
  );

  return normalizeSupportAttachment({
    url: uploaded?.url,
    path: uploaded?.path,
    size: uploaded?.size,
    mimeType: uploaded?.contentType || mimeType,
    name,
    type: inferSupportAttachmentType({
      type: asset?.type,
      mimeType: uploaded?.contentType || mimeType,
      url: uploaded?.url,
    }),
  });
}
