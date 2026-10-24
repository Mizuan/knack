<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;

use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

class CreateAdmin extends Command
{
    /**
     * @var string
     */
    protected $signature = 'app:create-admin';

    /**
     * @var string
     */
    protected $description = 'Create an admin account (public registration is disabled)';

    public function handle(CreatesNewUsers $creator): int
    {
        $name = text('Name', required: true);
        $email = text('Email', required: true);
        $secret = password('Password', required: true);

        try {
            $user = $creator->create([
                'name' => $name,
                'email' => $email,
                'password' => $secret,
                'password_confirmation' => $secret,
            ]);
        } catch (ValidationException $e) {
            foreach ($e->errors() as $messages) {
                foreach ($messages as $message) {
                    $this->components->error($message);
                }
            }

            return self::FAILURE;
        }

        $user->markEmailAsVerified();

        $this->components->info("Admin {$user->email} created.");

        return self::SUCCESS;
    }
}
