import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AgentSwarmPanel from '@/orchestrator/AgentSwarmPanel'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ 
        data: { session: { access_token: 'test-token' } } 
      })),
    },
  },
}))

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('AgentSwarmPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the panel', () => {
    renderWithProviders(<AgentSwarmPanel projectId="test-project-id" />)
    expect(screen.getByText('Agent Swarm')).toBeInTheDocument()
    expect(screen.getByText('What should the agents do?')).toBeInTheDocument()
    expect(screen.getByText('Run Agent Swarm')).toBeInTheDocument()
  })

  it('should have disabled submit button when prompt is empty', () => {
    renderWithProviders(<AgentSwarmPanel projectId="test-project-id" />)
    const submitButton = screen.getByText('Run Agent Swarm')
    expect(submitButton).toBeDisabled()
  })

  it('should enable submit button when prompt has content', () => {
    renderWithProviders(<AgentSwarmPanel projectId="test-project-id" />)
    const textarea = screen.getByPlaceholderText(/e.g., Create a hero section/)
    const submitButton = screen.getByText('Run Agent Swarm')
    
    fireEvent.change(textarea, { target: { value: 'Test prompt' } })
    expect(submitButton).not.toBeDisabled()
  })

  it('should show loading state during submission', async () => {
    global.fetch = vi.fn(() =>
      new Promise<Response>(() => {}) // Never resolves to keep loading state
    ) as unknown as typeof fetch

    renderWithProviders(<AgentSwarmPanel projectId="test-project-id" />)
    const textarea = screen.getByPlaceholderText(/e.g., Create a hero section/)
    
    fireEvent.change(textarea, { target: { value: 'Test prompt' } })
    fireEvent.click(screen.getByText('Run Agent Swarm'))
    
    await waitFor(() => {
      expect(screen.getByText('Running...')).toBeInTheDocument()
    })
  })
})
