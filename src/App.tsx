import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute'
import { APP_NAME } from './config/app'
import { AuthProvider } from './hooks/useAuth'
import { AppLayout } from './layouts/AppLayout'
import { isSupabaseConfigured, missingEnvVars } from './lib/supabase'
import { AgentDetailPage } from './pages/AgentDetailPage'
import { ChatPage } from './pages/ChatPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { RegisterPage } from './pages/RegisterPage'

/**
 * Shown instead of a blank screen when the build was made without Supabase
 * configuration - it names the exact variables that are missing.
 */
function MissingConfig() {
  return (
    <div className="fatal">
      <div className="fatal__card">
        <h1 className="fatal__title">{APP_NAME} is not configured</h1>
        <p className="fatal__text">
          The build is missing required environment variables:
        </p>
        <ul className="fatal__list">
          {missingEnvVars.map((name) => (
            <li key={name}>
              <code>Missing {name}</code>
            </li>
          ))}
        </ul>
        <p className="fatal__text">
          Locally, copy <code>.env.example</code> to <code>.env</code> and fill
          it in. For GitHub Pages, set them as repository variables and re-run
          the deploy workflow.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <MissingConfig />

  return (
    <ErrorBoundary>
      {/*
        HashRouter, not BrowserRouter: GitHub Pages has no server-side rewrite,
        so a deep link like /chat/<id> would 404 on refresh.
      */}
      <HashRouter>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnlyRoute>
                  <RegisterPage />
                </PublicOnlyRoute>
              }
            />

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<ProjectsPage />} />
              <Route path="/projects" element={<Navigate to="/" replace />} />
              <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
              <Route
                path="/projects/:projectId/agents/:agentId"
                element={<AgentDetailPage />}
              />
              <Route path="/chat/:conversationId" element={<ChatPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  )
}
