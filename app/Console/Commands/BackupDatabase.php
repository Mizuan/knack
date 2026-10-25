<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class BackupDatabase extends Command
{
    /**
     * @var string
     */
    protected $signature = 'app:backup-database
                            {--path= : Folder for the backups (default: storage/app/private/backups)}
                            {--keep=14 : How many backups to keep}';

    /**
     * @var string
     */
    protected $description = 'Copy the SQLite database to a dated backup file and prune old ones';

    public function handle(): int
    {
        $connection = DB::connection();

        if ($connection->getDriverName() !== 'sqlite') {
            $this->components->error('Only SQLite databases are backed up by this command.');

            return self::FAILURE;
        }

        $folder = $this->option('path') ?: storage_path('app/private/backups');
        $keep = max(1, (int) $this->option('keep'));

        File::ensureDirectoryExists($folder);

        $target = $folder.'/tinyfold-'.now()->format('Y-m-d-His').'.sqlite';

        // VACUUM INTO writes a consistent copy, even while the app is writing.
        $connection->statement('VACUUM INTO ?', [$target]);

        $backups = collect(File::glob($folder.'/tinyfold-*.sqlite'))->sort()->values();

        $backups->slice(0, max(0, $backups->count() - $keep))->each(fn (string $old) => File::delete($old));

        $this->components->info('Backed up to '.$target);

        return self::SUCCESS;
    }
}
