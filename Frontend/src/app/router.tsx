import { createBrowserRouter } from "react-router-dom";
import Landing from "../modules/marketing/pages/Landing";

export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
]);
