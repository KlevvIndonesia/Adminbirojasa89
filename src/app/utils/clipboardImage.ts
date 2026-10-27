import { toBlob, toPng } from "html-to-image";

/**
 * Copies an HTML element as a high-resolution PNG image directly into the system clipboard.
 * Supports pasting (Ctrl + V) directly into WhatsApp Web, Telegram, Email, Docs, etc.
 *
 * @param element - The HTML DOM element to convert to an image
 * @returns Promise<boolean> - True if successfully written to clipboard
 */
export async function copyElementAsImageToClipboard(element: HTMLElement): Promise<boolean> {
  if (!element) {
    throw new Error("Element is null or undefined");
  }

  // Generate high-resolution blob (2x pixel ratio for sharp retina / 300dpi rendering)
  const blob = await toBlob(element, {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
    cacheBust: false,
    filter: (node) => {
      // Exclude elements with class 'print:hidden' or 'no-capture'
      if (node instanceof HTMLElement) {
        if (node.classList?.contains("no-capture") || node.classList?.contains("print:hidden")) {
          return false;
        }
      }
      return true;
    },
  });

  if (!blob) {
    throw new Error("Gagal membuat data gambar faktur (Blob null)");
  }

  // Ensure clipboard API is supported
  if (!navigator.clipboard || typeof window.ClipboardItem === "undefined") {
    console.warn("[SUN89 Clipboard] ClipboardItem is not supported in this browser environment.");
    return false;
  }

  try {
    const clipboardItem = new ClipboardItem({ "image/png": blob });
    await navigator.clipboard.write([clipboardItem]);
    return true;
  } catch (err) {
    console.error("[SUN89 Clipboard] Error writing image to clipboard:", err);
    return false;
  }
}

/**
 * Downloads an HTML element directly as a PNG image file.
 *
 * @param element - The HTML DOM element to capture
 * @param fileName - Desired file name without extension
 */
export async function downloadElementAsImage(element: HTMLElement, fileName: string): Promise<void> {
  if (!element) return;

  const dataUrl = await toPng(element, {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
    quality: 0.95,
  });

  const cleanName = fileName.replace(/[/\\?%*:|"<>]/g, "-").trim() || "Faktur";
  const link = document.createElement("a");
  link.download = `${cleanName}.png`;
  link.href = dataUrl;
  link.click();
}
