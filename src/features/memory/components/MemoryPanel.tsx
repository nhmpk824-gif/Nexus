import { useState, type KeyboardEvent } from 'react'
import {
  resolveLocalizedText,
  type LocalizedText,
} from '../../../lib/uiLanguage'
import type {
  DailyMemoryEntry,
  MemoryItem,
  MemorySearchMode,
  UiLanguage,
} from '../../../types'

type MemoryPanelProps = {
  assistantName: string
  dailyEntries: DailyMemoryEntry[]
  embeddingModel: string
  memories: MemoryItem[]
  onAddMemory: (content: string) => void
  onClearDaily: () => void
  onRemove: (id: string) => void
  onRemoveDailyEntry?: (id: string, day: string) => void
  onUpdateDailyEntry?: (id: string, day: string, content: string) => void
  onUpdateMemory: (id: string, content: string) => void
  searchMode: MemorySearchMode
  uiLanguage: UiLanguage
}

const MEMORY_CATEGORY_LABELS: Record<MemoryItem['category'], LocalizedText> = {
  profile: {
    'zh-CN': '设定',
    'en-US': 'Profile',
  },
  preference: {
    'zh-CN': '喜好',
    'en-US': 'Preference',
  },
  goal: {
    'zh-CN': '目标',
    'en-US': 'Goal',
  },
  habit: {
    'zh-CN': '习惯',
    'en-US': 'Habit',
  },
  manual: {
    'zh-CN': '手动',
    'en-US': 'Manual',
  },
  feedback: {
    'zh-CN': '反馈',
    'en-US': 'Feedback',
  },
  project: {
    'zh-CN': '项目',
    'en-US': 'Project',
  },
  reference: {
    'zh-CN': '引用',
    'en-US': 'Reference',
  },
}

const SEARCH_MODE_LABELS: Record<MemorySearchMode, LocalizedText> = {
  keyword: {
    'zh-CN': '关键词检索',
    'en-US': 'Keyword search',
  },
  hybrid: {
    'zh-CN': '混合检索',
    'en-US': 'Hybrid search',
  },
  vector: {
    'zh-CN': '向量检索',
    'en-US': 'Vector search',
  },
}

function translateCopy(uiLanguage: UiLanguage, copy: LocalizedText) {
  return resolveLocalizedText(uiLanguage, copy)
}

function getCategoryLabel(category: MemoryItem['category'], uiLanguage: UiLanguage) {
  return translateCopy(uiLanguage, MEMORY_CATEGORY_LABELS[category])
}

function getSearchModeLabel(searchMode: MemorySearchMode, uiLanguage: UiLanguage) {
  return translateCopy(uiLanguage, SEARCH_MODE_LABELS[searchMode])
}

function getSearchModeSummary(searchMode: MemorySearchMode, uiLanguage: UiLanguage) {
  const modeLabel = getSearchModeLabel(searchMode, uiLanguage)

  return translateCopy(uiLanguage, {
    'zh-CN': `当前会话、每日日志和长期记忆会一起参与回复；检索模式现在是 ${modeLabel}。`,
    'en-US': `Current chat, daily diary, and long-term memory all contribute to replies. The current retrieval mode is ${modeLabel}.`,
  })
}

export function MemoryPanel({
  assistantName,
  dailyEntries,
  embeddingModel,
  memories,
  onAddMemory,
  onClearDaily,
  onRemove,
  onRemoveDailyEntry,
  onUpdateDailyEntry,
  onUpdateMemory,
  searchMode,
  uiLanguage,
}: MemoryPanelProps) {
  const t = (copy: LocalizedText) => translateCopy(uiLanguage, copy)
  const [manualMemory, setManualMemory] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleAddMemory() {
    const content = manualMemory.trim()
    if (!content) return

    onAddMemory(content)
    setManualMemory('')
  }

  function startEditing(id: string, content: string) {
    setEditingId(id)
    setEditingContent(content)
    setEditError(null)
    setDeletingId(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditingContent('')
    setEditError(null)
  }

  function saveMemoryEdit(id: string) {
    const trimmed = editingContent.trim()
    if (!trimmed) {
      setEditError(t({
        'zh-CN': '记忆内容不能为空。',
        'en-US': 'Memory content cannot be empty.',
      }))
      return
    }

    try {
      onUpdateMemory(id, trimmed)
      cancelEditing()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t({
        'zh-CN': '编辑记忆失败，请稍后再试。',
        'en-US': 'Failed to edit memory. Please try again later.',
      }))
    }
  }

  function saveDailyEdit(id: string, day: string) {
    const trimmed = editingContent.trim()
    if (!trimmed) {
      setEditError(t({
        'zh-CN': '日志内容不能为空。',
        'en-US': 'Diary content cannot be empty.',
      }))
      return
    }

    try {
      onUpdateDailyEntry?.(id, day, trimmed)
      cancelEditing()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t({
        'zh-CN': '编辑日志失败，请稍后再试。',
        'en-US': 'Failed to edit diary entry. Please try again later.',
      }))
    }
  }

  function confirmDelete(id: string) {
    setDeletingId(id)
    cancelEditing()
  }

  function cancelDelete() {
    setDeletingId(null)
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      cancelEditing()
      cancelDelete()
    }
  }

  return (
    <section className="memory-card">
      <div className="memory-card__header">
        <div>
          <p className="eyebrow">{t({
            'zh-CN': '记忆系统',
            'en-US': 'Memory system',
          })}</p>
          <h3>{t({
            'zh-CN': '三层记忆',
            'en-US': 'Three-layer memory',
          })}</h3>
          <p className="memory-card__hint">{getSearchModeSummary(searchMode, uiLanguage)}</p>
        </div>
        <span className="memory-count">{memories.length}</span>
      </div>

      <div className="memory-card__meta">
        <span className="memory-pill__category">
          {t({
            'zh-CN': '长期',
            'en-US': 'Long-term',
          })} {memories.length}
        </span>
        <span className="memory-pill__category">
          {t({
            'zh-CN': '日志',
            'en-US': 'Diary',
          })} {dailyEntries.length}
        </span>
        <span className="memory-pill__category">{embeddingModel}</span>
      </div>

      <div className="memory-card__composer">
        <textarea
          rows={3}
          value={manualMemory}
          placeholder={t({
            'zh-CN': '手动补一条长期记忆，例如：我更喜欢安静一点的陪伴方式。',
            'en-US': 'Add a long-term memory manually, for example: I prefer a quieter companion style.',
          })}
          onChange={(event) => setManualMemory(event.target.value)}
        />
        <div className="memory-card__actions">
          <button type="button" className="ghost-button" onClick={handleAddMemory}>
            {t({
              'zh-CN': '保存到长期记忆',
              'en-US': 'Save to long-term memory',
            })}
          </button>
          <button type="button" className="ghost-button" onClick={onClearDaily}>
            {t({
              'zh-CN': '清空今日日志',
              'en-US': "Clear today's diary",
            })}
          </button>
        </div>
      </div>

      <div className="memory-list">
        {memories.length ? (
          memories.map((memory) => (
            <article key={memory.id} className="memory-pill" onKeyDown={handleKeyDown}>
              <span className="memory-pill__category">{getCategoryLabel(memory.category, uiLanguage)}</span>

              {editingId === memory.id ? (
                <div className="memory-pill__edit">
                  <textarea
                    rows={2}
                    value={editingContent}
                    onChange={(event) => setEditingContent(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        saveMemoryEdit(memory.id)
                      }
                    }}
                    autoFocus
                  />
                  {editError && <p className="memory-pill__error">{editError}</p>}
                  <div className="memory-pill__actions">
                    <button type="button" onClick={() => saveMemoryEdit(memory.id)}>
                      {t({
                        'zh-CN': '保存',
                        'en-US': 'Save',
                      })}
                    </button>
                    <button type="button" onClick={cancelEditing}>
                      {t({
                        'zh-CN': '取消',
                        'en-US': 'Cancel',
                      })}
                    </button>
                  </div>
                </div>
              ) : deletingId === memory.id ? (
                <div className="memory-pill__confirm">
                  <p>{t({
                    'zh-CN': '确认删除这条记忆？',
                    'en-US': 'Delete this memory?',
                  })}</p>
                  <div className="memory-pill__actions">
                    <button
                      type="button"
                      onClick={() => {
                        onRemove(memory.id)
                        cancelDelete()
                      }}
                    >
                      {t({
                        'zh-CN': '删除',
                        'en-US': 'Delete',
                      })}
                    </button>
                    <button type="button" onClick={cancelDelete}>
                      {t({
                        'zh-CN': '取消',
                        'en-US': 'Cancel',
                      })}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p>{memory.content}</p>
                  <div className="memory-pill__actions">
                    <button type="button" onClick={() => startEditing(memory.id, memory.content)}>
                      {t({
                        'zh-CN': '编辑',
                        'en-US': 'Edit',
                      })}
                    </button>
                    <button type="button" onClick={() => confirmDelete(memory.id)}>
                      {t({
                        'zh-CN': '删除',
                        'en-US': 'Delete',
                      })}
                    </button>
                  </div>
                </>
              )}
            </article>
          ))
        ) : (
          <div className="memory-empty">
            {t({
              'zh-CN': '现在还没有积累到长期记忆。多聊几句，或者手动补一条，她就会慢慢记住你。',
              'en-US': 'There is no long-term memory yet. Talk a little more or add one manually, and it will gradually learn about you.',
            })}
          </div>
        )}
      </div>

      <div className="memory-card__daily">
        <div className="settings-section__title-row">
          <div>
            <h4>{t({
              'zh-CN': '今日日志预览',
              'en-US': "Today's diary preview",
            })}</h4>
            <p className="settings-drawer__hint">
              {t({
                'zh-CN': '这里显示最近的日志片段，用来承接上下文，不会把整段聊天原样塞给模型。',
                'en-US': 'This shows recent diary fragments used for context, without dumping the entire raw chat into the model.',
              })}
            </p>
          </div>
        </div>

        <div className="memory-list">
          {dailyEntries.length ? (
            dailyEntries.map((entry) => (
              <article key={entry.id} className="memory-pill memory-pill--daily" onKeyDown={handleKeyDown}>
                <span className="memory-pill__category">
                  {entry.role === 'user'
                    ? t({
                        'zh-CN': '你',
                        'en-US': 'You',
                      })
                    : assistantName}
                </span>

                {editingId === entry.id ? (
                  <div className="memory-pill__edit">
                    <textarea
                      rows={2}
                      value={editingContent}
                      onChange={(event) => setEditingContent(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          saveDailyEdit(entry.id, entry.day)
                        }
                      }}
                      autoFocus
                    />
                    {editError && <p className="memory-pill__error">{editError}</p>}
                    <div className="memory-pill__actions">
                      <button type="button" onClick={() => saveDailyEdit(entry.id, entry.day)}>
                        {t({
                          'zh-CN': '保存',
                          'en-US': 'Save',
                        })}
                      </button>
                      <button type="button" onClick={cancelEditing}>
                        {t({
                          'zh-CN': '取消',
                          'en-US': 'Cancel',
                        })}
                      </button>
                    </div>
                  </div>
                ) : deletingId === entry.id ? (
                  <div className="memory-pill__confirm">
                    <p>{t({
                      'zh-CN': '确认删除这条日志？',
                      'en-US': 'Delete this diary entry?',
                    })}</p>
                    <div className="memory-pill__actions">
                      <button
                        type="button"
                        onClick={() => {
                          onRemoveDailyEntry?.(entry.id, entry.day)
                          cancelDelete()
                        }}
                      >
                        {t({
                          'zh-CN': '删除',
                          'en-US': 'Delete',
                        })}
                      </button>
                      <button type="button" onClick={cancelDelete}>
                        {t({
                          'zh-CN': '取消',
                          'en-US': 'Cancel',
                        })}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p>{entry.content}</p>
                    {(onUpdateDailyEntry || onRemoveDailyEntry) && (
                      <div className="memory-pill__actions">
                        {onUpdateDailyEntry && (
                          <button type="button" onClick={() => startEditing(entry.id, entry.content)}>
                            {t({
                              'zh-CN': '编辑',
                              'en-US': 'Edit',
                            })}
                          </button>
                        )}
                        {onRemoveDailyEntry && (
                          <button type="button" onClick={() => confirmDelete(entry.id)}>
                            {t({
                              'zh-CN': '删除',
                              'en-US': 'Delete',
                            })}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </article>
            ))
          ) : (
            <div className="memory-empty">
              {t({
                'zh-CN': '今天的日志还是空的。等你开始说话或聊天后，这里会自动积累当天的重要片段。',
                'en-US': "Today's diary is still empty. Once you start talking or chatting, important moments from today will accumulate here automatically.",
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
