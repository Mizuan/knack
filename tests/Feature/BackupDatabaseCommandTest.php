<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use PDO;
use Tests\TestCase;

/**
 * SQLite refuses VACUUM inside a transaction, so these tests use a real
 * database file instead of the usual RefreshDatabase transaction.
 */
class BackupDatabaseCommandTest extends TestCase
{
    private string $folder;

    protected function setUp(): void
    {
        parent::setUp();

        $this->folder = sys_get_temp_dir().'/knack-backups-'.uniqid();
        File::ensureDirectoryExists($this->folder);
        touch($this->folder.'/app.sqlite');

        config(['database.connections.sqlite.database' => $this->folder.'/app.sqlite']);
        DB::purge('sqlite');

        $this->artisan('migrate', ['--force' => true]);
        $this->folder .= '/backups';
    }

    protected function tearDown(): void
    {
        DB::disconnect('sqlite');
        File::deleteDirectory(dirname($this->folder));

        parent::tearDown();
    }

    public function test_it_writes_a_readable_copy_of_the_database()
    {
        User::factory()->create(['email' => 'kept@example.com']);

        $this->artisan('app:backup-database', ['--path' => $this->folder])->assertSuccessful();

        $backups = File::glob($this->folder.'/knack-*.sqlite');
        $this->assertCount(1, $backups);

        $copy = new PDO('sqlite:'.$backups[0]);
        $email = $copy->query('select email from users')->fetchColumn();

        $this->assertSame('kept@example.com', $email);
    }

    public function test_it_keeps_only_the_newest_backups()
    {
        foreach (['2026-01-01 03:00:00', '2026-01-02 03:00:00', '2026-01-03 03:00:00'] as $time) {
            Carbon::setTestNow($time);
            $this->artisan('app:backup-database', ['--path' => $this->folder, '--keep' => 2])->assertSuccessful();
        }

        Carbon::setTestNow();

        $this->assertSame(
            ['knack-2026-01-02-030000.sqlite', 'knack-2026-01-03-030000.sqlite'],
            collect(File::glob($this->folder.'/knack-*.sqlite'))->map(fn ($path) => basename($path))->sort()->values()->all(),
        );
    }

    public function test_it_is_scheduled_nightly()
    {
        $this->artisan('schedule:list')
            ->expectsOutputToContain('app:backup-database')
            ->assertSuccessful();
    }
}
