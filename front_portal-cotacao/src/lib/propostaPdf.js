import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { buildPropostaHtml } from './propostaTemplateHtml';

/**
 * Gera PDF a partir de um template HTML (mais fiel ao "modelo").
 * @param {object} data dados da cotação
 */
export async function gerarPropostaTecnicaPdf(data) {
  const { filename, blob } = await gerarPropostaTecnicaPdfBlob(data);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Gera o PDF e devolve Blob (para download/envio). */
export async function gerarPropostaTecnicaPdfBlob(data) {
  const numero = data?.numeroCotacao ? String(data.numeroCotacao) : '';

  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '-10000px';
  el.style.top = '0';
  el.style.width = '1123px'; // A4 landscape @ 96dpi aprox
  el.style.background = '#ffffff';
  el.style.color = '#0f172a';
  el.style.fontFamily = 'Arial, Helvetica, sans-serif';

  el.innerHTML = buildPropostaHtml(data);

  document.body.appendChild(el);
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const y = Math.max(0, (pageH - imgH) / 2);
    pdf.addImage(imgData, 'PNG', 0, y, imgW, imgH, undefined, 'FAST');

    const safeNum = numero ? `_${numero}` : '';
    const filename = `Proposta_Comercial${safeNum}.pdf`;
    const blob = pdf.output('blob');
    return { filename, blob };
  } finally {
    document.body.removeChild(el);
  }
}

