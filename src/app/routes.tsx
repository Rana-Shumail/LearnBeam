import { createBrowserRouter } from "react-router";
import { AuthPage } from "./components/AuthPage";
import { Dashboard } from "./components/Dashboard";
import { CoursePage } from "./components/CoursePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AuthPage,
  },
  {
    path: "/dashboard",
    Component: Dashboard,
  },
  {
    path: "/course/:id",
    Component: CoursePage,
  },
]);