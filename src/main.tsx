import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { NT4Provider } from "@frc-web-components/react";


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <NT4Provider address="10.41.88.2">
      <App />
    </NT4Provider>
  </React.StrictMode>
);
  