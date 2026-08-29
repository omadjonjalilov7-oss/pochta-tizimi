// Tasdiqlash zanjirini Word (.doc) fayl sifatida saqlaydi. Har bir tasdiqlovchi
// uchun bitta qator: F.I.Sh. (bo'lim/lavozimi), tasdiqlagan sana/vaqti va QR kodi.
// Ma'lumot (jumladan QR PNG) backend'dagi `/documents/:id/chain-export` dan olinadi.

export interface ChainExportRow {
  fullName: string;
  deptPos: string;
  actedAt: string | null; // ISO
  approved: boolean;
  qrDataUrl: string; // PNG data URL (tasdiqlagan bo'lsa)
}

export interface ChainExportData {
  number: string;
  subject: string;
  rows: ChainExportRow[];
}

export interface ChainExportLabels {
  title: string; // "Tasdiqlash varaqasi" kabi sarlavha
  num: string; // "№"
  fio: string; // "F.I.Sh."
  when: string; // "Tasdiqlagan vaqti"
  qr: string; // "QR kod"
}

function esc(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// "14.08.2026 15:50" ko'rinishida (mahalliy — Toshkent) sana/vaqt.
function fmtWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

export function exportApproverChainWord(
  data: ChainExportData,
  labels: ChainExportLabels,
) {
  const rows = data.rows
    .map((r, i) => {
      const person = r.deptPos
        ? `${esc(r.fullName)}<br/><span style="font-size:11px;color:#444;">${esc(
            r.deptPos,
          )}</span>`
        : esc(r.fullName);
      const qrCell = r.qrDataUrl
        ? `<img src="${r.qrDataUrl}" width="90" height="90" alt="QR" />`
        : '';
      return `
        <tr>
          <td style="border:1px solid #000;padding:6px 8px;text-align:center;vertical-align:middle;">${
            i + 1
          }</td>
          <td style="border:1px solid #000;padding:6px 8px;vertical-align:middle;">${person}</td>
          <td style="border:1px solid #000;padding:6px 8px;text-align:center;vertical-align:middle;white-space:nowrap;">${esc(
            fmtWhen(r.actedAt),
          )}</td>
          <td style="border:1px solid #000;padding:6px 8px;text-align:center;vertical-align:middle;">${qrCell}</td>
        </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>${esc(labels.title)}</title>
  <style>
    @page { size: A4; margin: 2cm; }
    body { font-family: 'Times New Roman', serif; font-size: 14px; color: #000; }
    h2 { font-size: 16px; text-align: center; margin-bottom: 6px; }
    .subj { text-align: center; margin-bottom: 18px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    th { border: 1px solid #000; padding: 6px 8px; background: #f0f0f0; }
  </style>
</head>
<body>
  <h2>${esc(labels.title)}${data.number ? ` № ${esc(data.number)}` : ''}</h2>
  <div class="subj">${esc(data.subject)}</div>
  <table>
    <thead>
      <tr>
        <th style="width:36px;">${esc(labels.num)}</th>
        <th>${esc(labels.fio)}</th>
        <th style="width:150px;">${esc(labels.when)}</th>
        <th style="width:110px;">${esc(labels.qr)}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeNum = (data.number || 'xujjat').toString().replace(/[^\w\-]+/g, '_');
  a.download = `zanjir_${safeNum}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
