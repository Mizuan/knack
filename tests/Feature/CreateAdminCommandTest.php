<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreateAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_a_verified_admin()
    {
        $this->artisan('app:create-admin')
            ->expectsQuestion('Name', 'Admin')
            ->expectsQuestion('Email', 'admin@example.com')
            ->expectsQuestion('Password', 'a-long-password-123')
            ->assertSuccessful();

        $user = User::where('email', 'admin@example.com')->firstOrFail();

        $this->assertTrue($user->hasVerifiedEmail());
    }

    public function test_it_rejects_an_invalid_email()
    {
        $this->artisan('app:create-admin')
            ->expectsQuestion('Name', 'Admin')
            ->expectsQuestion('Email', 'not-an-email')
            ->expectsQuestion('Password', 'a-long-password-123')
            ->assertFailed();

        $this->assertDatabaseCount('users', 0);
    }
}
