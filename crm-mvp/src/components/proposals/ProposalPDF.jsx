import { jsPDF } from "jspdf";
import { format } from "date-fns";

// Gera e baixa o PDF de uma proposta
export function generateProposalPDF(proposal, companyName = "Minha Empresa") {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const margin = 20;
  let y = 0;

  const total = (proposal.items || []).reduce((s, i) => s + (i.value || 0), 0) || proposal.value || 0;

  // ── HEADER (faixa azul)
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, W, 40, "F");

  // Logo / nome da empresa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(companyName, margin, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("PROPOSTA COMERCIAL", margin, 24);

  // Número e data
  const dateStr = proposal.created_date
    ? format(new Date(proposal.created_date), "dd/MM/yyyy")
    : format(new Date(), "dd/MM/yyyy");
  doc.setFontSize(9);
  doc.text(`Data: ${dateStr}`, W - margin, 16, { align: "right" });
  if (proposal.valid_until) {
    doc.text(`Válida até: ${format(new Date(proposal.valid_until), "dd/MM/yyyy")}`, W - margin, 22, { align: "right" });
  }

  y = 50;

  // ── TÍTULO DA PROPOSTA
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, y, W - margin * 2, 22, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(proposal.title, margin + 8, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Para: ${proposal.client_name}`, margin + 8, y + 17);
  y += 30;

  // ── DESCRIÇÃO
  if (proposal.description) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Sobre o projeto", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const descLines = doc.splitTextToSize(proposal.description, W - margin * 2);
    doc.text(descLines, margin, y);
    y += descLines.length * 5 + 8;
  }

  // ── ITENS DA PROPOSTA
  if ((proposal.items || []).length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Escopo de Serviços", margin, y);
    y += 6;

    // Cabeçalho da tabela
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, W - margin * 2, 8, "F");
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, W - margin * 2, 8, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("DESCRIÇÃO", margin + 4, y + 5.5);
    doc.text("VALOR", W - margin - 4, y + 5.5, { align: "right" });
    y += 8;

    proposal.items.forEach((item, idx) => {
      const rowBg = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
      doc.setFillColor(...rowBg);
      doc.rect(margin, y, W - margin * 2, 8, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(item.description || "", margin + 4, y + 5.5);
      doc.text(
        `R$ ${(item.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        W - margin - 4,
        y + 5.5,
        { align: "right" }
      );
      y += 8;
    });

    // Total row
    doc.setFillColor(16, 185, 129);
    doc.rect(margin, y, W - margin * 2, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("TOTAL", margin + 4, y + 7);
    doc.text(
      `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      W - margin - 4,
      y + 7,
      { align: "right" }
    );
    y += 18;
  } else {
    // Só valor total
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(margin, y, W - margin * 2, 16, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("VALOR TOTAL", margin + 8, y + 7);
    doc.text(
      `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      W - margin - 8,
      y + 7,
      { align: "right" }
    );
    y += 24;
  }

  // ── ACEITE
  if (proposal.accepted_at) {
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(margin, y, W - margin * 2, 14, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text(
      `✓ Proposta aceita digitalmente em ${format(new Date(proposal.accepted_at), "dd/MM/yyyy 'às' HH:mm")}`,
      W / 2,
      y + 9,
      { align: "center" }
    );
    y += 22;
  }

  // ── FOOTER
  const pageH = 297;
  doc.setFillColor(248, 250, 252);
  doc.rect(0, pageH - 20, W, 20, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${companyName} · Proposta gerada em ${format(new Date(), "dd/MM/yyyy")}`,
    W / 2,
    pageH - 8,
    { align: "center" }
  );

  const fileName = `proposta-${proposal.client_name.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "ddMMyyyy")}.pdf`;
  doc.save(fileName);
}

// Gera e baixa o PDF de um contrato
export function generateContractPDF(contract, companyName = "Minha Empresa") {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const margin = 20;
  let y = 0;

  // ── HEADER (faixa escura)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 40, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(companyName, margin, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", margin, 25);

  const dateStr = contract.created_date
    ? format(new Date(contract.created_date), "dd/MM/yyyy")
    : format(new Date(), "dd/MM/yyyy");
  doc.setFontSize(9);
  doc.text(`Emitido em: ${dateStr}`, W - margin, 16, { align: "right" });

  y = 50;

  // ── INFO CAIXA
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, W - margin * 2, 28, 3, 3, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, W - margin * 2, 28, 3, 3, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(contract.title, margin + 8, y + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Cliente: ${contract.client_name}`, margin + 8, y + 19);

  const val = (contract.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(16, 185, 129);
  doc.text(`R$ ${val}`, W - margin - 8, y + 16, { align: "right" });

  y += 36;

  // ── CONTEÚDO DO CONTRATO
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);

  const lines = (contract.content || "").split("\n");
  lines.forEach((line) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    const isBold = line === line.toUpperCase() && line.trim().length > 3;
    if (isBold) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
    }
    const wrapped = doc.splitTextToSize(line || " ", W - margin * 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5.5 + (isBold ? 2 : 0);
  });

  // ── STATUS DE ASSINATURA
  if (contract.status === "assinado" && contract.signed_at) {
    if (y > 240) { doc.addPage(); y = 20; }
    y += 8;
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(margin, y, W - margin * 2, 18, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text(
      `✓ Assinado digitalmente em ${format(new Date(contract.signed_at), "dd/MM/yyyy 'às' HH:mm")}`,
      W / 2, y + 11, { align: "center" }
    );
    y += 26;
  } else {
    // Área de assinatura
    if (y > 230) { doc.addPage(); y = 20; }
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const xLeft = margin;
    const xRight = W / 2 + 10;
    const lineWidth = (W - margin * 2) / 2 - 10;

    doc.setDrawColor(100, 116, 139);
    doc.line(xLeft, y + 14, xLeft + lineWidth, y + 14);
    doc.line(xRight, y + 14, xRight + lineWidth, y + 14);

    doc.text("Assinatura do Contratante", xLeft + lineWidth / 2, y + 20, { align: "center" });
    doc.text(`Assinatura do Cliente: ${contract.client_name}`, xRight + lineWidth / 2, y + 20, { align: "center" });
    doc.text(`Data: ___/___/______`, xLeft + lineWidth / 2, y + 26, { align: "center" });
    doc.text(`Data: ___/___/______`, xRight + lineWidth / 2, y + 26, { align: "center" });
    y += 34;
  }

  // ── FOOTER
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 285, W, 12, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${companyName} · Contrato gerado em ${format(new Date(), "dd/MM/yyyy")} · Página ${i} de ${pageCount}`, W / 2, 292, { align: "center" });
  }

  const fileName = `contrato-${contract.client_name.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "ddMMyyyy")}.pdf`;
  doc.save(fileName);
}