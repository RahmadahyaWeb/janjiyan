import PublicLegalLayout from '@/layouts/PublicLegalLayout';

interface LegalConfig {
    entity_name: string;
    address: string;
    support_email: string;
    privacy_email: string;
}

interface PrivacyProps {
    legal?: LegalConfig;
}

export default function Privacy({ legal }: PrivacyProps) {
    const entityName = legal?.entity_name || 'Janjiyan';
    const address = legal?.address || 'Indonesia';
    const privacyEmail = legal?.privacy_email || 'privacy@janjiyan.com';
    const supportEmail = legal?.support_email || 'support@janjiyan.com';

    return (
        <PublicLegalLayout
            title="Kebijakan Privasi"
            description="Bagaimana Janjiyan mengumpulkan, menggunakan, menyimpan, dan melindungi data akun serta reservasi Anda."
        >
            <article className="space-y-8">
                <header className="space-y-3 border-b border-divider pb-8">
                    <p className="text-xs font-semibold text-mute">Terakhir diperbarui: 19 November 2026</p>
                    <h1 className="text-3xl font-semibold text-ink sm:text-4xl">Kebijakan Privasi</h1>
                    <p className="text-base leading-relaxed text-mute">
                        Kebijakan ini menjelaskan bagaimana <strong>{entityName}</strong> (&ldquo;kami&rdquo;) memproses informasi pribadi merchant, staf, dan pelanggan sesuai dengan Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).
                    </p>
                </header>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">1. Identitas Pengendali Data</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Platform Janjiyan dikelola oleh <strong>{entityName}</strong> yang berdomisili di {address}. Untuk pertanyaan terkait perlindungan data atau permintaan subjek data, Anda dapat menghubungi petugas privasi kami melalui{' '}
                        <a href={`mailto:${privacyEmail}`} className="font-medium text-ink underline underline-offset-4">
                            {privacyEmail}
                        </a>{' '}
                        atau dukungan umum di{' '}
                        <a href={`mailto:${supportEmail}`} className="font-medium text-ink underline underline-offset-4">
                            {supportEmail}
                        </a>
                        .
                    </p>
                </section>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">2. Data yang Kami Kumpulkan</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Kami mengumpulkan data akun merchant (nama, alamat email, kata sandi terenkripsi, atau profil dasar Google apabila Anda memilih masuk dengan Google), profil bisnis (nama usaha, alamat, nomor WhatsApp, jam operasional, rekening tujuan pembayaran), data langganan SaaS, serta data pesanan pelanggan (nama, nomor telepon/WhatsApp, email opsional, catatan, dan file bukti transfer uang muka).
                    </p>
                </section>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">3. Penggunaan Data Google OAuth</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Apabila Anda masuk atau mendaftar menggunakan Google, Janjiyan hanya meminta akses profil dasar (nama, alamat email terverifikasi, dan foto profil) untuk autentikasi dan pembuatan akun. Kami tidak mengakses data Google Drive, Gmail, atau kontak Anda, serta tidak menjual data tersebut kepada pihak ketiga.
                    </p>
                </section>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">4. Penyedia Layanan Pihak Ketiga (Sub-Processor)</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Untuk menjalankan layanan secara andal, kami bekerja sama dengan penyedia pihak ketiga tepercaya hanya sejauh diperlukan untuk pemrosesan layanan:
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-body">
                        <li><strong>Mayar</strong> — pemrosesan invoice dan verifikasi pembayaran langganan SaaS merchant.</li>
                        <li><strong>Penyedia Email/SMTP</strong> — pengiriman email verifikasi akun, reset kata sandi, konfirmasi reservasi, dan pengingat jadwal otomatis.</li>
                        <li><strong>Telegram Bot API</strong> — pengiriman notifikasi reservasi ke grup/chat Telegram merchant (hanya jika diaktifkan oleh merchant).</li>
                        <li><strong>Penyedia Infrastruktur Hosting &amp; Penyimpanan</strong> — penyimpanan database terenkripsi dan file unggahan.</li>
                    </ul>
                </section>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">5. Keamanan, Cookie &amp; Masa Retensi Data</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Gambar bukti transfer uang muka yang diunggah pelanggan disimpan pada penyimpanan privat yang hanya dapat diakses oleh pemilik bisnis dan staf berwenang. Kami menggunakan cookie sesi esensial (HTTP-only) semata-mata untuk autentikasi, perlindungan CSRF, dan pemilihan bisnis aktif—kami tidak menggunakan cookie pelacakan iklan pihak ketiga.
                    </p>
                    <p className="text-sm leading-relaxed text-body">
                        Data pesanan dan bukti uang muka disimpan selama akun bisnis aktif agar merchant dapat mengelola riwayat transaksi dan layanan pelanggan. Apabila merchant menghapus bisnisnya, seluruh data pesanan, pelanggan, dan file bukti uang muka terkait dihapus secara permanen dari sistem aktif kami (dan terhapus dari cadangan berkala maksimal dalam 30 hari).
                    </p>
                </section>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">6. Hak Subjek Data (UU PDP)</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Anda berhak meminta akses, perbaikan, portabilitas (ekspor CSV), penarikan persetujuan, atau penghapusan data pribadi Anda. Pemilik akun dapat memperbarui profil dan menghapus bisnis langsung melalui dashboard, atau menghubungi{' '}
                        <a href={`mailto:${privacyEmail}`} className="font-medium text-ink underline underline-offset-4">
                            {privacyEmail}
                        </a>{' '}
                        untuk permintaan lebih lanjut yang akan kami proses dalam waktu maksimal 14 hari kerja.
                    </p>
                </section>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">7. Perubahan Kebijakan</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Kami dapat memperbarui kebijakan privasi ini sewaktu-waktu seiring pengembangan fitur atau perubahan regulasi. Tanggal pembaruan terbaru akan selalu dicantumkan di bagian atas halaman ini.
                    </p>
                </section>
            </article>
        </PublicLegalLayout>
    );
}
