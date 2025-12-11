import { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../design-system'

/**
 * Creates a test wrapper with QueryClient that can be cleaned up.
 * Use this instead of creating QueryClient instances directly in tests.
 * 
 * @example
 * ```tsx
 * const { wrapper, queryClient } = createTestWrapper()
 * 
 * afterEach(() => {
 *   queryClient.clear()
 * })
 * 
 * render(<Component />, { wrapper })
 * ```
 */
export function createTestWrapper(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0, // Disable garbage collection time to prevent cache accumulation
        staleTime: 0, // Immediately consider data stale
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )

  return { wrapper, queryClient }
}

/**
 * Aggressively clears a QueryClient to free memory.
 * Use this in afterEach hooks for better memory management.
 */
export function clearQueryClient(queryClient: QueryClient) {
  // Remove all queries
  queryClient.removeQueries()
  // Clear the entire cache
  queryClient.clear()
  // Reset default options to ensure no lingering state
  queryClient.setDefaultOptions({
    queries: {
      gcTime: 0,
      staleTime: 0,
    },
    mutations: {
      gcTime: 0,
    },
  })
}


