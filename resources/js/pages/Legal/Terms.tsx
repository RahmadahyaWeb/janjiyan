import PublicLegalLayout from '@/layouts/PublicLegalLayout';

interface LegalConfig {
    entity_name: string;
    address: string;
    support_email: string;
    privacy_email: string;
}

interface TermsProps {
    legal?: LegalConfig;
}

export default function Terms({ legal }: TermsProps) {
    const entityName = legal?.entity_name || 'Janjiyan';
    const supportEmail = legal?.support_email || 'support@janjiyan.com';

    return (
        <PublicLegalLayout
            title="Syarat & Ketentuan"
            description="Ketentuan penggunaan layanan SaaS reservasi online Janjiyan bagi pemilik bisnis dan pelanggan."
        >
            <article className="space-y-8">
                <header className="space-y-3 border-b border-divider pb-8">
                    <p className="text-xs font-semibold text-mute">Terakhir diperbarui: 19 November 2026</p>
                    <h1 className="text-3xl font-semibold text-ink sm:text-4xl">Syarat &amp; Ketentuan Layanan</h1>
                    <p className="text-base leading-relaxed text-mute">
                        Dengan mendaftar, mengakses, atau menggunakan platform Janjiyan yang dikelola oleh <strong>{entityName}</strong>, Anda menyetujui ketentuan penggunaan berikut.
                    </p>
                </header>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">1. Ruang Lingkup Layanan</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Janjiyan menyediakan perangkat lunak berbasis cloud (SaaS) untuk pengelolaan jadwal layanan, portal reservasi publik, pencatatan pelanggan, serta verifikasi bukti uang muka bagi pelaku usaha jasa.
                    </p>
                </section>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">2. Akun Merchant, Uji Coba 14 Hari &amp; Langganan SaaS</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Setiap merchant baru memperoleh masa uji coba gratis selama 14 hari dengan kuota paket yang berlaku. Setelah masa uji coba berakhir, merchant dapat melanjutkan penggunaan penuh dengan berlangganan paket berbayar (siklus bulanan atau tahunan) yang dibayarkan melalui gateway pembayaran Mayar sesuai harga yang tertera pada halaman Paket &amp; Billing.
                    </p>
                    <p className="text-sm leading-relaxed text-body">
                        Apabila masa uji coba atau periode langganan berakhir tanpa perpanjangan, akun akan masuk ke mode <em>soft-lock</em>: merchant tetap dapat mengakses riwayat data dan melakukan perpanjangan paket di dashboard, namun pembuatan reservasi baru, perubahan data operasional, dan ekspor CSV akan dibatasi sementara hingga langganan kembali aktif.
                    </p>
                </section>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">3. Pembatalan &amp; Kebijakan Pengembalian Dana (Refund) Langganan</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Langganan SaaS Janjiyan bersifat prabayar (<em>prepaid</em>) tanpa perpanjangan otomatis sepihak. Biaya langganan yang telah terverifikasi dan mengaktifkan paket pada umumnya tidak dapat dikembalikan (<em>non-refundable</em>), kecuali terjadi kesalahan penagihan ganda (<em>double charge</em>) yang dapat dibuktikan. Permintaan terkait penagihan dapat diajukan ke{' '}
                        <a href={`mailto:${supportEmail}`} className="font-medium text-ink underline underline-offset-4">
                            {supportEmail}
                        </a>{' '}
                        dalam 7 hari kalender sejak tanggal transaksi.
                    </p>
                </section>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">4. Transaksi Pembayaran Uang Muka &amp; Layanan Jasa</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Pembayaran uang muka atau pelunasan layanan dilakukan secara langsung antara pelanggan dan merchant melalui rekening bank atau QRIS milik merchant. Janjiyan tidak memotong komisi transaksi (0% fee), tidak menampung dana pihak ketiga, dan tidak bertanggung jawab atas sengketa kualitas layanan maupun pengembalian dana (refund) antara merchant dan pelanggan.
                    </p>
                </section>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">5. Penggunaan yang Dilarang</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Pengguna dilarang menggunakan Janjiyan untuk aktivitas penipuan, pengiriman spam reservasi, unggahan konten ilegal atau melanggar hak kekayaan intelektual, serta upaya mengganggu stabilitas atau keamanan sistem.
                    </p>
                </section>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">6. Batasan Tanggung Jawab &amp; Penghentian Layanan</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Layanan disediakan sebagaimana adanya (<em>as-is</em>) dengan upaya terbaik untuk menjaga ketersediaan sistem. {entityName} tidak bertanggung jawab atas kerugian tidak langsung, kehilangan keuntungan, atau gangguan pihak ketiga di luar kendali wajar kami. Pemilik bisnis dapat menghapus bisnis beserta seluruh data terkait kapan saja melalui menu Pengaturan di dashboard.
                    </p>
                </section>

                <section className="space-y-2.5">
                    <h2 className="text-xl font-semibold text-ink">7. Hukum yang Berlaku &amp; Kontak</h2>
                    <p className="text-sm leading-relaxed text-body">
                        Syarat dan ketentuan ini diatur serta ditafsirkan berdasarkan Hukum Republik Indonesia. Pertanyaan terkait ketentuan ini dapat disampaikan melalui{' '}
                        <a href={`mailto:${supportEmail}`} className="font-medium text-ink underline underline-offset-4">
                            {supportEmail}
                        </a>
                        .
                    </p>
                </section>
            </article>
        </PublicLegalLayout>
    );
}
