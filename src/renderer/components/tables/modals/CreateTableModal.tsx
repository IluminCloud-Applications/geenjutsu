import React, { useState, useEffect } from 'react';
import { useTables } from '../../../context/TableContext';
import { useI18n } from '../../../context/I18nContext';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { TableTemplate } from '../../../../types/table';

const TABLE_ICONS = [
  'ri-table-line',
  'ri-facebook-circle-fill',
  'ri-fire-fill',
  'ri-share-forward-box-fill',
  'ri-user-add-line',
  'ri-database-2-line',
  'ri-file-list-3-line',
  'ri-grid-line',
];

const TABLE_COLORS = [
  '#EF4444', // Red
  '#1877F2', // Blue (Facebook)
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#64748B', // Slate
];

export const CreateTableModal: React.FC = () => {
  const { isCreateTableModalOpen, setIsCreateTableModalOpen, createTable, templates } = useTables();
  const { t } = useI18n();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('blank');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('ri-table-line');
  const [selectedColor, setSelectedColor] = useState('#EF4444');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isCreateTableModalOpen) {
      setSelectedTemplateId('blank');
      setName('');
      setDescription('');
      setSelectedIcon('ri-table-line');
      setSelectedColor('#EF4444');
      setIsSubmitting(false);
    }
  }, [isCreateTableModalOpen]);

  const handleSelectTemplate = (template: TableTemplate | null) => {
    if (template) {
      setSelectedTemplateId(template.id);
      setName(template.name);
      setDescription(template.description || '');
      setSelectedIcon(template.icon || 'ri-table-line');
      setSelectedColor(template.color || '#EF4444');
    } else {
      setSelectedTemplateId('blank');
      setName('');
      setDescription('');
      setSelectedIcon('ri-table-line');
      setSelectedColor('#EF4444');
    }
  };

  const handleClose = () => {
    setIsCreateTableModalOpen(false);
    setSelectedTemplateId('blank');
    setName('');
    setDescription('');
    setSelectedIcon('ri-table-line');
    setSelectedColor('#EF4444');
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      if (selectedTemplateId !== 'blank') {
        await createTable({
          name: name.trim() || 'Nova Tabela',
          description: description.trim() || undefined,
          icon: selectedIcon,
          color: selectedColor,
          templateId: selectedTemplateId,
        });
      } else {
        await createTable({
          name: name.trim() || 'Nova Tabela',
          description: description.trim() || undefined,
          icon: selectedIcon,
          color: selectedColor,
        });
      }
      handleClose();
    } catch (err: any) {
      alert(`Erro ao criar tabela: ${err?.message || 'Tente novamente'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isCreateTableModalOpen}
      onClose={handleClose}
      title={t.tablesPage.newTable}
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
            disabled={isSubmitting}
            icon={isSubmitting ? 'ri-loader-4-line animate-spin' : 'ri-check-line'}
          >
            {isSubmitting ? 'Criando...' : t.tablesPage.create}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {/* Template Selector - Compact Grid */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted-fg)]">
            Modelo Inicial
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Blank Option */}
            <button
              type="button"
              onClick={() => handleSelectTemplate(null)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                selectedTemplateId === 'blank'
                  ? 'border-red-500 bg-red-500/10 text-red-500 font-semibold shadow-xs'
                  : 'border-[var(--border)] bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-hover)]'
              }`}
            >
              <i className="ri-add-box-line text-lg mb-1" />
              <span className="text-[11.5px] truncate max-w-full">Em Branco</span>
            </button>

            {/* Ready Templates */}
            {templates.map(tmpl => {
              const isSelected = selectedTemplateId === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tmpl)}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-red-500 bg-red-500/10 text-red-500 font-semibold shadow-xs'
                      : 'border-[var(--border)] bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <i
                    className={`${tmpl.icon} text-lg mb-1`}
                    style={{ color: isSelected ? undefined : tmpl.color }}
                  />
                  <span className="text-[11.5px] truncate max-w-full">{tmpl.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table Name */}
        <Input
          label={t.tablesPage.columnName ? 'Nome da Tabela' : 'Nome da Tabela'}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t.tablesPage.tableNamePlaceholder}
          autoFocus
          required
        />

        {/* Table Description */}
        <Input
          label={t.tablesPage.descriptionPlaceholder ? 'Descrição (opcional)' : 'Descrição'}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={t.tablesPage.descriptionPlaceholder}
        />

        {/* Icon & Color Selector - Compact Single Row */}
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-[var(--border)]/50">
          {/* Icons */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[var(--muted)]">Ícone</span>
            <div className="flex items-center gap-1">
              {TABLE_ICONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setSelectedIcon(icon)}
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-all cursor-pointer ${
                    selectedIcon === icon
                      ? 'bg-red-600 text-white shadow-2xs'
                      : 'bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <i className={icon} />
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div className="flex flex-col gap-1 items-end">
            <span className="text-[11px] font-medium text-[var(--muted)]">Cor</span>
            <div className="flex items-center gap-1.5">
              {TABLE_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  style={{ backgroundColor: color }}
                  className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                    selectedColor === color
                      ? 'ring-2 ring-offset-1 ring-offset-[var(--card)] ring-white scale-110'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
