import React from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'

export function ImageCard({ imageBase64 }: { imageBase64: string }): React.ReactElement {
    const { t } = useTranslation()

    return (
        <div className="card" style={{ padding: 6, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div
                data-testid="ocr-image"
                style={{
                    flex: 1,
                    borderRadius: 7,
                    background: 'var(--bg-sunk)',
                    border: '1px solid var(--line)',
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {imageBase64 ? (
                    <img
                        src={`data:image/png;base64,${imageBase64}`}
                        alt="captured"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-mute)', fontSize: 13 }}>
                        <Icons.Image size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                        <div>{t('recognize.waiting_screenshot')}</div>
                    </div>
                )}
            </div>
        </div>
    )
}
