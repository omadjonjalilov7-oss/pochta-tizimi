import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { X, ShieldCheck, KeyRound, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { EimzoClient, EimzoError, sha256Hex, strToBase64, type EimzoCert } from '../../lib/eimzo';
import type { EdoDocument } from '../../lib/types';

interface Props {
  documentId: string;
  documentNumber: string;
  documentSubject: string;
  onClose: () => void;
  onSigned: (doc: EdoDocument) => void;
}

type Step = 'connect' | 'select' | 'signing' | 'done' | 'error';

export function EimzoSignModal({
  documentId,
  documentNumber,
  documentSubject,
  onClose,
  onSigned,
}: Props) {
  const { t } = useTranslation();
  const clientRef = useRef<EimzoClient | null>(null);
  const [step, setStep] = useState<Step>('connect');
  const [certs, setCerts] = useState<EimzoCert[]>([]);
  const [selected, setSelected] = useState<EimzoCert | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Backend'dan kanonik imzolanadigan matnni olamiz
  const { data: signable, error: signableError } = useQuery({
    queryKey: ['signable-payload', documentId],
    queryFn: async () =>
      (await api.get<{ payload: string; number: string }>(`/documents/${documentId}/signable-payload`)).data,
  });

  useEffect(() => {
    if (signableError) {
      setStep('error');
      setError(extract(signableError));
    }
  }, [signableError]);

  // CAPIWS ga ulanish va sertifikatlarni o'qish
  useEffect(() => {
    if (!signable) return;
    const client = new EimzoClient();
    clientRef.current = client;
    (async () => {
      try {
        await client.connect();
        const items = await client.listAllUserKeys();
        setCerts(items);
        setStep('select');
      } catch (e) {
        setStep('error');
        setError(e instanceof EimzoError ? e.message : (e as Error).message);
      }
    })();
    return () => {
      client.close();
      clientRef.current = null;
    };
  }, [signable]);

  const signMutation = useMutation({
    mutationFn: async (body: {
      pkcs7Data: string;
      certSerial: string;
      certSubject: string;
      certIssuer?: string;
      certValidFrom?: string;
      certValidTo?: string;
      signatureHash: string;
    }) => (await api.post<EdoDocument>(`/documents/${documentId}/sign`, body)).data,
  });

  async function handleSign() {
    if (!selected || !signable || !clientRef.current) return;
    setStep('signing');
    setError(null);
    try {
      const keyId = await clientRef.current.loadKey(selected);
      const payloadB64 = strToBase64(signable.payload);
      const pkcs7 = await clientRef.current.createPkcs7(keyId, payloadB64, true);
      const hash = await sha256Hex(signable.payload);
      const result = await signMutation.mutateAsync({
        pkcs7Data: pkcs7,
        certSerial: selected.serialNumber,
        certSubject: selected.CN || selected.alias,
        certIssuer: selected.O || undefined,
        certValidFrom: parseEimzoDate(selected.validFrom),
        certValidTo: parseEimzoDate(selected.validTo),
        signatureHash: hash,
      });
      setStep('done');
      setTimeout(() => onSigned(result), 700);
    } catch (e) {
      setStep('error');
      setError(e instanceof EimzoError ? e.message : extract(e));
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 text-emerald-700 rounded-lg p-2">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{t('edo.sign.title')}</h2>
              <p className="text-xs text-slate-500">
                {documentNumber} — {documentSubject}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg"
          >
            <X size={20} />
          </button>
        </header>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {step === 'connect' && (
            <div className="text-center py-8">
              <Loader2 size={32} className="animate-spin text-asaka-600 mx-auto mb-3" />
              <p className="text-sm text-slate-600">{t('edo.sign.connecting')}</p>
              <p className="text-xs text-slate-400 mt-2">{t('edo.sign.connecting_hint')}</p>
            </div>
          )}

          {step === 'select' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">{t('edo.sign.select_cert')}</p>
              <ul className="space-y-2">
                {certs.map((c) => (
                  <li key={c.serialNumber + c.path}>
                    <label
                      className={`flex items-start gap-3 border rounded-xl p-3 cursor-pointer transition ${
                        selected?.serialNumber === c.serialNumber
                          ? 'border-asaka-400 bg-asaka-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cert"
                        checked={selected?.serialNumber === c.serialNumber}
                        onChange={() => setSelected(c)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">{c.CN || c.alias}</div>
                        {c.O && <div className="text-xs text-slate-500 truncate">{c.O}</div>}
                        {c.TIN && <div className="text-xs text-slate-500">STIR: {c.TIN}</div>}
                        <div className="text-xs text-slate-400 mt-1">
                          {t('edo.sign.serial')}: {c.serialNumber.slice(0, 24)}…
                        </div>
                        {c.validTo && (
                          <div className="text-xs text-slate-500">
                            {t('edo.sign.valid_to')}: {c.validTo}
                          </div>
                        )}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 'signing' && (
            <div className="text-center py-8">
              <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">{t('edo.sign.in_progress')}</p>
              <p className="text-xs text-slate-500 mt-2 flex items-center justify-center gap-1">
                <KeyRound size={12} />
                {t('edo.sign.pin_hint')}
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <div className="inline-flex bg-emerald-50 text-emerald-700 rounded-full p-3 mb-3">
                <ShieldCheck size={32} />
              </div>
              <p className="text-sm font-medium text-emerald-700">{t('edo.sign.success')}</p>
            </div>
          )}

          {step === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-sm text-red-700 break-words">
                  {error || t('edo.sign.error_generic')}
                </div>
              </div>
              <div className="mt-3 text-xs text-red-700/80">{t('edo.sign.error_hint')}</div>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-slate-600 hover:bg-slate-100 font-medium px-4 py-2 rounded-lg text-sm"
          >
            {step === 'done' ? t('common.close') : t('common.cancel')}
          </button>
          {step === 'select' && (
            <button
              onClick={handleSign}
              disabled={!selected}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2"
            >
              <ShieldCheck size={16} />
              {t('edo.sign.confirm')}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// "01.01.2026 23:59:59" yoki "2026-01-01" formatlarini ISO ga keltirish
function parseEimzoDate(s: string | undefined): string | undefined {
  if (!s) return undefined;
  // dd.MM.yyyy[ HH:mm:ss]
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (m) {
    const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = m;
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`).toISOString();
  }
  // ISO yoki yyyy-MM-dd
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function extract(e: any): string {
  const msg = e?.response?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : msg || e?.message || 'Xatolik yuz berdi';
}
