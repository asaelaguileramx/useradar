import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import "./index.css";
import { LocaleProvider, Shell } from "./components/ui.jsx";
import Landing from "./pages/Landing.jsx";
import QuoteWizard from "./pages/QuoteWizard.jsx";
import SearchRequest from "./pages/SearchRequest.jsx";
import WholesaleInquiry from "./pages/WholesaleInquiry.jsx";
import Confirmation from "./pages/Confirmation.jsx";
import Track from "./pages/Track.jsx";

const Rep = lazy(() => import("./pages/Rep.jsx"));
const FlipCalculator = lazy(() => import("./legacy/FlipCalculator.jsx"));

function LegacyTrack() {
  const { token } = useParams();
  return <Navigate to={`/seguimiento/${token}`} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/cotizar" element={<QuoteWizard />} />
      <Route path="/buscar" element={<SearchRequest />} />
      <Route path="/subastas-dealers" element={<WholesaleInquiry />} />
      <Route path="/listo/:token" element={<Confirmation />} />
      <Route path="/seguimiento" element={<Track />} />
      <Route path="/seguimiento/:token" element={<Track />} />
      <Route path="/track/:token" element={<LegacyTrack />} />
      <Route path="/rep" element={<Suspense fallback={null}><Rep /></Suspense>} />
      <Route path="/calculadora-flip" element={<Suspense fallback={null}><FlipCalculator /></Suspense>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <Shell><AppRoutes /></Shell>
      </LocaleProvider>
    </BrowserRouter>
  </React.StrictMode>
);
