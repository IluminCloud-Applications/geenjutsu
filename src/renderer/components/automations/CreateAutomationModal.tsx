import React, { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { extractVariables, sanitizeAutomationCode } from '../../utils/automationVariables';

export const CreateAutomationModal: React.FC = () => {
  const {
    isCreateAutomationModalOpen,
    setIsCreateAutomationModalOpen,
    addAutomation,
    setIsAiPromptModalOpen,
  } = useProfiles();
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState(
    `console.log('Iniciando automação...');\nawait page.goto('https://google.com', { waitUntil: 'domcontentloaded' });\nawait page.waitForTimeout(2000);\nconsole.log('Finalizado com sucesso!');`
  );
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const detectedVariables = useMemo(() => extractVariables(code), [code]);

  const handleAddTag = (tag: string) => {
    const cleaned = tag.trim().toLowerCase();
    if (cleaned && !tags.includes(cleaned)) {
      setTags([...tags, cleaned]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleKeyDownTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
      setTagInput('');
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    addAutomation({
      name: name.trim(),
      description: description.trim() || undefined,
      code: sanitizeAutomationCode(code),
      tags,
    });

    handleClose();
  };

  const handleClose = () => {
    setIsCreateAutomationModalOpen(false);
    setName('');
    setDescription('');
    setCode(
      `console.log('Iniciando automação...');\nawait page.goto('https://google.com', { waitUntil: 'domcontentloaded' });\nawait page.waitForTimeout(2000);\nconsole.log('Finalizado com sucesso!');`
    );
    setTags([]);
    setTagInput('');
  };

  return (
    <Modal
      isOpen={isCreateAutomationModalOpen}
      onClose={handleClose}
      title={t.automationsPage.createAutomation}
      maxWidth="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={handleClose}>
            {t.actions.cancel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSubmit()}
            disabled={!name.trim() || !code.trim()}
          >
            {t.automationsPage.createAutomation}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <Input
            label={t.automationsPage.name}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t.automationsPage.namePlaceholder}
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <Input
            label={t.automationsPage.description}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t.automationsPage.descriptionPlaceholder}
          />
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
            {t.automationsPage.tags}
          </label>
          <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-lg bg-[var(--muted-bg)] border border-[var(--border)] min-h-[36px] transition-colors focus-within:border-red-500/60 focus-within:ring-2 focus-within:ring-red-500/10">
            {tags.map(tag => (
              <Badge key={tag} label={tag} onRemove={() => handleRemoveTag(tag)} />
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleKeyDownTag}
              placeholder={tags.length === 0 ? 'Adicionar tags (Enter ou vírgula)...' : ''}
              className="flex-1 bg-transparent text-[12px] text-[var(--foreground)] focus:outline-none min-w-[80px] placeholder:text-[var(--muted)]"
            />
          </div>
        </div>

        {/* Code Editor */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
                {t.automationsPage.code}
              </label>
              <span className="text-[10px] text-[var(--muted)] font-mono">
                (page, context)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsAiPromptModalOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 transition-colors cursor-pointer"
            >
              <i className="ri-sparkling-2-line text-xs" />
              <span>{t.automationsPage.aiPromptButton}</span>
            </button>
          </div>

          <div className="relative rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--sidebar-primary)]">
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              rows={11}
              spellCheck={false}
              className="w-full bg-transparent text-[11.5px] font-mono text-[var(--foreground)] p-3 focus:outline-none resize-none leading-relaxed"
              placeholder="// Insira seu código Playwright aqui&#10;await page.goto('https://...');"
            />
          </div>
          {detectedVariables.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] font-medium text-red-500 flex items-center gap-1">
                <i className="ri-variable-line text-xs" />
                Variáveis:
              </span>
              {detectedVariables.map(v => (
                <span
                  key={v}
                  className="inline-flex items-center text-[10.5px] font-mono font-medium px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20"
                >
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[10.5px] text-[var(--muted)]">
              {t.automationsPage.codeHint}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
};
