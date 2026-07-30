import type { EdoDocument } from './types';

// Xujjatni tasdiqlagan xodimlar zanjirini Word (.doc) fayl sifatida saqlaydi.
// Format (har bir xodim uchun bir qator):
//   Xodim ishlaydigan bo'lim va lavozimi : ______(imzo joyi)______ Familiya Ism Sharifi
// zulxumor va avazbek login egalari ro'yxatga kiritilmaydi.

const EXCLUDED_LOGINS = ['zulxumor', 'avazbek'];

function esc(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function exportApproverChainWord(doc: EdoDocument, labels: { deptPos: string; fullName: string; title: string }) {
  const approvers = (doc.participants ?? [])
    .filter((p) => p.role === 'approver')
    .filter((p) => !EXCLUDED_LOGINS.includes(p.user.login))
    .sort((a, b) => a.order - b.order);

  const rows = approvers
    .map((p) => {
      const dept = p.user.department?.name ?? '';
      const pos = p.user.position?.name ?? '';
      const deptPos = [dept, pos].filter(Boolean).join(', ');
      const fio = p.user.fullName ?? p.user.login;
      return `
        <tr>
          <td style="padding:6px 8px;border:none;white-space:nowrap;vertical-align:bottom;">
            ${esc(labels.deptPos)}: ${esc(deptPos)}
          </td>
          <td style="padding:6px 8px;border:none;width:220px;border-bottom:1px solid #000;">&nbsp;</td>
          <td style="padding:6px 8px;border:none;white-space:nowrap;text-align:right;vertical-align:bottom;">
            ${esc(fio)}
          </td>
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
    h2 { font-size: 16px; text-align: center; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
  <h2>${esc(labels.title)}${doc.number ? ` № ${esc(doc.number)}` : ''}</h2>
  <div style="margin-bottom:16px;font-weight:bold;">${esc(doc.subject ?? '')}</div>
  <table>
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
  const safeNum = (doc.number ?? 'xujjat').toString().replace(/[^\w\-]+/g, '_');
  a.download = `zanjir_${safeNum}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
