<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    use RefreshDatabase;

    public function test_pages_send_a_strict_content_security_policy()
    {
        $response = $this->get(route('home'));

        $csp = $response->headers->get('Content-Security-Policy');

        $this->assertMatchesRegularExpression("/script-src 'self' 'nonce-[A-Za-z0-9]+' 'wasm-unsafe-eval'/", $csp);
        $this->assertStringContainsString("object-src 'none'", $csp);
        $this->assertStringContainsString("frame-ancestors 'none'", $csp);
        $this->assertStringContainsString("worker-src 'self' blob:", $csp);
        $this->assertStringNotContainsString("'unsafe-eval'", str_replace("'wasm-unsafe-eval'", '', $csp));
    }

    public function test_inline_scripts_carry_the_policy_nonce()
    {
        $response = $this->get(route('home'));

        preg_match("/'nonce-([A-Za-z0-9]+)'/", $response->headers->get('Content-Security-Policy'), $matches);

        $response->assertSee('<script nonce="'.$matches[1].'">', escape: false);
    }

    public function test_pages_send_the_hardening_headers()
    {
        $this->get(route('home'))
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeader('Cross-Origin-Opener-Policy', 'same-origin')
            ->assertHeaderMissing('Strict-Transport-Security');
    }

    public function test_hsts_is_sent_over_https()
    {
        $this->get(str_replace('http://', 'https://', route('home')))
            ->assertHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
}
