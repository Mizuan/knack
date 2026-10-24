# Deploying Knack to Forge

Knack runs on a Laravel Forge server (DigitalOcean). Files are processed in the
visitor's browser, so the server only serves the app: no upload limits, queues
or file storage to configure.

Replace `knack.example.com` below with the real domain.

## 1. Server

- PHP 8.4 with `pdo_sqlite` (Forge installs it by default).
- Node **22.18+ or 24.11+** for the Vite build. Check with `node -v`; change it
  under the server's PHP/Node settings in Forge if it is older.
- A folder for the database outside the site, so deploys never touch it:

    ```sh
    mkdir -p /home/forge/knack-data
    touch /home/forge/knack-data/database.sqlite
    ```

## 2. Site

- New site: `knack.example.com`, PHP 8.4, web directory `/public`.
- Repository: `Mizuan/knack`, branch `main`. Leave "Install Composer
  dependencies" on.
- Zero-downtime deployments: on.

## 3. Environment

Set these in the site's Environment panel (generate `APP_KEY` with
`php artisan key:generate --show`):

```dotenv
APP_NAME=Knack
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://knack.example.com

LOG_CHANNEL=daily
LOG_LEVEL=warning

DB_CONNECTION=sqlite
DB_DATABASE=/home/forge/knack-data/database.sqlite

SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
SESSION_ENCRYPT=true

CACHE_STORE=database
QUEUE_CONNECTION=database

MAIL_MAILER=log
```

## 4. Deploy script

Start from the script Forge generates and keep its release macros. Make sure it
builds the front end and migrates:

```sh
$CREATE_RELEASE()

cd $FORGE_RELEASE_DIRECTORY

$FORGE_COMPOSER install --no-dev --no-interaction --prefer-dist --optimize-autoloader

npm ci
npm run build

$FORGE_PHP artisan migrate --force
$FORGE_PHP artisan optimize

$ACTIVATE_RELEASE()
```

`npm run build` downloads the fonts once and bundles them, so the server needs
outbound internet during the build only.

## 5. After the first deploy

- **SSL:** add a Let's Encrypt certificate in the site's SSL panel.
- **Scheduler:** turn it on (Server → Scheduler, or the site's scheduler
  option). It runs the nightly `app:backup-database` at 03:00.
- **Admin account:** `php artisan app:create-admin` from the site directory.
- **Static asset caching:** in the site's Nginx config, inside the `server`
  block, add:

    ```nginx
    location /build/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        try_files $uri =404;
    }
    ```

    Vite file names change with their content, so a year is safe.

## 6. Checks

```sh
curl -I https://knack.example.com          # 200, Content-Security-Policy, Strict-Transport-Security
curl -s https://knack.example.com/up       # health check
curl -s -o /dev/null -w "%{http_code}\n" https://knack.example.com/register   # 404
```

Then open `/images-to-pdf` and build a PDF from a few photos, including an
iPhone HEIC.

## Notes

- **Cloudflare:** optional. Use SSL mode "Full (strict)". Laravel then sees
  Cloudflare's IP for every visitor, which only matters for the admin login's
  rate limit; trust Cloudflare's IP ranges if that becomes an issue.
- **HSTS** is sent with `includeSubDomains`. Only keep that if every subdomain
  of the domain is served over HTTPS.
- **Backups** stay on the server (`storage/app/private/backups`, 14 kept). Copy
  them off the server (for example to DigitalOcean Spaces) once there is data
  worth keeping; today it holds only the admin account and sessions.
