import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconCheck } from '../../app/icons';
import { DiagnosticReportView } from './DiagnosticReportView';
import type { DiagnosticReportData } from './reportTypes';
import { generateWhatsAppSummary } from './whatsAppSummary';

interface ReportModalProps {
  data: DiagnosticReportData;
  isOpen: boolean;
  onClose: () => void;
}

export function ReportModal({ data, isOpen, onClose }: ReportModalProps) {
  const { t, i18n } = useTranslation();
  const [hideVin, setHideVin] = useState(true);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyWhatsApp = async () => {
    const text = generateWhatsAppSummary(data, {
      maskVin: hideVin,
      language: i18n.resolvedLanguage,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 3000);
    } catch (err) {
      console.warn('Failed to copy to clipboard', err);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-xs print:static print:inset-auto print:block print:bg-transparent print:p-0"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl print:max-h-none print:w-full print:max-w-none print:rounded-none print:shadow-none dark:bg-slate-900">
        {/* Modal Toolbar (hidden in print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {data.mode === 'pre_purchase'
                ? t('report.prePurchaseTitle')
                : t('report.title')}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* VIN Mask Toggle */}
            <button
              type="button"
              onClick={() => setHideVin((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {hideVin ? t('report.showVin') : t('report.hideVin')}
            </button>

            {/* WhatsApp Copy */}
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
            >
              {copiedWhatsApp ? (
                <>
                  <IconCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('report.copiedWhatsApp')}</span>
                </>
              ) : (
                <span>{t('report.copyWhatsApp')}</span>
              )}
            </button>

            {/* Print / Save PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400"
            >
              {t('report.exportPdf')}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {t('report.close')}
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto p-4 print:overflow-visible print:p-0 sm:p-6">
          <DiagnosticReportView data={data} hideVin={hideVin} />
        </div>
      </div>
    </div>
  );
}
