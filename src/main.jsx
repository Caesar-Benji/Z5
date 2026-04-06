import React from "react";
import { createRoot } from "react-dom/client";
import MissionChecklist from "./MissionChecklist.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MissionChecklist />
  </React.StrictMode>
);
