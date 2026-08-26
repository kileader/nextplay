import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { OnboardingProvider } from './context/OnboardingContext'
import App from './App.tsx'
import RankingsPage from './pages/RankingsPage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import SignupPage from './pages/SignupPage.tsx'
import MyGamesPage from './pages/MyGamesPage.tsx'
import './index.css'

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <>
      <AuthProvider>
        <OnboardingProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<App />}>
                <Route index element={<RankingsPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="signup" element={<SignupPage />} />
                <Route path="my-games" element={<MyGamesPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </OnboardingProvider>
      </AuthProvider>
      <Analytics />
      <SpeedInsights />
    </>
  </StrictMode>,
)
