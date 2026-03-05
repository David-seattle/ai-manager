import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import WorkItemLayout, { WorkItemIndex } from "./components/WorkItemLayout";
import Overview from "./pages/Overview";
import DocumentPage from "./pages/DocumentPage";
import QuestionsPage from "./pages/QuestionsPage";
import DecisionsPage from "./pages/DecisionsPage";
import SessionsPlaceholder from "./pages/SessionsPlaceholder";

export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  {
    path: "/workitem/:id",
    element: <WorkItemLayout />,
    children: [
      { index: true, element: <WorkItemIndex /> },
      { path: "overview", element: <Overview /> },
      { path: "doc/:docType", element: <DocumentPage /> },
      { path: "questions", element: <QuestionsPage /> },
      { path: "decisions", element: <DecisionsPage /> },
      { path: "sessions", element: <SessionsPlaceholder /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
