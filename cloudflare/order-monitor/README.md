# NewVPS per-order Cloudflare monitor

Each successfully created non-XMR payment order starts its own Durable Object alarm. The alarm calls the Supabase payment-chain-monitor for that exact order ID every ~10 seconds until a match is found or 60 minutes from order creation has elapsed. XMR remains on NOWPayments IPN.

Deploy with Wrangler using Cloudflare credentials. Set NEWVPS_MONITOR_SECRET with `wrangler secret put NEWVPS_MONITOR_SECRET` (must match Supabase NEWVPS_MONITOR_SECRET). Then set Supabase Edge Function secret NEWVPS_ORDER_MONITOR_URL to the deployed worker URL. After a verified end-to-end test, remove only the blockchain check step from the GitHub five-minute workflow; keep the Telegram notification step.

Important: alarm scheduling is approximate, not a guaranteed exact 10-second SLA. Each chain's RPC query and historical coverage must be independently validated. Do not disable the existing fallback before the new monitor is deployed and tested.

