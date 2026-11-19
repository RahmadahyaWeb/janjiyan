<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class MakeSuperadminCommand extends Command
{
    protected $signature = 'janjiyan:make-superadmin {email : Email user yang akan dijadikan superadmin} {--revoke : Cabut akses superadmin}';

    protected $description = 'Promote or revoke superadmin access for a Janjiyan user.';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (! $user) {
            $this->error("User dengan email {$email} tidak ditemukan.");

            return self::FAILURE;
        }

        $revoke = (bool) $this->option('revoke');
        $user->is_superadmin = ! $revoke;
        $user->save();

        if ($revoke) {
            $this->info("Akses superadmin untuk {$user->email} telah dicabut.");
        } else {
            $this->info("User {$user->email} berhasil dijadikan superadmin.");
        }

        return self::SUCCESS;
    }
}
