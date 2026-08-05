/**
 * Copyright (c) 2026 Priyanshu Biswal
 * SPDX-License-Identifier: MIT
 */

import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TelemetryProvider } from "@/telemetry";

const NT4_ADDRESS_STORAGE_KEY = "voyager.nt4.address";
const DEFAULT_NT4_ADDRESS = "9999";

function sanitizeNt4Address(address: string): string {
  const cleaned = address.trim();
  return cleaned.length > 0 ? cleaned : DEFAULT_NT4_ADDRESS;
}

function VoyagerRoot(): React.ReactElement {
  const [nt4Address, setNt4AddressState] = useState<string>(() => {
    return sanitizeNt4Address(localStorage.getItem(NT4_ADDRESS_STORAGE_KEY) ?? DEFAULT_NT4_ADDRESS);
  });

  const setNt4Address = useCallback((address: string): void => {
    const cleanedAddress = sanitizeNt4Address(address);
    localStorage.setItem(NT4_ADDRESS_STORAGE_KEY, cleanedAddress);
    setNt4AddressState(cleanedAddress);
  }, []);

  useEffect(() => {
    localStorage.setItem(NT4_ADDRESS_STORAGE_KEY, nt4Address);
  }, [nt4Address]);

  return (
    <TooltipProvider>
      <TelemetryProvider key={nt4Address} address={nt4Address}>
        <App nt4Address={nt4Address} setNt4Address={setNt4Address} />
      </TelemetryProvider>
    </TooltipProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <VoyagerRoot />
  </React.StrictMode>,
);
