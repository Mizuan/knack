<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PublicPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_home_page_lists_the_tools()
    {
        $this->get(route('home'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('home'));
    }

    public function test_the_privacy_page_is_public()
    {
        $this->get(route('privacy'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('privacy'));
    }

    public function test_the_images_to_pdf_tool_is_public()
    {
        $this->get(route('tools.images-to-pdf'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/images-to-pdf'));
    }

    public function test_the_merge_images_tool_is_public()
    {
        $this->get(route('tools.merge-images'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/merge-images'));
    }

    public function test_public_registration_is_disabled()
    {
        $this->get('/register')->assertNotFound();
        $this->post('/register', [
            'name' => 'Someone',
            'email' => 'someone@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertNotFound();
    }
}
