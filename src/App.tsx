import React, { Suspense } from 'react'
import { Spinner } from '@heroui/react'

const TranslateWindow = React.lazy(() => import('./windows/translate'))
const ConfigWindow = React.lazy(() => import('./windows/config'))
const ScreenshotWindow = React.lazy(() => import('./windows/screenshot'))
const RecognizeWindow = React.lazy(() => import('./windows/recognize'))
const DictWindow = React.lazy(() => import('./windows/dict'))

function getLabel(): string {
  return window.location.hash.replace(/^#/, '') || 'translate'
}

export default function App(): React.ReactElement {
  const label = getLabel()
  console.log('[App] rendering label:', label)

  const child = (() => {
    switch (label) {
      case 'translate':
      case 'daemon':
        return <TranslateWindow />
      case 'config':
        return <ConfigWindow />
      case 'screenshot':
        return <ScreenshotWindow />
      case 'recognize':
        return <RecognizeWindow />
      case 'dict':
        return <DictWindow />
      case 'updater':
        return <div className="p-4 text-center">{label} window (coming soon)</div>
      default:
        return <TranslateWindow />
    }
  })()

  return <Suspense fallback={<Spinner />}>{child}</Suspense>
}
