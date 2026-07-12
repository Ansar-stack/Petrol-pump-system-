import { createRoot } from "react-dom/client";

import "./components/styles/index.css";
import App from "./App.jsx";
import { AppWrapper } from "./components/features/common/PageMeta.jsx";
import { I18nProvider } from "./components/context/i18n.jsx";

createRoot(document.getElementById("root")).render(
  <I18nProvider>
    <AppWrapper>
      <App />
    </AppWrapper>
  </I18nProvider>,
);
