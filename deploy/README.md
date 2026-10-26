# Deploying Tinyfold to Forge

Tinyfold runs on a Laravel Forge server (DigitalOcean). Files are processed in the
visitor's browser, so the server only serves the app: no upload limits, queues
or file storage to configure.

The production domain is `tinyfold.app`. Every `.app` domain must be served
over HTTPS, which the setup below does.

## 1. Server

Tinyfold shares `floral-badlands` (139.59.125.137) with other sites, so it
brings its own PHP and Node versions instead of changing the server's.

- PHP 8.4 with `pdo_sqlite` (installed alongside the server's default 8.3).
- Node **22.18+**: the server's own Node is older and other sites build with it,
  so Tinyfold has a private copy, checksum-verified from nodejs.org:

    ```sh
    V=v22.23.4; DIR=$HOME/.tinyfold-node; mkdir -p "$DIR"; cd "$DIR"
    curl -fsSLO "https://nodejs.org/dist/$V/node-$V-linux-x64.tar.xz"
    curl -fsSLO "https://nodejs.org/dist/$V/SHASUMS256.txt"
    grep " node-$V-linux-x64.tar.xz\$" SHASUMS256.txt | sha256sum -c -
    tar -xJf "node-$V-linux-x64.tar.xz" && ln -sfn "$DIR/node-$V-linux-x64" "$DIR/current"
    ```

    To upgrade later, run the same with the new version; `current` moves to it.

- A folder of links that the deploy script puts first on its `PATH`, so the
  build's `php artisan` calls use PHP 8.4 and `npm` uses the private Node:

    ```sh
    B=$HOME/.tinyfold-bin; mkdir -p "$B"
    ln -sfn /usr/bin/php8.4 "$B/php"
    for t in node npm npx; do ln -sfn "$HOME/.tinyfold-node/current/bin/$t" "$B/$t"; done
    ```

- The database lives outside the site, so deploys never touch it:

    ```sh
    mkdir -p /home/forge/tinyfold-data
    touch /home/forge/tinyfold-data/database.sqlite
    ```

## 2. Site

- New site: `tinyfold.app`, PHP 8.4, web directory `/public`.
- Repository: `Mizuan/tinyfold`, branch `main`. Leave "Install Composer
  dependencies" on.
- Zero-downtime deployments: on.

## 3. Environment

Set these in the site's Environment panel (generate `APP_KEY` with
`php artisan key:generate --show`):

```dotenv
APP_NAME=Tinyfold
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://tinyfold.app

LOG_CHANNEL=daily
LOG_LEVEL=warning

DB_CONNECTION=sqlite
DB_DATABASE=/home/forge/tinyfold-data/database.sqlite

SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
SESSION_ENCRYPT=true

CACHE_STORE=database
QUEUE_CONNECTION=database

MAIL_MAILER=log
```

## 4. Deploy script

```sh
$CREATE_RELEASE()

cd $FORGE_RELEASE_DIRECTORY

# Tinyfold builds with PHP 8.4 and its own Node 22 LTS (see section 1)
export PATH="/home/forge/.tinyfold-bin:$PATH"

$FORGE_COMPOSER install --no-dev --no-interaction --prefer-dist --optimize-autoloader

npm ci
npm run build

$FORGE_PHP artisan migrate --force
$FORGE_PHP artisan optimize

$ACTIVATE_RELEASE()
```

Use `npm ci` on its own: an `|| npm install` fallback can quietly install
different versions than the lockfile. `npm run build` downloads the fonts once
and bundles them, so the server needs outbound internet during the build only.

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
curl -I https://tinyfold.app          # 200, Content-Security-Policy, Strict-Transport-Security
curl -s https://tinyfold.app/up       # health check
curl -s -o /dev/null -w "%{http_code}\n" https://tinyfold.app/register   # 404
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
