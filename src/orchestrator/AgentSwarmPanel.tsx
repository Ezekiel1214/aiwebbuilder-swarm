import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface AgentSwarmPanelProps {
  projectId: string
}

interface AIResponse {
  result: string
  usage: {
    tokens_in: number
    tokens_out: number
    cost_usd: number
  }
}

export default function AgentSwarmPanel({ projectId }: AgentSwarmPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState<AIResponse | null>(null)

  const runAgentMutation = useMutation({
    mutationFn: async (promptText: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            project_id: projectId,
            prompt: promptText,
            provider: 'openai',
            model: 'gpt-4',
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        if (response.status === 402) {
          throw new Error('Budget exceeded. Please upgrade your plan.')
        }
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.')
        }
        throw new Error(error.message || 'Failed to run agent')
      }

      return response.json() as Promise<AIResponse>
    },
    onSuccess: (data) => {
      setResponse(data)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return
    runAgentMutation.mutate(prompt)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent Swarm</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What should the agents do?
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Create a hero section with headline and CTA button"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
        </div>

        <button
          type="submit"
          disabled={!prompt.trim() || runAgentMutation.isPending}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {runAgentMutation.isPending ? 'Running...' : 'Run Agent Swarm'}
        </button>
      </form>

      {runAgentMutation.isError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {runAgentMutation.error instanceof Error ? runAgentMutation.error.message : 'An error occurred'}
        </div>
      )}

      {response && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Result:</h3>
          <p className="text-sm text-gray-600 mb-3">{response.result}</p>
          <div className="text-xs text-gray-500 border-t pt-2">
            <p>Tokens: {response.usage.tokens_in} in / {response.usage.tokens_out} out</p>
            <p>Cost: ${response.usage.cost_usd.toFixed(4)} USD</p>
          </div>
        </div>
      )}
    </div>
  )
}
