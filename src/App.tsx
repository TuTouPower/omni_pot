import React, { Suspense } from 'react'
import { ToastContainer } from './components/toast'

const TranslateWindow = React.lazy(() => import('./windows/translate'))
const WelcomeWindow = React.lazy(() => import('./windows/welcome'))
const ConfigWindow = React.lazy(() => import('./windows/config'))
const ScreenshotWindow = React.lazy(() => import('./windows/screenshot'))
const RecognizeWindow = React.lazy(() => import('./windows/recognize'))
const DictWindow = React.lazy(() => import('./windows/dict'))
const UpdaterWindow = React.lazy(() => import('./windows/updater'))
const TrayWindow = React.lazy(() => import('./windows/tray'))

function getLabel(): string {
  return window.location.hash.replace(/^#/, '') || 'translate'
}

function renderWindow(label: string): React.ReactElement {
  switch (label) {
    case 'translate':
      return <Suspense fallback={<div />}><TranslateWindow /></Suspense>
    case 'welcome':
      return <Suspense fallback={<div />}><WelcomeWindow /></Suspense>
    case 'daemon':
      return <></>
    case 'config':
      return <Suspense fallback={<div />}><ConfigWindow /></Suspense>
    case 'screenshot':
      return <Suspense fallback={<div />}><ScreenshotWindow /></Suspense>
    case 'recognize':
      return <Suspense fallback={<div />}><RecognizeWindow /></Suspense>
    case 'dict':
      return <Suspense fallback={<div />}><DictWindow /></Suspense>
    case 'updater':
      return <Suspense fallback={<div />}><UpdaterWindow /></Suspense>
    case 'tray':
      return <Suspense fallback={<div />}><TrayWindow /></Suspense>
    default:
      return <Suspense fallback={<div />}><TranslateWindow /></Suspense>
  }
}

export default function App(): React.ReactElement {
  const label = getLabel()

  return (
    <>
      {renderWindow(label)}
      <ToastContainer />
    </>
  )
}
