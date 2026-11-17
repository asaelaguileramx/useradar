import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../lib/api.js", async (orig) => {
  const real = await orig();
  return { ...real, submitLead: vi.fn(), getInquiryStatus: vi.fn() };
});

import { submitLead, getInquiryStatus } from "../lib/api.js";
import { LocaleProvider } from "../components/ui.jsx";
import Landing from "../pages/Landing.jsx";
import SearchRequest from "../pages/SearchRequest.jsx";
import WholesaleInquiry from "../pages/WholesaleInquiry.jsx";
import QuoteWizard from "../pages/QuoteWizard.jsx";
import Track from "../pages/Track.jsx";

function renderAt(path, element, routePath = path.split("?")[0]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocaleProvider>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/listo/:token" element={<p>CONFIRMED</p>} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("landing", () => {
  it("shows three distinct paths with their own CTAs", () => {
    renderAt("/", <Landing />);
    expect(screen.getByText("Ya encontré un vehículo")).toBeInTheDocument();
    expect(screen.getByText("Ayúdame a encontrar uno")).toBeInTheDocument();
    expect(screen.getByText("Me interesan las subastas de dealers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cotizar mi vehículo/ })).toHaveAttribute("href", "/cotizar");
    expect(screen.getByRole("link", { name: /Solicitar ayuda/ })).toHaveAttribute("href", "/buscar");
    expect(screen.getByRole("link", { name: /Consultar opciones/ })).toHaveAttribute("href", "/subastas-dealers");
  });
  it("renders in English", () => {
    localStorage.setItem("radar_locale", "en");
    renderAt("/", <Landing />);
    expect(screen.getByText("Your next purchase starts here.")).toBeInTheDocument();
    expect(screen.getByText("I'm interested in dealer auctions")).toBeInTheDocument();
  });
});

describe("vehicle search form", () => {
  it("shows errors and does not submit when empty", async () => {
    renderAt("/buscar", <SearchRequest />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    expect(await screen.findByText("Revisa los campos marcados.")).toBeInTheDocument();
    expect(submitLead).not.toHaveBeenCalled();
  });

  it("submits once even on double click and goes to confirmation", async () => {
    let resolve;
    submitLead.mockImplementation(() => new Promise((r) => { resolve = r; }));
    renderAt("/buscar", <SearchRequest />);
    fireEvent.change(screen.getByLabelText("¿Qué vehículo buscas?"), { target: { value: "Toyota Tacoma" } });
    fireEvent.change(screen.getByLabelText(/Presupuesto total/), { target: { value: "15000" } });
    fireEvent.change(screen.getByLabelText("¿Dónde estás?"), { target: { value: "San Jose, CA" } });
    fireEvent.click(screen.getByLabelText("Para revender"));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana Pérez" } });
    fireEvent.change(screen.getByLabelText("Teléfono con WhatsApp"), { target: { value: "650 555 0101" } });
    const btn = screen.getByRole("button", { name: "Enviar solicitud" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(submitLead).toHaveBeenCalledTimes(1));
    const payload = submitLead.mock.calls[0][0];
    expect(payload).toMatchObject({ intent: "vehicle_search", vehicle: "Toyota Tacoma", budget: "15000", use: "resale", phone: "16505550101" });
    expect(payload).not.toHaveProperty("lot");
    resolve({ reference: "RAD-ABC123", token: "11111111-1111-1111-1111-111111111111", intent: "vehicle_search" });
    expect(await screen.findByText("CONFIRMED")).toBeInTheDocument();
  });

  it("shows a friendly error when the server rejects", async () => {
    submitLead.mockRejectedValue({ message: "rate_limited" });
    renderAt("/buscar", <SearchRequest />);
    fireEvent.change(screen.getByLabelText("¿Qué vehículo buscas?"), { target: { value: "Civic" } });
    fireEvent.change(screen.getByLabelText(/Presupuesto total/), { target: { value: "9000" } });
    fireEvent.change(screen.getByLabelText("¿Dónde estás?"), { target: { value: "Fresno" } });
    fireEvent.click(screen.getByLabelText("Uso personal"));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Teléfono con WhatsApp"), { target: { value: "6505550101" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    expect(await screen.findByText(/varias solicitudes/)).toBeInTheDocument();
  });
});

describe("wholesale form", () => {
  it("shows the disclosure before submission and requires acknowledgement", async () => {
    renderAt("/subastas-dealers", <WholesaleInquiry />);
    expect(screen.getByText(/Enviar esta solicitud no garantiza acceso ni representación/)).toBeInTheDocument();
    expect(screen.queryByText(/[Dd]epósito/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    expect(await screen.findByText("Confirma que leíste el aviso.")).toBeInTheDocument();
    expect(submitLead).not.toHaveBeenCalled();
  });
});

describe("existing vehicle wizard", () => {
  it("prefills the lot from the URL and computes the estimate", async () => {
    renderAt("/cotizar?lot=https://www.iaai.com/VehicleDetail/39876543", <QuoteWizard />, "/cotizar");
    expect(screen.getByLabelText("Enlace o número de lote")).toHaveValue("https://www.iaai.com/VehicleDetail/39876543");
    expect(screen.getByLabelText("IAA")).toBeChecked();
    fireEvent.change(screen.getByLabelText(/Tu oferta máxima/), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Total estimado")).toBeInTheDocument();
    expect(screen.getByText("$2,500")).toBeInTheDocument(); // 50% deposit
  });
  it("blocks step 1 without a valid lot", async () => {
    renderAt("/cotizar", <QuoteWizard />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText(/número de lote válido/)).toBeInTheDocument();
  });
});

describe("tracking", () => {
  it("shows status for a valid token without auction-only statuses for new types", async () => {
    getInquiryStatus.mockResolvedValue({ reference: "RAD-XYZ789", intent: "wholesale_inquiry", status: "NEW", created_at: "2026-11-17T04:00:00Z", history: [{ status: "NEW", at: "2026-11-17T04:00:00Z" }] });
    renderAt("/seguimiento/11111111-1111-1111-1111-111111111111", <Track />, "/seguimiento/:token");
    expect(await screen.findByText("RAD-XYZ789")).toBeInTheDocument();
    expect(screen.getByText("Consulta de subastas de dealers")).toBeInTheDocument();
    expect(screen.queryByText(/Ofertando|Auction Live/)).toBeNull();
  });
  it("handles an unknown token", async () => {
    getInquiryStatus.mockResolvedValue(null);
    renderAt("/seguimiento/11111111-1111-1111-1111-111111111111", <Track />, "/seguimiento/:token");
    expect(await screen.findByText(/No encontramos esa solicitud/)).toBeInTheDocument();
  });
});
