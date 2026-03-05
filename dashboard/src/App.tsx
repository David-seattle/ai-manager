import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Landing from "./pages/Landing";
import WorkItemDetail from "./pages/WorkItemDetail";
import NotFound from "./pages/NotFound";

export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/workitem/:id", element: <WorkItemDetail /> },
  { path: "*", element: <NotFound /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
