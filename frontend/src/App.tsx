import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { AuthProvider } from './components/AuthProvider'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { AuditPage } from './pages/AuditPage'
import { ComparePage } from './pages/ComparePage'
import { ConflictsPage } from './pages/ConflictsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DocumentPage } from './pages/DocumentPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { EvaluationPage } from './pages/EvaluationPage'
import { LoginPage } from './pages/LoginPage'
import { ObligationReviewPage } from './pages/ObligationReviewPage'
import { ProfilesPage } from './pages/ProfilesPage'
import { ReviewQueuePage } from './pages/ReviewQueuePage'
import { RulesPage } from './pages/RulesPage'
import { UsersPage } from './pages/UsersPage'

function NotFound() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/" className="text-sm text-brand underline">
        Back to the overview
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="review" element={<ReviewQueuePage />} />
            <Route path="obligations/:id" element={<ObligationReviewPage />} />
            <Route path="rules" element={<RulesPage />} />
            <Route path="conflicts" element={<ConflictsPage />} />
            <Route path="profiles" element={<ProfilesPage />} />
            <Route path="evaluations/:id" element={<EvaluationPage />} />
            <Route
              path="audit"
              element={
                <RequireAuth role="reviewer">
                  <AuditPage />
                </RequireAuth>
              }
            />
            <Route path="documents/:id" element={<DocumentPage />} />
            <Route path="documents/:id/compare" element={<ComparePage />} />
            <Route
              path="users"
              element={
                <RequireAuth role="admin">
                  <UsersPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
