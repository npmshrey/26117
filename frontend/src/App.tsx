import { Routes, Route } from "react-router-dom";
import { RoleProvider } from "./lib/RoleContext";
import Workspace from "./pages/Workspace";
import Documents from "./pages/Documents";
import ModelRouterPage from "./pages/ModelRouterPage";
import Sandbox from "./pages/Sandbox";
import Audit from "./pages/Audit";
import Outputs from "./pages/Outputs";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <RoleProvider>
      <Routes>
        <Route path="/" element={<Workspace />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/router" element={<ModelRouterPage />} />
        <Route path="/sandbox" element={<Sandbox />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/outputs" element={<Outputs />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </RoleProvider>
  );
}
