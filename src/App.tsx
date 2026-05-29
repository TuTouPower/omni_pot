import React from 'react'
import TranslateWindow from './windows/translate'
import WelcomeWindow from './windows/welcome'
import ConfigWindow from './windows/config'
import ScreenshotWindow from './windows/screenshot'
import RecognizeWindow from './windows/recognize'
import DictWindow from './windows/dict'
import UpdaterWindow from './windows/updater'
import TrayWindow from './windows/tray'

function getLabel(): string {
  return window.location.hash.replace(/^#/, '') || 'translate'
}

export default function App(): React.ReactElement {
  const label = getLabel()

  switch (label) {
    case 'translate':
      return <TranslateWindow />
    case 'welcome':
      return <WelcomeWindow />
    case 'daemon':
      return <></>
    case 'config':
      return <ConfigWindow />
    case 'screenshot':
      return <ScreenshotWindow />
    case 'recognize':
      return <RecognizeWindow />
    case 'dict':
      return <DictWindow />
    case 'updater':
      return <UpdaterWindow />
    case 'tray':
      return <TrayWindow />
    default:
      return <TranslateWindow />
  }
}
