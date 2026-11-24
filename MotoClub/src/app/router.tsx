import { lazy, Suspense } from 'react'
import { createBrowserRouter, Link } from 'react-router'
import AppLayout from './AppLayout'
import { useLocale } from '../shared/i18n'

const SettingsPage = lazy(() => import('../pages/SettingsPage'))
const ReportsPage = lazy(() => import('../pages/ReportsPage'))
const ModerationPage = lazy(() => import('../pages/ModerationPage'))
const NotificationsPage = lazy(() => import('../pages/NotificationsPage'))
const MaintenancePage = lazy(() => import('../pages/MaintenancePage'))
const FeedPage = lazy(() => import('../pages/FeedPage'))
const TripsPage = lazy(() => import('../pages/TripsPage'))
const CommunitiesPage = lazy(() => import('../pages/CommunitiesPage'))
const CommunityPage = lazy(() => import('../pages/CommunityPage'))
const MarketPage = lazy(() => import('../pages/MarketPage'))
const RoutesPage = lazy(() => import('../pages/RoutesPage'))
const RoutePage = lazy(() => import('../pages/RoutePage'))
const MessagesPage = lazy(() => import('../pages/MessagesPage'))
const DialogPage = lazy(() => import('../pages/DialogPage'))
const MapPage = lazy(() => import('../pages/MapPage'))
const GaragePage = lazy(() => import('../pages/GaragePage'))
const FriendsPage = lazy(() => import('../pages/FriendsPage'))
const ProfilePage = lazy(() => import('../pages/ProfilePage'))
const AuthPage = lazy(() => import('../pages/AuthPage'))

function PageLoader() { const { t } = useLocale(); return <div className="loading-block" role="status">{t("Загружаю страницу…")}</div> }
function wrap(Page: React.LazyExoticComponent<() => React.JSX.Element>) { return <Suspense fallback={<PageLoader />}><Page /></Suspense> }

function NotFoundPage() {
  const { t } = useLocale()
  return <section className="state-panel state-empty"><h1>404</h1><p>{t("Страница не найдена")}</p><Link className="button button-primary" to="/">{t("Вернуться в ленту")}</Link></section>
}

export const router = createBrowserRouter([
  { element: <AppLayout />, children: [
    { path: '/settings', element: wrap(SettingsPage) },
    { path: '/reports', element: wrap(ReportsPage) },
    { path: '/moderation', element: wrap(ModerationPage) },
    { path: '/', element: wrap(FeedPage) },
    { path: '/trips', element: wrap(TripsPage) },
    { path: '/communities', element: wrap(CommunitiesPage) },
    { path: '/communities/:id', element: wrap(CommunityPage) },
    { path: '/market', element: wrap(MarketPage) },
    { path: '/routes', element: wrap(RoutesPage) },
    { path: '/routes/:id', element: wrap(RoutePage) },
    { path: '/messages', element: wrap(MessagesPage) },
    { path: '/messages/:userId', element: wrap(DialogPage) },
    { path: '/map', element: wrap(MapPage) },
    { path: '/notifications', element: wrap(NotificationsPage) },
    { path: '/garage/:motorcycleId/maintenance', element: wrap(MaintenancePage) },
    { path: '/garage/:motorcycleId/maintenance/new', element: wrap(MaintenancePage) },
    { path: '/garage/:motorcycleId/maintenance/:recordId/edit', element: wrap(MaintenancePage) },
    { path: '/garage', element: wrap(GaragePage) },
    { path: '/friends', element: wrap(FriendsPage) },
    { path: '/profile', element: wrap(ProfilePage) },
    { path: '/login', element: wrap(AuthPage) },
    { path: '/register', element: wrap(AuthPage) },
    { path: '*', element: <NotFoundPage/> },
  ] },
])
