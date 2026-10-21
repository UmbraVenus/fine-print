import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntApp, ConfigProvider } from 'antd'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/ibm-plex-mono/500.css'
import './index.css'
import App from './App.tsx'
import { NoAccess, unlock } from './app/access.tsx'
import { theme } from './theme.ts'

void unlock().then((ok) =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ConfigProvider theme={theme}>
        <AntApp>{ok ? <App /> : <NoAccess />}</AntApp>
      </ConfigProvider>
    </StrictMode>,
  ),
)
