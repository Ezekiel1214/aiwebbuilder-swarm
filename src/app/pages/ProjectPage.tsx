import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'
import { ProjectSnapshot } from '@/state/types'
import AgentSwarmPanel from '@/orchestrator/AgentSwarmPanel'

type Project = Database['public']['Tables']['projects']['Row']
type Projection = Database['public']['Tables']['project_projections']['Row']

interface MutateResponse {
  projectId: string
  seq: number
  snapshot: ProjectSnapshot
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [renameInput, setRenameInput] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  // Query for project metadata
  const { 
    data: project, 
    isLoading: isLoadingProject,
    error: projectError 
  } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      if (!id) throw new Error('No project ID')
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data as Project
    },
    enabled: !!id,
  })

  // Query for projection snapshot (event-sourced state)
  const {
    data: projection,
    isLoading: isLoadingProjection,
  } = useQuery({
    queryKey: ['projection', id],
    queryFn: async () => {
      if (!id) throw new Error('No project ID')
      const { data, error } = await supabase
        .from('project_projections')
        .select('*')
        .eq('project_id', id)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = not found (no events yet)
        throw error
      }
      
      return data as Projection | null
    },
    enabled: !!id,
  })

  const snapshot =
    projection?.snapshot &&
    typeof projection.snapshot === 'object' &&
    !Array.isArray(projection.snapshot)
      ? (projection.snapshot as ProjectSnapshot)
      : undefined

  // Get project name from snapshot or fallback to project metadata
  const projectName = snapshot?.name || project?.name || 'Untitled Project'

  // Mutation for renaming project
  const renameMutation = useMutation({
    mutationFn: async (newName: string): Promise<MutateResponse> => {
      if (!id || !user) throw new Error('Not authenticated')
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mutate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            projectId: id,
            baseSeq: projection?.head_seq,
            proposal: {
              type: 'project.rename',
              payload: { name: newName },
            },
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        if (response.status === 409) {
          throw new Error('Conflict: Project was modified by another user. Please refresh.')
        }
        throw new Error(error.error || 'Failed to rename project')
      }

      return response.json()
    },
    onSuccess: (data) => {
      // Update local cache with new snapshot
      queryClient.setQueryData(['projection', id], {
        project_id: data.projectId,
        head_seq: data.seq,
        snapshot: data.snapshot,
        updated_at: new Date().toISOString(),
      })
      setIsRenaming(false)
      setRenameInput('')
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to rename')
    },
  })

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameInput.trim() || renameInput === projectName) {
      setIsRenaming(false)
      return
    }
    renameMutation.mutate(renameInput.trim())
  }

  const isLoading = isLoadingProject || isLoadingProjection

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (projectError || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">
            {projectError instanceof Error ? projectError.message : 'Project not found'}
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="text-blue-600 hover:underline"
          >
            Back to projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/projects')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              
              {/* Project Name with Rename */}
              <div className="flex items-center gap-2">
                {isRenaming ? (
                  <form onSubmit={handleRename} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={renameInput}
                      onChange={(e) => setRenameInput(e.target.value)}
                      placeholder={projectName}
                      className="px-2 py-1 border border-gray-300 rounded text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={renameMutation.isPending}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRenaming(false)
                        setRenameInput('')
                      }}
                      className="px-3 py-1 text-gray-600 text-sm hover:text-gray-900"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold text-gray-900">{projectName}</h1>
                    <button
                      onClick={() => {
                        setRenameInput(projectName)
                        setIsRenaming(true)
                        setError('')
                      }}
                      className="text-gray-400 hover:text-gray-600 text-sm"
                      title="Rename project"
                    >
                      ✎
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">/{project.slug}</span>
              {projection && (
                <span className="text-xs text-gray-400">
                  seq: {projection.head_seq}
                </span>
              )}
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
                Publish
              </button>
            </div>
          </div>
          
          {error && (
            <div className="mt-2 text-sm text-red-600">{error}</div>
          )}
          {renameMutation.isPending && (
            <div className="mt-2 text-sm text-blue-600">Saving...</div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Editor Canvas - Placeholder */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow min-h-[600px] p-8">
              <div className="border-2 border-dashed border-gray-300 rounded-lg h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-500 mb-4">Editor Canvas</p>
                  <p className="text-sm text-gray-400">
                    Event-sourced architecture: {projection?.head_seq || 0} events
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Current state: {JSON.stringify(projection?.snapshot || {})}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Swarm Panel */}
          <div className="lg:col-span-1">
            <AgentSwarmPanel projectId={project.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
