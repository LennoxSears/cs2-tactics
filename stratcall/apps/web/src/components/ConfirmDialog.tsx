import { useLocale } from '../lib/i18n';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  const { t } = useLocale();

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="confirm-btn cancel" onClick={onCancel}>{t('cancel')}</button>
          <button className="confirm-btn danger" onClick={onConfirm}>{confirmLabel || t('delete')}</button>
        </div>
      </div>
    </div>
  );
}
