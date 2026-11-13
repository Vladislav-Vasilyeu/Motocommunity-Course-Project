import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router'
import AppLayout from './AppLayout'

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

function PageLoader() { return <div className="loading-block" role="status">Загружаю страницу…</div> }
function wrap(Page: React.LazyExoticComponent<() => React.JSX.Element>) { return <Suspense fallback={<PageLoader />}><Page /></Suspense> }

export const router = createBrowserRouter([
  { element: <AppLayout />, children: [
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
    { path: '/garage', element: wrap(GaragePage) },
    { path: '/friends', element: wrap(FriendsPage) },
    { path: '/profile', element: wrap(ProfilePage) },
    { path: '/login', element: wrap(AuthPage) },
    { path: '/register', element: wrap(AuthPage) },
  ] },
])
