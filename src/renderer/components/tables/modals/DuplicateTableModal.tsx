import React, { useState, useEffect } from 'react';
import { useTables } from '../../../context/TableContext';
import { useI18n } from '../../../context/I18nContext';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';

export const DuplicateTableModal: React.FC = () => {
  const {
    isDuplicateModalOpen,
    setIsDuplicateModalOpen,
    targetDuplicateTable,
    setTargetDuplicateTable,
    duplicateTable,
  } = useTables();
  const { t } = useI18n();

  const [newName, setNewName] = useState('');
  const [includeData, setIncludeData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (targetDuplicateTable) {
      setNewName(`${targetDuplicateTable.name} (Cópia)`);
      setIncludeData(true);
    }
  }, [targetDuplicateTable]);

  const handleClose = () => {
    setIsDuplicateModalOpen(false);
    setTargetDuplicateTable(null);
    setNewName('');
    setIsSubmitting(false);
  };

  const handleDuplicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDuplicateTable || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await duplicateTable(targetDuplicateTable.id, includeData, newName.trim());
      handleClose();
    } catch (err: any) {
      alert(`Erro ao duplicar tabela: ${err?.message || 'Tente novamente'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!targetDuplicateTable) return null;

  return (
    <Modal
      isOpen={isDuplicateModalOpen}
      onClose={handleClose}
      title={t.tablesPage.duplicateModalTitle}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isSubmitting}>
            {t.tablesPage.cancel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleDuplicate}
            disabled={isSubmitting || !newName.trim()}
            icon={isSubmitting ? 'ri-loader-4-line animate-spin' : 'ri-file-copy-line'}
          >
            {isSubmitting ? 'Duplicando...' : t.tablesPage.duplicate}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleDuplicate} className="flex flex-col gap-4">
        <p className="text-xs text-[var(--muted)]">
          {t.tablesPage.duplicateModalDesc}
        </p>

        <Input
          label={t.tablesPage.newTableName}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nome da nova tabela duplicada"
          autoFocus
          required
        />

        {/* Include Rows Data Checkbox */}
        <div
          onClick={() => setIncludeData(prev => !prev)}
          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            includeData
              ? 'border-red-500/50 bg-red-500/5'
              : 'border-[var(--border)] bg-[var(--sidebar-primary)] hover:border-[var(--border-hover)]'
          }`}
        >
          <div className="pt-0.5">
            <input
              type="checkbox"
              checked={includeData}
              onChange={() => {}} // handled by container onClick
              className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-[var(--border)] cursor-pointer"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[var(--foreground)]">
              {t.tablesPage.includeRowsData}
            </span>
            <span className="text-[11px] text-[var(--muted)]">
              {t.tablesPage.includeRowsDesc}
            </span>
          </div>
        </div>
      </form>
    </Modal>
  );
};
