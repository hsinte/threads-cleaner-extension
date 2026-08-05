import { t } from "@/i18n";

export interface EncodedAttachment {
  filename: string;
  mimeType: string;
  base64: string;
}

const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.75;

/**
 * 把使用者選擇的檔案轉成可以放進 JSON 送出的附件格式。
 * 圖片會先等比例縮小到最長邊 1600px 並轉成壓縮過的 JPEG,
 * 非圖片(例如匯出的封鎖名單 .txt)則原封不動轉 base64。
 */
export async function encodeAttachment(
  file: File,
): Promise<EncodedAttachment> {
  if (file.type.startsWith("image/")) {
    return compressImageFile(file);
  }

  return {
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    base64: await fileToBase64(file),
  };
}

async function compressImageFile(file: File): Promise<EncodedAttachment> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(t("compressCanvasUnsupported"));
  }

  context.drawImage(bitmap, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
  const base64 = dataUrl.split(",")[1] ?? "";

  return {
    filename: replaceExtension(file.name, "jpg"),
    mimeType: "image/jpeg",
    base64,
  };
}

function replaceExtension(filename: string, newExtension: string): string {
  const dotIndex = filename.lastIndexOf(".");
  const base = dotIndex === -1 ? filename : filename.slice(0, dotIndex);

  return `${base}.${newExtension}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error(t("fileReadFailed")));
        return;
      }

      resolve(result.split(",")[1] ?? "");
    };

    reader.onerror = () => reject(new Error(t("fileReadFailed")));

    reader.readAsDataURL(file);
  });
}
