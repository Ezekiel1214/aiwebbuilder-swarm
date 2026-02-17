# AIWebBuilder Pro v3 - Changelog

## v3.0.0 - Foundation Release

### Added

#### Core Architecture
- Event-sourcing architecture with append-only event log
- Agent-swarm pattern with governance gates
- Projection-based read models
- Strict security model (RLS, CORS, no client secrets)

#### AI Spend Ledger + Budget Guard (Feature #1)
- `ai_usage` table for tracking all AI requests
- Cost calculation per provider/model
- User daily budget enforcement ($10)
- Project daily budget enforcement ($5)
- Rate limiting (30 req/min)
- Returns 402 on budget exceeded
- Returns 429 on rate limit exceeded

#### Database Schema
- `projects` - Project management
- `project_members` - Team collaboration
- `project_events` - Append-only event log
- `project_projections` - Materialized read models
- `ai_usage` - AI spend ledger
- `rate_limits` - Distributed rate limiting

#### Edge Functions
- `ai-proxy` - AI calls with ledger/budget enforcement
- `_shared/cors` - Strict CORS configuration
- `_shared/auth` - JWT verification
- `_shared/rateLimit` - Rate limit checking

#### Frontend
- React + Vite + TypeScript + Tailwind setup
- Authentication (email/password via Supabase Auth)
- Project list page
- Project detail page with Agent Swarm panel
- TanStack Query for server state
- Zustand for local state

#### Testing
- Vitest configuration
- Unit tests for cost calculation
- Unit tests for budget enforcement
- Unit tests for request validation
- Component tests for AgentSwarmPanel

#### CI/CD
- GitHub Actions workflow
- Lint, typecheck, test, build steps
- Edge Function type checking with Deno

### Security
- RLS policies on all tables
- AI calls only through Edge Functions
- Strict CORS allowlist
- No secrets in client bundle
- Service role keys server-side only

### Next Steps
1. Integrate actual AI providers (OpenAI, Anthropic, etc.)
2. Implement real-time collaboration (presence, cursors)
3. Add event log mutation endpoint
4. Create agent orchestration layer
5. Add HTML export functionality
6. Implement publish to `/p/:slug`
