import { Route, Routes } from "react-router";
import { LoginPage } from "./pages/LoginPage";
import { PublicOnlyRoute } from "./auth/routes";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
    </Routes>
  );
}
