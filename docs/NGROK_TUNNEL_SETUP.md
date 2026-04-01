# 🌐 ngrok Tunnel Setup - Automatic Initialization

## Overview

This document explains how to use the automatic ngrok tunnel setup for the Brickshare Logistics development environment.

## Problem Solved

When developing locally with a **dual database architecture**:
- **DB1** (Cloud): Brickshare_logistics on Supabase Cloud
- **DB2** (Local): Brickshare running on `http://localhost:54321`

The Edge Functions on DB1 Cloud cannot directly access DB2 Local. The solution is to expose DB2 through a public ngrok tunnel.

## Prerequisites

1. **ngrok installed**:
   ```bash
   brew install ngrok  # macOS
   # or download from https://ngrok.com/download
   ```

2. **ngrok authenticated** (one-time setup):
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

3. **Reserved ngrok domain** (optional but recommended):
   - Domain: `semblably-dizzied-bruno.ngrok-free.dev`
   - Configure at: https://dashboard.ngrok.com/domains

## Quick Start

### Option 1: Automatic (Recommended)

Start everything with one command:

```bash
npm run dev:tunnel
```

This will:
- ✅ Start Supabase local database on port 54321
- ✅ Start ngrok tunnel on the configured domain
- ✅ Validate the tunnel is working
- ✅ Display all active URLs

**Output example:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ All services ready
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Database:    http://localhost:54321
ngrok tunnel: https://semblably-dizzied-bruno.ngrok-free.dev
Dashboard:   http://localhost:4040
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Press Ctrl+C to stop all services
```

### Option 2: Manual Steps

If you prefer to run Supabase and ngrok separately:

**Terminal 1 - Start Supabase:**
```bash
supabase start
```

**Terminal 2 - Start ngrok:**
```bash
ngrok http 54321 --domain=semblably-dizzied-bruno.ngrok-free.dev
```

## Available Commands

| Command | Purpose |
|---------|---------|
| `npm run dev:tunnel` | Start Supabase + ngrok with validation |
| `npm run tunnel:check` | Check status of ngrok tunnel |
| `npm run tunnel:stop` | Stop ngrok (useful if multiple instances running) |
| `npm run dev:web` | Start web app only (requires ngrok already running) |
| `npm run dev:mobile` | Start mobile app only (requires ngrok already running) |

## Troubleshooting

### Issue: "ngrok command not found"
```bash
# Install ngrok
brew install ngrok
```

### Issue: "Failed to connect to tunnel"
1. Check ngrok dashboard: http://localhost:4040
2. Verify domain is reserved in ngrok account
3. Try stopping and restarting:
   ```bash
   npm run tunnel:stop
   npm run dev:tunnel
   ```

### Issue: "Port 54321 already in use"
```bash
# Kill process on port 54321
lsof -ti:54321 | xargs kill -9

# Or use the helper
npm run tunnel:stop
```

### Issue: "ngrok tunnel keeps disconnecting"
- Check your internet connection
- Verify ngrok auth token: `ngrok config get`
- Domain might have expired - check https://dashboard.ngrok.com

## Environment Variables

The ngrok tunnel URL is used by Edge Functions. These variables are configured in Supabase Cloud:

```bash
SUPABASE_brickshare_API_URL=https://semblably-dizzied-bruno.ngrok-free.dev
SUPABASE_brickshare_SERVICE_ROLE_KEY=<your-service-role-key>
```

**To update these** (after changing domain or keys):

1. Go to: https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/settings/functions
2. Update Environment Variables
3. Redeploy Edge Functions

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Your Computer                        │
│                                                         │
│  ┌──────────────────────────┐  ┌─────────────────────┐ │
│  │   Supabase Local (DB2)   │  │  ngrok Tunnel       │ │
│  │   http://localhost:54321 │  │  (exposes locally)  │ │
│  └──────────────────────────┘  └─────────────────────┘ │
│           ▲                              │              │
│           └──────────────────────────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘
                        │
                        │ (over internet)
                        ▼
┌─────────────────────────────────────────────────────────┐
│         Supabase Cloud (DB1 - Production)               │
│         https://qumjzvhtotcvnzpjgjkl.supabase.co        │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │   Edge Functions (process-pudo-scan)            │  │
│  │   Uses ngrok tunnel to reach local DB2           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## QR Scanning Flow with ngrok

When you scan a QR code in the mobile app:

1. App calls Edge Function on DB1 Cloud
2. Edge Function queries shipments via ngrok tunnel
3. ngrok tunnel redirects to local Supabase (DB2)
4. Local DB returns shipment data
5. Edge Function updates DB1 with results
6. App receives response

## Production Notes

⚠️ **ngrok is for development only!**

For production:
- Use proper SSL certificates
- Configure firewall rules
- Use dedicated tunneling solutions (e.g., Cloudflare Tunnel)
- Never expose local databases directly to the internet

## Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Verify ngrok is authenticated: `ngrok config get`
3. Check internet connection
4. Review Edge Function logs: https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/functions
5. Open http://localhost:4040 for ngrok detailed logs