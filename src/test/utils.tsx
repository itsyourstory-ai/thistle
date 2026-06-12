/**
 * Shared test utilities. Import from here instead of @testing-library/react
 * so tests always have the same providers and userEvent setup.
 */

import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";

export * from "@testing-library/react";
export { userEvent };

interface ProvidersOptions {
  /** Initial route path for MemoryRouter. Defaults to "/". */
  route?: string;
  /** Bring-your-own QueryClient for tests that need to pre-seed cache. */
  queryClient?: QueryClient;
}

/**
 * Creates a fresh QueryClient with sensible test defaults:
 * - retries disabled so failed queries fail immediately
 * - staleTime 0 so queries always re-fetch
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Wraps `ui` in QueryClientProvider + MemoryRouter and calls RTL `render`.
 * Use this for component tests that need routing or React Query context.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { route = "/", queryClient, ...renderOptions }: ProvidersOptions & RenderOptions = {},
) {
  const client = queryClient ?? createTestQueryClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient: client };
}
