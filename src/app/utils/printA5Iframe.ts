/**
 * Universal A5 Document Printing Utility (Isolated Iframe Engine)
 * Admin SUN89 — Biro Jasa Management System
 *
 * Solves modal overflow clipping and CSS transform containing-block traps
 * by rendering the target printable container in a detached, style-injected iframe.
 * Pre-fills browser "Save as PDF" suggested filename using document.title.
 */

export function printA5Document(element: HTMLElement | null, documentTitle = "Faktur Invoice A5") {
  if (!element) {
    window.print();
    return;
  }

  // 1. Remove any previous print frame
  const existingFrame = document.getElementById("sun89-print-iframe");
  if (existingFrame) {
    existingFrame.remove();
  }

  // 2. Temporarily set host document.title so all browser engines pick it up as default PDF filename
  const previousDocTitle = document.title;
  document.title = documentTitle;

  // 3. Create invisible printing frame
  const printFrame = document.createElement("iframe");
  printFrame.id = "sun89-print-iframe";
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "0";
  printFrame.setAttribute("aria-hidden", "true");

  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow?.document;
  if (!frameDoc) {
    // Fallback to normal window print if iframe is not accessible
    window.print();
    document.title = previousDocTitle;
    return;
  }

  // 4. Collect all active stylesheets and inline styles from the host document
  const headStyles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
    .map((node) => node.outerHTML)
    .join("\n");

  // 5. Construct standalone A5 printing HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>${documentTitle}</title>
        ${headStyles}
        <style>
          @page {
            size: A5 portrait;
            margin: 6mm 8mm;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          }
          /* Ensure printable area takes natural full page without modal constraints */
          #invoice-a5-print-area,
          #kwitansi-print-area,
          #voucher-print-area,
          #print-rekonsiliasi-area {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
        </style>
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `;

  frameDoc.open();
  frameDoc.write(htmlContent);
  frameDoc.close();

  // 6. Trigger print after a short render delay so images & fonts are resolved
  printFrame.contentWindow?.focus();
  setTimeout(() => {
    try {
      printFrame.contentWindow?.print();
    } catch (err) {
      console.error("[SUN89 Print] Error triggering iframe print:", err);
      window.print();
    } finally {
      // Restore host title after browser opens print modal
      setTimeout(() => {
        document.title = previousDocTitle;
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 3000);
    }
  }, 300);
}
