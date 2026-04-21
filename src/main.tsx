import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { initAvatarRestoreOnLogin } from "./lib/supabase";

// Restore custom profile picture after every OAuth re-login
initAvatarRestoreOnLogin();

createRoot(document.getElementById("root")!).render(<App />);
