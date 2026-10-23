import React, { useState } from 'react';
import { useTables } from '../../../context/TableContext';
import { useI18n } from '../../../context/I18nContext';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { TableColumnType } from '../../../../types/table';

export const AddColumnModal: React.FC = () => {
  const { isAddColumnModalOpen, setIsAddColumnModalOpen, addColumn } = useTables();
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [type, setType] = useState<TableColumnType>('text');
  const [initialOptions, setInitialOptions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setIsAddColumnModalOpen(false);
    setName('');
    setType('text');
    setInitialOptions('');
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const parsedOptions =
        type === 'select' && initialOptions.trim()
          ? initialOptions
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : undefined;

      await addColumn(name.trim(), type, parsedOptions);
      handleClose();
    } catch (err: any) {
      alert(`Erro ao adicionar coluna: ${err?.message || 'Tente novamente'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeOptions: {
    type: TableColumnType;
    label: string;
    icon: string;
    desc: string;
  }[] = [
    {
      type: 'text',
      label: t.tablesPage.typeText,
      icon: 'ri-text',
      desc: t.tablesPage.typeTextDesc,
    },
    {
      type: 'number',
      label: t.tablesPage.typeNumber,
      icon: 'ri-hashtag',
      desc: t.tablesPage.typeNumberDesc,
    },
    {
      type: 'select',
      label: t.tablesPage.typeSelect,
      icon: 'ri-list-check',
      desc: t.tablesPage.typeSelectDesc,
    },
    {
      type: 'profile',
      label: t.tablesPage.typeProfile,
      icon: 'ri-global-line',
      desc: t.tablesPage.typeProfileDesc,
    },
    {
      type: 'password',
      label: (t.tablesPage as any).typePassword || 'Senha / Protegido',
      icon: 'ri-lock-password-line',
      desc: (t.tablesPage as any).typePasswordDesc || 'Visualização protegida por botão de olho e cópia rápida',
    },
    {
      type: 'date',
      label: 'Data e Hora',
      icon: 'ri-calendar-event-line',
      desc: 'Data e hora no formato DD/MM HH:mm com edição rápida e atalhos',
    },
  ];

  return (
    <Modal
      isOpen={isAddColumnModalOpen}
      onClose={handleClose}
      title="Nova Coluna"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isSubmitting}>
            {t.tablesPage.cancel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
            icon={isSubmitting ? 'ri-loader-4-line animate-spin' : 'ri-check-line'}
          >
            {isSubmitting ? 'Adicionando...' : 'Adicionar Coluna'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={t.tablesPage.columnName}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: Status da BM, Chave 2FA, Gasto Diário..."
          autoFocus
          required
        />

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[var(--muted)]">
            {t.tablesPage.columnType}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {typeOptions.map(opt => {
              const isSelected = type === opt.type;
              return (
                <div
                  key={opt.type}
                  onClick={() => setType(opt.type)}
                  className={`flex flex-col gap-1 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-red-500 bg-red-500/8 ring-1 ring-red-500/20'
                      : 'border-[var(--border)] bg-[var(--sidebar-primary)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${
                        isSelected
                          ? 'bg-red-600 text-white'
                          : 'bg-[var(--muted-bg)] text-[var(--muted)]'
                      }`}
                    >
                      <i className={opt.icon} />
                    </div>
                    <span className="text-xs font-semibold text-[var(--foreground)]">
                      {opt.label}
                    </span>
                  </div>
                  <span className="text-[10.5px] text-[var(--muted)] leading-tight">
                    {opt.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* If Select type, allow comma-separated initial options */}
        {type === 'select' && (
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-[var(--muted-bg)]/50 border border-[var(--border)] animate-fade-in">
            <label className="text-xs font-medium text-[var(--foreground)]">
              Opções Iniciais (opcional, separadas por vírgula)
            </label>
            <Input
              value={initialOptions}
              onChange={e => setInitialOptions(e.target.value)}
              placeholder="Ex: Ativa, Aquecendo, Restrita, Bloqueada"
            />
            <span className="text-[10.5px] text-[var(--muted)]">
              Dica: Você também pode digitar qualquer nova opção diretamente nas linhas a qualquer momento!
            </span>
          </div>
        )}
      </form>
    </Modal>
  );
};
