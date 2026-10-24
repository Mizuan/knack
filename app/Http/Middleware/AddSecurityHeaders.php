<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

class AddSecurityHeaders
{
    /**
     * Add a strict Content Security Policy and the standard hardening headers.
     *
     * Files are processed in the browser, so the policy only needs to allow the
     * app's own scripts, blob: workers and WebAssembly (the HEIC decoder).
     */
    public function handle(Request $request, Closure $next): Response
    {
        Vite::useCspNonce();

        $response = $next($request);

        $response->headers->set('Content-Security-Policy', $this->contentSecurityPolicy());
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');

        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }

    private function contentSecurityPolicy(): string
    {
        $nonce = Vite::cspNonce();
        $dev = Vite::isRunningHot() ? $this->viteDevServerOrigins() : [];

        $directives = [
            'default-src' => ["'self'"],
            'script-src' => ["'self'", "'nonce-{$nonce}'", "'wasm-unsafe-eval'", ...$dev],
            'style-src' => ["'self'", "'unsafe-inline'", ...$dev],
            'img-src' => ["'self'", 'data:', 'blob:'],
            'font-src' => ["'self'", ...$dev],
            'connect-src' => ["'self'", 'blob:', ...$dev],
            // Module workers fetch their imports under worker-src, hence the dev server here too.
            'worker-src' => ["'self'", 'blob:', ...$dev],
            'object-src' => ["'none'"],
            'base-uri' => ["'self'"],
            'form-action' => ["'self'"],
            'frame-ancestors' => ["'none'"],
        ];

        return collect($directives)
            ->map(fn (array $sources, string $directive) => $directive.' '.implode(' ', $sources))
            ->implode('; ');
    }

    /**
     * Local development only: the hot file exists while `vp dev` is running.
     *
     * @return list<string>
     */
    private function viteDevServerOrigins(): array
    {
        $contents = @file_get_contents(Vite::hotFile());
        $parts = $contents === false ? false : parse_url(trim($contents));

        // Unreadable or malformed hot file: add nothing rather than guess.
        if (! is_array($parts) || ! isset($parts['scheme'], $parts['host'], $parts['port'])) {
            return [];
        }

        ['scheme' => $scheme, 'host' => $host, 'port' => $port] = $parts;

        // CSP has no syntax for IPv6 literals such as [::1], so allow the schemes.
        if (str_starts_with($host, '[')) {
            return $scheme === 'https' ? ['https:', 'wss:'] : ['http:', 'ws:'];
        }

        $origin = "{$scheme}://{$host}:{$port}";

        return [$origin, str_replace(['http://', 'https://'], ['ws://', 'wss://'], $origin)];
    }
}
