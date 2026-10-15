import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Badge } from '../ui/Badge';
import { useI18n } from '../../context/I18nContext';

interface ProfileTagCellProps {
  profileId: string;
  tags: string[];
  onUpdateTags: (newTags: string[]) => void;
  allAppTags: string[];
}

export const ProfileTagCell: React.FC<ProfileTagCellProps> = ({
  tags,
  onUpdateTags,
  allAppTags,
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setInputVal('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleAddTag = (tagToAdd: string) => {
    const cleaned = tagToAdd.trim().replace(/^#/, '');
    if (!cleaned) return;
    if (!tags.includes(cleaned)) {
      onUpdateTags([...tags, cleaned]);
    }
    setInputVal('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateTags(tags.filter(t => t !== tagToRemove));
  };

  const handleToggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      handleRemoveTag(tag);
    } else {
      handleAddTag(tag);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputVal.trim()) {
        handleAddTag(inputVal);
      }
    }
  };

  // Filter available suggestions from other profiles/proxies
  const filteredSuggestions = allAppTags.filter(t =>
    t.toLowerCase().includes(inputVal.trim().toLowerCase())
  );

  const isExactMatch = allAppTags.some(
    t => t.toLowerCase() === inputVal.trim().toLowerCase()
  );

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      {/* Trigger: Clickable Tags Cell */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 flex-wrap cursor-pointer group/cell py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-[var(--muted-bg)]/60 transition-colors"
        title={t.profileTags.manageTags}
      >
        {tags && tags.length > 0 ? (
          <>
            {tags.map(tag => (
              <Badge key={tag} label={tag} />
            ))}
            <span className="w-5 h-5 rounded-md flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] opacity-0 group-hover/cell:opacity-100 transition-opacity">
              <i className="ri-add-line text-xs" />
            </span>
          </>
        ) : (
          <span className="text-[11.5px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1">
            <span className="opacity-40 group-hover/cell:opacity-0 transition-opacity">—</span>
            <span className="opacity-0 group-hover/cell:opacity-100 transition-opacity -ml-3 text-[11px] font-medium flex items-center gap-1">
              <i className="ri-add-line text-xs" />
              <span>{t.profileTags.tag}</span>
            </span>
          </span>
        )}
      </div>

      {/* Tags Popover / Dropdown */}
      {isOpen && (
        <div
          onClick={e => e.stopPropagation()}
          className="absolute top-[calc(100%+6px)] left-0 z-50 w-64 bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 shadow-xl animate-fade-in-scale select-none"
          style={{ boxShadow: 'var(--shadow-lg)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]/70">
            <span className="text-[11px] font-semibold text-[var(--foreground)] uppercase tracking-wider">
              {t.profileTags.title}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setInputVal('');
              }}
              className="w-5 h-5 flex items-center justify-center rounded text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xs" />
            </button>
          </div>

          {/* Current Attached Tags */}
          <div className="py-2.5">
            <div className="text-[10px] font-medium text-[var(--muted-fg)] pb-1.5">
              {t.profileTags.assigned} ({tags.length})
            </div>
            {tags.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap max-h-20 overflow-y-auto pr-0.5">
                {tags.map(tag => (
                  <Badge
                    key={tag}
                    label={tag}
                    onRemove={() => handleRemoveTag(tag)}
                  />
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-[var(--muted)] italic">
                {t.profileTags.noTagsAssigned}
              </span>
            )}
          </div>

          {/* Input to search / create new tag */}
          <div className="relative pt-1 pb-2">
            <div className="relative flex items-center">
              <i className="ri-hashtag text-[var(--muted)] text-xs absolute left-2 pointer-events-none" />
              <input
                autoFocus
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.profileTags.searchOrAddPlaceholder}
                className="w-full h-7 bg-[var(--muted-bg)] text-[11.5px] font-medium rounded-lg border border-[var(--border)] pl-6 pr-6 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/10 placeholder:text-[var(--muted)]"
              />
              {inputVal.trim() && (
                <button
                  type="button"
                  onClick={() => handleAddTag(inputVal)}
                  className="absolute right-1.5 w-4 h-4 flex items-center justify-center rounded text-red-500 hover:text-red-600 cursor-pointer"
                  title={t.profileTags.addTag}
                >
                  <i className="ri-check-line text-xs" />
                </button>
              )}
            </div>
          </div>

          {/* Suggestions List (Tags already used in the app) */}
          <div className="pt-1 border-t border-[var(--border)]/60">
            <div className="text-[10px] font-medium text-[var(--muted-fg)] pb-1">
              {inputVal.trim() && !isExactMatch ? t.profileTags.suggestions : t.profileTags.availableTags}
            </div>

            <div className="max-h-32 overflow-y-auto space-y-0.5 -mx-1 px-1">
              {/* Option to create brand new tag if typed */}
              {inputVal.trim() && !isExactMatch && (
                <button
                  type="button"
                  onClick={() => handleAddTag(inputVal)}
                  className="w-full flex items-center gap-2 px-2 py-1 text-[11.5px] rounded-lg text-red-500 hover:bg-red-500/8 transition-colors cursor-pointer text-left font-medium"
                >
                  <i className="ri-add-line text-xs" />
                  <span className="truncate">{t.profileTags.createTag(inputVal.trim())}</span>
                </button>
              )}

              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map(suggestedTag => {
                  const isAttached = tags.includes(suggestedTag);
                  return (
                    <button
                      key={suggestedTag}
                      type="button"
                      onClick={() => handleToggleTag(suggestedTag)}
                      className={clsx(
                        'w-full flex items-center justify-between px-2 py-1 text-[11.5px] rounded-lg transition-colors cursor-pointer text-left',
                        isAttached
                          ? 'bg-red-500/8 text-red-500 font-semibold'
                          : 'text-[var(--foreground)] hover:bg-[var(--muted-bg)]'
                      )}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <i className={clsx('ri-hashtag text-[11px]', isAttached ? 'text-red-500' : 'text-[var(--muted)]')} />
                        <span className="truncate">{suggestedTag}</span>
                      </div>
                      {isAttached ? (
                        <i className="ri-check-line text-xs text-red-500 ml-1" />
                      ) : (
                        <i className="ri-add-line text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100 ml-1" />
                      )}
                    </button>
                  );
                })
              ) : (
                !inputVal.trim() && (
                  <span className="text-[11px] text-[var(--muted)] italic px-2 py-1 block">
                    {t.profileTags.noOtherTags}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
