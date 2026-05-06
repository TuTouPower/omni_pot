import React, { Suspense } from 'react'
import { Spinner } from '@heroui/react'

const TranslateWindow = React.lazy(() => import('./windows/translate'))
const ConfigWindow = React.lazy(() => import('./windows/config'))

function getLabel(): string {
  return window.location.hash.replace(/^#/, '') || 'translate'
}

export default function App(): React.ReactElement {
  const label = getLabel()

  const child = (() => {
    switch (label) {
      case 'translate':
      case 'daemon':
        return <TranslateWindow />
      case 'config':
        return <ConfigWindow />
      case 'screenshot':
      case 'recognize':
      case 'updater':
        return <div className="p-4 text-center">{label} window (coming soon)</div>
      default:
        return <TranslateWindow />
    }
  })()

  return <Suspense fallback={<Spinner />}>{child}</Suspense>
}
