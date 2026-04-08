/**
 * Web Bluetooth ESC/POS Printer Utility
 * Digunakan untuk koneksi langsung (Direct Print) ke printer thermal Bluetooth.
 */
class ESCPOSPrinter {
    constructor() {
        this.device = null;
        this.server = null;
        this.characteristic = null;
        this.isConnected = false;
        this.isConnecting = false;
        
        // Umumnya printer thermal Bluetooth murah (Iware dsb) menggunakan service ini:
        // Namun karena sangat bervariasi, kita gunakan list UUID yang paling umum.
        this.serviceUuids = [
            'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Iware / Milestone
            '0000ff00-0000-1000-8000-00805f9b34fb', // Generic Generic
            '000018f0-0000-1000-8000-00805f9b34fb', // Generic
            '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC
            '00004953-5441-5220-434f-4d5055544552'  // Star
        ];
    }

    /**
     * Mencoba menyambung kembali ke device yang sudah pernah di-pairing sebelumnya
     * tanpa memunculkan dialog pop-up (jika didukung browser).
     */
    async autoConnect() {
        if (!navigator.bluetooth || !navigator.bluetooth.getDevices) {
            console.log('Browser tidak mendukung getDevices()');
            return false;
        }

        try {
            const devices = await navigator.bluetooth.getDevices();
            const savedName = localStorage.getItem('bluetooth_printer_name');
            
            const device = devices.find(d => d.name === savedName);
            if (device) {
                console.log('Menemukan device tersimpan:', device.name);
                return await this.connectDevice(device);
            }
        } catch (error) {
            console.error('AutoConnect gagal:', error);
        }
        return false;
    }

    async connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;

        try {
            console.log('Meminta akses Bluetooth...');
            this.device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: this.serviceUuids
            });

            const success = await this.connectDevice(this.device);
            if (success) {
                localStorage.setItem('bluetooth_printer_name', this.device.name);
            }
            return success;
        } catch (error) {
            console.error('Koneksi Bluetooth gagal:', error);
            if (error.name !== 'NotFoundError') {
                alert('Gagal menghubungkan printer: ' + error.message);
            }
            return false;
        } finally {
            this.isConnecting = false;
        }
    }

    async connectDevice(device) {
        try {
            this.device = device;
            this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

            console.log('Menghubungkan ke GATT Server...');
            this.server = await this.device.gatt.connect();

            console.log('Mencari Service...');
            let service = null;
            
            // Coba satu-satu UUID yang kita tahu
            for (const uuid of this.serviceUuids) {
                try {
                    service = await this.server.getPrimaryService(uuid);
                    if (service) {
                        console.log('Service ditemukan:', uuid);
                        break;
                    }
                } catch (e) {
                    continue; 
                }
            }

            // Jika belum ketemu, coba cari semua service (lambat tapi pasti)
            if (!service) {
                console.log('Mencoba mencari semua services...');
                const services = await this.server.getPrimaryServices();
                if (services.length > 0) service = services[0];
            }

            if (!service) throw new Error("Service printer tidak ditemukan.");

            console.log('Mencari Characteristic...');
            const characteristics = await service.getCharacteristics();
            
            this.characteristic = characteristics.find(c => 
                c.properties.write || c.properties.writeWithoutResponse
            );

            if (!this.characteristic) {
                throw new Error("Tidak menemukan characteristic untuk menulis data.");
            }

            this.isConnected = true;
            console.log('Printer siap!');
            return true;

        } catch (error) {
            console.error('Gagal saat inisialisasi device:', error);
            this.isConnected = false;
            return false;
        }
    }

    onDisconnected(event) {
        console.log('Printer terputus (Disconnected)');
        this.isConnected = false;
        this.characteristic = null;
        this.server = null;
        // Opsional: beritahu UI
        window.dispatchEvent(new CustomEvent('printer-disconnected'));
    }

    async printReceipt(receiptData) {
        if (!this.isConnected || !this.characteristic) {
            // Coba autoConnect dulu jika status false tapi ada device
            if (this.device) {
                const reconnected = await this.connectDevice(this.device);
                if (!reconnected) throw new Error("Printer tidak terhubung.");
            } else {
                throw new Error("Printer belum terhubung.");
            }
        }

        try {
            const encoder = new TextEncoder();
            const ESC = "\x1B";
            const GS = "\x1D";
            const INIT = ESC + "@"; 
            const ALIGN_CENTER = ESC + "a" + "\x01";
            const ALIGN_LEFT = ESC + "a" + "\x00";
            const BOLD_ON = ESC + "E" + "\x01";
            const BOLD_OFF = ESC + "E" + "\x00";
            
            let data = INIT;
            data += ALIGN_CENTER;
            data += BOLD_ON + receiptData.school_name + BOLD_OFF + "\n";
            data += "SISTEM PERPUSTAKAAN\n";
            data += "--------------------------------\n";
            data += (receiptData.is_return ? "BUKTI PENGEMBALIAN" : "BUKTI PEMINJAMAN") + "\n\n";
            
            data += ALIGN_LEFT;
            data += "No Resi : TRX-" + receiptData.transaction_id + "\n";
            data += "Siswa   : " + receiptData.student_name + "\n";
            data += "NISN    : " + receiptData.student_nisn + "\n";
            data += "--------------------------------\n";
            
            data += ALIGN_CENTER;
            data += BOLD_ON + "DATA BUKU\n" + BOLD_OFF;
            data += receiptData.book_title + "\n\n";
            
            data += ALIGN_LEFT;
            data += "Tgl Pinjam    : " + receiptData.borrow_date + "\n";
            data += "Batas Kembali : " + receiptData.expected_return_date + "\n";
            
            if (receiptData.return_date) {
                data += "Dikembalikan  : " + receiptData.return_date + "\n";
                if (receiptData.fine > 0) {
                    data += "--------------------------------\n";
                    data += BOLD_ON + "DENDA         : Rp" + receiptData.fine + BOLD_OFF + "\n";
                }
            }
            
            data += "--------------------------------\n";
            data += ALIGN_CENTER;
            data += "Terima Kasih!\n";
            data += "Harap kembalikan buku tepat\n";
            data += "waktu agar terhindar denda\n\n\n\n"; // Beri ruang extra di bawah
            
            const uint8array = encoder.encode(data);
            const chunkSize = 20; // 20 bytes adalah standard Bluetooth LE MTU yang paling aman (MTU - 3)
            
            for (let i = 0; i < uint8array.length; i += chunkSize) {
                const chunk = uint8array.slice(i, i + chunkSize);
                await this.characteristic.writeValue(chunk);
                // Jeda 20ms agar buffer printer murah tidak overflow
                await new Promise(resolve => setTimeout(resolve, 20)); 
            }

            return true;
        } catch (error) {
            console.error('Gagal mencetak:', error);
            throw error;
        }
    }
}

// Inisialisasi global
window.escposPrinter = new ESCPOSPrinter();
