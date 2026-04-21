import type { ComponentType } from "react";
import { createBrowserRouter } from "react-router";
import { AuthPage } from "./components/AuthPage";
import { AuthGuard } from "./components/AuthGuard";
import { Dashboard } from "./components/Dashboard";
import { CoursePage } from "./components/CoursePage";
import { ProfilePage } from "./components/ProfilePage";

function withAuth(Component: ComponentType) {
  return function ProtectedRoute() {
    return (
      <AuthGuard>
        <Component />
      </AuthGuard>
    );
  };
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AuthPage,
  },
  {
    path: "/dashboard",
    Component: withAuth(Dashboard),
  },
  {
    path: "/course/:id",
    Component: withAuth(CoursePage),
  },
  {
    path: "/profile",
    Component: withAuth(ProfilePage),
  },
]);
