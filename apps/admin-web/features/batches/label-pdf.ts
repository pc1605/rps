import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { BatchDetail } from "./types";

// Label grid on A4: 3 columns × 8 rows = 24 labels/page.
// Sized ~63×35mm (common adhesive label sheets) — adjust when the
// real printer/taffeta dimensions are known.
const PAGE_W = 210;
const PAGE_H = 297;
const COLS = 3;
const ROWS = 8;
const MARGIN_X = 7;
const MARGIN_Y = 12;
const LABEL_W = (PAGE_W - MARGIN_X * 2) / COLS;
const LABEL_H = (PAGE_H - MARGIN_Y * 2) / ROWS;
const QR_SIZE = 22; // mm

export async function generateLabelPdf(batch: BatchDetail): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  for (let i = 0; i < batch.units.length; i++) {
    const unit = batch.units[i];
    const page = Math.floor(i / (COLS * ROWS));
    const idx = i % (COLS * ROWS);
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);

    if (idx === 0 && page > 0) doc.addPage();

    const x = MARGIN_X + col * LABEL_W;
    const y = MARGIN_Y + row * LABEL_H;

    // QR — encodes the unit_code (the scanner's payload)
    const qrDataUrl = await QRCode.toDataURL(unit.unit_code, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
    });
    doc.addImage(
      qrDataUrl,
      "PNG",
      x + 2,
      y + (LABEL_H - QR_SIZE) / 2,
      QR_SIZE,
      QR_SIZE,
    );

    // Text block right of the QR
    const tx = x + QR_SIZE + 5;
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text(unit.unit_code, tx, y + 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`${batch.brand_name} ${batch.model_name}`, tx, y + 15, {
      maxWidth: LABEL_W - QR_SIZE - 8,
    });
    doc.setFontSize(6.5);
    doc.setTextColor(120);
    doc.text("RIDDHI Car Floor Laminates", tx, y + 20);
    doc.setTextColor(0);

    // faint cut guide
    doc.setDrawColor(210);
    doc.rect(x, y, LABEL_W, LABEL_H);
  }

  doc.save(`${batch.batch_code}-labels.pdf`);
}
