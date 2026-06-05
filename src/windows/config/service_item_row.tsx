import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icons } from '../../components/icons'
import { ConfigSwitch } from './config_components'

export interface ServiceItemRowProps {
    instanceKey: string
    isEnabled: boolean
    canDelete: boolean
    canMoveUp: boolean
    canMoveDown: boolean
    name: string
    svcKey: string
    onToggle: (instanceKey: string) => void
    onEdit: (instanceKey: string) => void
    onRemove: (instanceKey: string) => void
    onMoveUp: (instanceKey: string) => void
    onMoveDown: (instanceKey: string) => void
}

export function ServiceItemRow({
    instanceKey,
    isEnabled,
    canDelete,
    canMoveUp,
    canMoveDown,
    name,
    svcKey,
    onToggle,
    onEdit,
    onRemove,
    onMoveUp,
    onMoveDown,
}: ServiceItemRowProps): React.ReactElement {
    const { t } = useTranslation()
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: instanceKey })

    return (
        <div
            ref={setNodeRef}
            data-testid="svc-item"
            data-service-key={instanceKey}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                transition,
                transform: CSS.Transform.toString(transform),
                opacity: isDragging ? 0.5 : (isEnabled ? 1 : 0.58),
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
            <span data-testid="svc-drag-handle" {...attributes} {...listeners} style={{ color: 'var(--text-mute)', cursor: 'grab', display: 'inline-flex' }}>
                <Icons.Drag size={14} />
            </span>
            <div
                className="svc-tile"
                style={{ color: 'var(--text-dim)' }}
            >
                {svcKey.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
            </div>
            <ConfigSwitch on={isEnabled} onChange={() => { onToggle(instanceKey); }} testId="svc-toggle" />
            <button
                data-testid="svc-move-up"
                className="btn ghost icon"
                disabled={!canMoveUp}
                title={t('ui.up')}
                onClick={() => { onMoveUp(instanceKey); }}
                style={{ color: canMoveUp ? 'var(--text-dim)' : 'var(--text-mute)' }}
            >
                <Icons.ChevUp size={14} />
            </button>
            <button
                data-testid="svc-move-down"
                className="btn ghost icon"
                disabled={!canMoveDown}
                title={t('ui.down')}
                onClick={() => { onMoveDown(instanceKey); }}
                style={{ color: canMoveDown ? 'var(--text-dim)' : 'var(--text-mute)' }}
            >
                <Icons.Chev size={14} />
            </button>
            <button
                data-testid="svc-edit"
                className="btn ghost sm"
                onClick={() => { onEdit(instanceKey); }}
            >
                <Icons.Settings size={14} />
                <span>{t('service.edit')}</span>
            </button>
            <button
                data-testid="svc-delete"
                className="btn ghost sm"
                style={{ color: canDelete ? 'var(--danger)' : 'var(--text-mute)' }}
                disabled={!canDelete}
                onClick={() => { onRemove(instanceKey); }}
            >
                <Icons.Trash size={14} />
                <span>{t('service.remove')}</span>
            </button>
        </div>
    )
}
