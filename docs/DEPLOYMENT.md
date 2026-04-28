# Deployment: Production Checklist & Setup

## 1. Prerequisites
- **Hardware**: Minimum 1GB RAM, 1 vCPU (VPS recommended).
- **Runtime**: Node.js v18+, PocketBase v0.22+.
- **Domain**: SSL certificate is MANDATORY (WebCrypto API requires HTTPS).

---

## 2. Step-by-Step Installation

### Step 1: Clone and Install
```bash
git clone <repo_url>
cd crypt-messenger
npm install
```

### Step 2: PocketBase Initialization
1. Download the PocketBase binary for your OS.
2. Start the server:
   ```bash
   ./pocketbase serve
   ```
3. Open Admin UI (`http://127.0.0.1:8090/_/`) and create the first admin account.

### Step 3: Schema Setup
Run the automation script to create collections and set API Rules:
```bash
node scripts/setup-pocketbase-final.js
```

### Step 4: Verification
Run the system test to ensure all components are communicating correctly:
```bash
node scripts/verify-setup.js
```

---

## 3. Production Hardening

### 3.1. Fail2Ban Configuration
Copy the provided configuration to protect your server from brute-force attacks:
```bash
sudo cp scripts/fail2ban-config.conf /etc/fail2ban/jail.d/pocketbase.conf
sudo systemctl restart fail2ban
```

### 3.2. Content Security Policy (CSP)
Ensure your web server (Nginx/Apache) sends the following header:
```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss: http://127.0.0.1:8090;
```

### 3.3. Reverse Proxy (Nginx)
Example configuration for SSL termination and WebSockets:
```nginx
server {
    listen 443 ssl;
    server_name messenger.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000; # Fastify/Frontend
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8090; # PocketBase
    }
}
```

---

## 4. Maintenance Checklist
- [ ] **Daily Backups**: Backup `pb_data/data.db` and the `uploads/` folder.
- [ ] **Monitoring**: Check `pb_data/logs.db` for suspicious auth attempts.
- [ ] **Retention**: Verify that the Cron cleanup hook is running successfully (check console output).
- [ ] **Updates**: Regularly update the PocketBase binary and npm dependencies.
