# PKOS deployment

End-to-end guide for putting PKOS on a small VM in under 15 minutes
and keeping it running unattended. The default stack is Docker
Compose, Postgres + pgvector, and a TLS reverse proxy. Section 6
covers autostart after reboot and log hygiene; the bottom of the doc
covers two equally-supported zero-trust options (Tailscale or
Cloudflare Access) — pick one for any deployment that isn't strictly
localhost.

## Minimum host

- Linux x86_64 / arm64, 2 vCPU, 2 GB RAM, 20 GB disk
- Docker 24+ with the compose plugin
- Outbound HTTPS for TLS issuance + model providers

## 1. Clone, build, configure

```bash
git clone https://github.com/your-org/pkos.git
cd pkos
cp .env.prod.example .env.prod
$EDITOR .env.prod   # fill in every "MUST CHANGE" line
```

Generate the password hash and session secret on a workstation:

```bash
pnpm install
pnpm pkos:hash-password   # paste output into PKOS_PASSWORD_HASH
openssl rand -base64 48   # paste into SESSION_SECRET
```

## 2. First boot

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml build
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

Migrations run automatically on first request. Watch the logs:

```bash
docker compose -f docker-compose.prod.yml logs -f web
curl -fsS http://127.0.0.1:3000/api/healthz
```

The app binds to `127.0.0.1:3000` — it is not exposed publicly until
you put a reverse proxy in front (see step 3).

## 3. TLS reverse proxy

### Option A — Caddy (simplest)

```bash
docker run -d --name caddy \
  -p 80:80 -p 443:443 \
  -v $PWD/infra/reverse-proxy/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v caddy_data:/data -v caddy_config:/config \
  --network pkos_default \
  caddy:2
```

Edit `Caddyfile` to your hostname; Caddy fetches a Let's Encrypt cert
on first request.

### Option B — Traefik

Use `infra/reverse-proxy/traefik.yml` as a dynamic config. Provide
Traefik's static config (entry points, ACME resolver) per your
existing setup.

## 4. Update procedure

```bash
git pull --ff-only
docker compose --env-file .env.prod -f docker-compose.prod.yml build
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

Migrations are idempotent; new SQL files apply automatically on boot.

## 5. Backup & restore

Use the portable JSONL CLI for cross-version safety, and `pg_dump` for
fast same-version recovery. See [`backup.md`](./backup.md) for both.
Schedule a daily cron:

```cron
0 3 * * *  cd /srv/pkos && docker compose -f docker-compose.prod.yml \
            exec -T web pnpm pkos:export --out /data/files/backups/pkos-$(date +\%F).tar.gz
```

Don't forget to copy the `pkos_files` and `pkos_vault` volumes
alongside Postgres — attachments and the markdown vault live outside
the database.

## 6. Run in the background (autostart + logs)

PKOS is meant to keep running quietly on a small VM. Two pieces matter
for that: the stack must come back up after reboots, and the logs must
not eat the disk.

### Autostart after reboot

The compose services already set `restart: unless-stopped`, so the
containers come up automatically — **once** Docker itself is running.
Make sure the Docker daemon is enabled at boot:

```bash
sudo systemctl enable --now docker
```

That's enough for most installs: after `docker compose up -d` once,
the stack survives reboots, kernel upgrades and crashes.

If you'd rather have a real systemd handle on the stack (so
`systemctl status pkos` is the source of truth and `journalctl -u
pkos` collects compose's own startup output), drop in a thin wrapper
unit:

```ini
# /etc/systemd/system/pkos.service
[Unit]
Description=PKOS docker-compose stack
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/srv/pkos
EnvironmentFile=/srv/pkos/.env.prod
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pkos
systemctl status pkos
```

The unit is a *supervisor*, not a replacement for `restart:
unless-stopped` — Docker still restarts individual containers on
crash; systemd just guarantees the compose project itself is brought
up at boot and torn down cleanly on shutdown.

### Log management

Container logs go to the Docker JSON driver by default and can grow
unbounded. Cap them once at the daemon level:

```bash
# /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
```

```bash
sudo systemctl restart docker
```

Day-to-day:

```bash
docker compose -f docker-compose.prod.yml logs -f web      # tail the app
docker compose -f docker-compose.prod.yml logs --tail 200 postgres
journalctl -u pkos -f                                      # if you use the wrapper unit
journalctl -u docker -f                                    # daemon-level events
```

For longer retention or remote shipping (Loki, Datadog,
journald-remote), switch the Docker log driver in `daemon.json` and
restart the daemon. PKOS doesn't care what driver is in use — its
logs are structured pino JSON on stdout.

### Auto-updates (optional)

If you want unattended updates instead of manual `git pull`, the
simplest pattern is a cron that pulls and rebuilds during a quiet
window:

```cron
# /etc/cron.d/pkos-update
30 4 * * 1  root  cd /srv/pkos && git pull --ff-only \
              && docker compose --env-file .env.prod -f docker-compose.prod.yml build --pull \
              && docker compose --env-file .env.prod -f docker-compose.prod.yml up -d \
              >> /var/log/pkos-update.log 2>&1
```

For image-only updates without `git pull`, Watchtower
(`containrrr/watchtower`) works too — but pin it to the `pkos-web`
container so Postgres doesn't get auto-upgraded.

---

# Zero-trust access (recommended)

Even with a reverse proxy in front, exposing PKOS on the public
internet means accepting bots scanning `/api/auth/login` continuously.
The setups below put authentication *before* the network reaches
PKOS at all. Two equally-supported options:

| Use case                                           | Pick               |
| -------------------------------------------------- | ------------------ |
| Solo install, only your own devices reach PKOS     | Tailscale          |
| Shared with collaborators who don't all run Tailscale | Cloudflare Access |
| Belt-and-braces (operator SSH + user HTTPS split)  | Both, see below    |

## Option A — Tailscale (recommended for solo / small teams)

Tailscale gives you a private overlay network keyed to your
identity provider (Google, Microsoft, GitHub, …). PKOS becomes
reachable only from your own devices; no port is exposed to the
public internet.

### Setup

1. Install `tailscale` on the host:

   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up --auth-key=tskey-... --hostname=pkos
   ```

2. Enable the *Tailscale Serve* feature so the node terminates TLS
   for you (no public DNS needed):

   ```bash
   sudo tailscale serve --bg --https=443 http://127.0.0.1:3000
   sudo tailscale cert pkos.<tailnet>.ts.net   # optional: also issue cert
   ```

3. Visit `https://pkos.<your-tailnet>.ts.net` from any device that has
   logged into your Tailscale account. The reverse proxy (Caddy /
   Traefik) and any open port 80/443 can be removed entirely.

4. Turn on **MagicDNS** + **HTTPS Certificates** in the Tailscale
   admin console for nicer URLs.

### Hardening checklist

- Restrict the node with an **ACL tag** (e.g. `tag:pkos`) and an ACL
  rule that lets only `group:owners` reach it.
- Enable **device approval** so a newly-joined laptop can't pull
  captures until you click *approve*.
- Set PKOS to bind to the `tailscale0` interface only:

  ```yaml
  ports:
    - "100.x.y.z:3000:3000"   # tailscale IP, not 127.0.0.1
  ```

  or stay on loopback and let `tailscale serve` forward.

- Combine with Tailscale's **lock** feature for an extra "no node may
  join without my signing key" guarantee in higher-stakes
  environments.

### Result

- No public port. No bots. No certificate hassle.
- Identity comes from your IdP (Google / Microsoft / GitHub) via
  Tailscale, layered on top of PKOS's own 2FA.

## Option B — Cloudflare Access (recommended for shared deployments)

Cloudflare Access fronts PKOS with Cloudflare's global edge and
enforces SSO + policy *before* a request hits your server. Works well
when you want to share a workspace with collaborators who don't all
have Tailscale.

### Setup

1. Add your domain to Cloudflare (DNS + Zero Trust dashboard).

2. Install **cloudflared** on the host and create a tunnel:

   ```bash
   curl -fsSL https://pkg.cloudflare.com/install.sh | sh
   cloudflared tunnel login
   cloudflared tunnel create pkos
   cloudflared tunnel route dns pkos pkos.example.com
   ```

3. Configure the tunnel ingress at
   `~/.cloudflared/config.yml`:

   ```yaml
   tunnel: pkos
   credentials-file: /etc/cloudflared/pkos.json
   ingress:
     - hostname: pkos.example.com
       service: http://127.0.0.1:3000
       originRequest:
         noTLSVerify: true
     - service: http_status:404
   ```

4. Run cloudflared as a systemd service:

   ```bash
   sudo cloudflared service install
   ```

5. In the **Zero Trust** dashboard, add an **Application** for
   `pkos.example.com` and a **Policy** like

   - Action: *Allow*
   - Include: *Emails ending in `@your-domain.com`* (or your IdP group)
   - Require: *Purpose justification* + *MFA*

6. Tell PKOS to trust the Cloudflare Access JWT for the audit log:

   ```env
   # In .env.prod
   # Cloudflare sets these headers on every request that survives Access:
   # Cf-Access-Authenticated-User-Email, Cf-Access-Jwt-Assertion
   ```

   PKOS doesn't currently validate the JWT itself — Access has already
   approved the user before traffic reaches the tunnel. If you want
   defence-in-depth, add a small middleware that verifies the JWT
   against the team's public keys at
   `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`.

7. Block direct origin access. Because cloudflared is the only way in,
   set the firewall to drop everything except outbound to Cloudflare:

   ```bash
   sudo ufw default deny incoming
   sudo ufw allow ssh
   sudo ufw enable
   ```

### Result

- PKOS sits behind Cloudflare's WAF, rate limiting and bot mitigation
  for free.
- Identity + MFA + policy live in Cloudflare; PKOS still requires its
  own password and 2FA as a second factor.
- Tunnel is outbound-only — no public ingress on the VM.

## Combine both

For high-stakes private deployments: put Tailscale around the
**operator** SSH and `cloudflared` around the **user** HTTPS. PKOS
itself never needs a public IP.
