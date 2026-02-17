# AIWebBuilder Pro v3 - Agent-Swarm Platform

A collaborative website operating system powered by a governed agent swarm.

## Core Invariant

**"Agents propose → validators gate → event log commits → projections render."**

## Architecture

- **Frontend**: React + Vite + TypeScript + Tailwind + shadcn/ui
- **Backend**: Supabase (Auth, Postgres, Storage, Realtime, Edge Functions)
- **State**: Event-sourcing with append-only log
- **AI**: All calls routed through Supabase Edge Functions only

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

## Project Structure

```
/src
  /app                 # routes/pages
  /components          # UI components
  /editor              # canvas + inspector
  /orchestrator        # swarm coordinator (client-side view)
  /agents              # agent descriptors + prompts
  /validators          # schema + policy gates
  /state
    /projections       # read models (client)
    /events            # event types (client)
  /lib                 # supabase client, helpers

/supabase
  /functions           # Edge Functions
  /migrations          # Database migrations
```

## Security

- RLS policies on all tables
- AI calls only from Edge Functions
- Strict CORS allowlist
- No secrets in client code

## License

MIT
