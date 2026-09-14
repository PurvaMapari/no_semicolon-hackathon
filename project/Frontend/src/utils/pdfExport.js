import { jsPDF } from "jspdf";

/**
 * Clean string for PDF rendering, normalizing arrows and stripping raw markdown.
 */
function cleanTextForPdf(str) {
  if (!str) return "";
  let text = String(str);
  // Replace ligatures
  text = text.replace(/(?<=\S)\s+fi\s+(?=\S)/g, " -> ");
  text = text.replace(/\b([A-Za-z0-9\+\s]+?)\s+fi\s+([A-Za-z0-9\+\s]+)/g, "$1 -> $2");
  // Replace arrow symbols with clean ASCII arrow for universal PDF font support
  text = text.replace(/→/g, " -> ");
  // Strip markdown bold / italic
  text = text.replace(/\*\*(.+?)\*\*/g, "$1");
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  return text.trim();
}

/**
 * Generate and download a beautifully styled PDF containing all lesson sections.
 *
 * @param {Object} options
 * @param {string} options.title - Document or lesson title
 * @param {string} options.profile - Active accessibility profile name
 * @param {Array} options.sections - Array of section objects ({ heading, paragraph/content, meta })
 * @param {string} [options.fileName] - Original uploaded filename if available
 */
export function exportLessonToPDF({ title = "Adapted Lesson", profile = "Adaptive Learning", sections = [], fileName = "" }) {
  if (!sections || sections.length === 0) {
    alert("No lesson content available to download.");
    return;
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const displayTitle = cleanTextForPdf(title || fileName || "Adapted Learning Material");
  const profileLabel = profile
    ? profile.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Adaptive Profile";

  function checkPageBreak(neededHeight) {
    if (y + neededHeight > pageHeight - margin - 12) {
      doc.addPage();
      y = margin + 8;
      return true;
    }
    return false;
  }

  // ── Document Header ──────────────────────────────────────────────────────────
  doc.setFillColor(6, 95, 70); // Forest Teal #065f46
  doc.roundedRect(margin, y, contentWidth, 26, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(209, 250, 229); // Light mint
  doc.text("ADAPTLEARN • ADAPTIVE LEARNING ENGINE", margin + 8, y + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(displayTitle, contentWidth - 16);
  doc.text(titleLines[0] || displayTitle, margin + 8, y + 18);

  y += 33;

  // Meta info bar
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.roundedRect(margin, y, contentWidth, 10, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 118, 110); // Teal 700
  doc.text(`Profile: ${profileLabel}`, margin + 5, y + 6.5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Sections: ${sections.length}`, margin + 70, y + 6.5);

  const exportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  doc.text(`Exported: ${exportDate}`, pageWidth - margin - 5, y + 6.5, { align: "right" });

  y += 16;

  // ── Render Each Section ──────────────────────────────────────────────────────
  sections.forEach((sec, idx) => {
    const sectionNum = idx + 1;
    const rawHeading = sec.heading || `Section ${sectionNum}`;
    const headingText = cleanTextForPdf(rawHeading);
    const contentText = cleanTextForPdf(sec.paragraph || sec.content || "");
    const tier = (sec.meta?.difficulty_tier || "foundational").toUpperCase();

    // Check if we need a new page for the section header
    checkPageBreak(25);

    // Section Number Pill & Tier
    doc.setFillColor(236, 253, 245); // Mint 50
    doc.setDrawColor(167, 243, 208); // Mint 200
    doc.roundedRect(margin, y, 42, 6, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(6, 95, 70);
    doc.text(`SECTION ${sectionNum} OF ${sections.length}`, margin + 3, y + 4.2);

    // Difficulty Chip
    const tierX = margin + 46;
    doc.setFillColor(tier === "FOUNDATIONAL" ? 236 : 254, tier === "FOUNDATIONAL" ? 253 : 243, tier === "FOUNDATIONAL" ? 245 : 199);
    doc.setDrawColor(tier === "FOUNDATIONAL" ? 167 : 253, tier === "FOUNDATIONAL" ? 243 : 230, tier === "FOUNDATIONAL" ? 208 : 138);
    doc.roundedRect(tierX, y, 28, 6, 1.5, 1.5, "FD");
    doc.setTextColor(tier === "FOUNDATIONAL" ? 6 : 180, tier === "FOUNDATIONAL" ? 95 : 83, tier === "FOUNDATIONAL" ? 70 : 9);
    doc.text(tier, tierX + 3, y + 4.2);

    y += 11;

    // Heading
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // Slate 900
    const headingLines = doc.splitTextToSize(headingText, contentWidth);
    doc.text(headingLines, margin, y);
    y += headingLines.length * 6 + 3;

    // Content Body
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85); // Slate 700

    const paragraphs = contentText.split("\n").filter(Boolean);
    paragraphs.forEach((pText) => {
      const isProcessLine = pText.includes("->") && (pText.includes("+") || pText.length < 120);

      if (isProcessLine) {
        // Render process formula card in PDF
        const procLines = doc.splitTextToSize(pText, contentWidth - 12);
        const cardH = procLines.length * 5 + 6;
        checkPageBreak(cardH + 4);

        doc.setFillColor(240, 253, 244); // Green 50
        doc.setDrawColor(187, 247, 208); // Green 200
        doc.roundedRect(margin, y, contentWidth, cardH, 2, 2, "FD");

        // Green left indicator border
        doc.setFillColor(16, 185, 129); // Green 500
        doc.roundedRect(margin, y, 3, cardH, 1, 1, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(6, 95, 70);
        doc.text(procLines, margin + 7, y + 5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        y += cardH + 4;
      } else {
        const bodyLines = doc.splitTextToSize(pText, contentWidth);
        const needed = bodyLines.length * 5.2 + 3;
        checkPageBreak(needed);

        doc.text(bodyLines, margin, y);
        y += bodyLines.length * 5.2 + 4;
      }
    });

    // Divider between sections
    y += 4;
    checkPageBreak(8);
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.line(margin, y, pageWidth - margin, y);
    y += 9;
  });

  // ── Page Footers ─────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400

    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    doc.text("AdaptLearn • Accessible Educational Engine", margin, pageHeight - 6);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }

  // Sanitize filename
  const safeTitle = displayTitle.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "Lesson";
  doc.save(`AdaptLearn_${safeTitle}_Full_Lesson.pdf`);
}
