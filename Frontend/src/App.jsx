import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { Provider } from "react-redux";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "react-hot-toast";

import { useAppSelector } from "@/components/context/hooks";

import { store } from "@/components/context/store";

import { routes } from "./routes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
});

function AuthGuard({ children, roles }) {
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role))
    return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {routes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            route.path === "/login" ? (
              route.element
            ) : (
              <AuthGuard roles={route.roles}>{route.element}</AuthGuard>
            )
          }
        />
      ))}
    </Routes>
  );
}

const App = () => {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                border: "1px solid hsl(var(--border))",
              },
            }}
          />
        </Router>
      </QueryClientProvider>
    </Provider>
  );
};

export default App;
