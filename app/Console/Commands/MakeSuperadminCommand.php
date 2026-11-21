<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class MakeSuperadminCommand extends Command
{
    protected $signature = 'janjiyan:make-superadmin
        {email : Email user superadmin}
        {--name=Superadmin Janjiyan : Nama tampilan jika membuat user superadmin baru}
        {--password= : Kata sandi untuk user superadmin (minimal 8 karakter)}
        {--revoke : Cabut akses superadmin}';

    protected $description = 'Create, promote, or revoke a dedicated superadmin account for Janjiyan.';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error("Format email '{$email}' tidak valid.");

            return self::FAILURE;
        }

        $revoke = (bool) $this->option('revoke');
        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if ($revoke) {
            if (! $user) {
                $this->error("User dengan email {$email} tidak ditemukan.");

                return self::FAILURE;
            }

            $user->is_superadmin = false;
            $user->save();

            $this->info("Akses superadmin untuk {$user->email} telah dicabut.");

            return self::SUCCESS;
        }

        $passwordOption = $this->option('password');

        if (! $user) {
            $password = is_string($passwordOption) && $passwordOption !== ''
                ? $passwordOption
                : (string) $this->secret('Masukkan kata sandi untuk Superadmin baru (minimal 8 karakter)');

            if (mb_strlen($password) < 8) {
                $this->error('Kata sandi superadmin minimal harus 8 karakter.');

                return self::FAILURE;
            }

            $name = trim((string) $this->option('name')) ?: 'Superadmin Janjiyan';

            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
                'email_verified_at' => now(),
            ]);
            $user->forceFill(['is_superadmin' => true])->save();

            $this->info("Akun superadmin {$user->email} berhasil dibuat (khusus Panel Superadmin /admin).");

            return self::SUCCESS;
        }

        // Anyone can self-register (or a merchant can create a staff login for) this email, so an existing
        // row is not proof the operator owns it. Always replace its credentials before elevating.
        if (! is_string($passwordOption) || $passwordOption === '') {
            $this->error("User {$user->email} sudah ada. Ulangi dengan --password=... agar kredensial lama diganti sebelum dijadikan superadmin.");

            return self::FAILURE;
        }

        if (mb_strlen($passwordOption) < 8) {
            $this->error('Kata sandi superadmin minimal harus 8 karakter.');

            return self::FAILURE;
        }

        $user->password = Hash::make($passwordOption);

        if (! $user->email_verified_at) {
            $user->email_verified_at = now();
        }

        $user->is_superadmin = true;
        $user->save();
        $user->revokeOtherCredentials();

        $this->info("User {$user->email} berhasil dijadikan superadmin.");

        return self::SUCCESS;
    }
}
