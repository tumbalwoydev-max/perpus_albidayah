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
            
            let allData = new Uint8Array();
            const concat = (arr1, arr2) => {
                let res = new Uint8Array(arr1.length + arr2.length);
                res.set(arr1);
                res.set(arr2, arr1.length);
                return res;
            };

            // 1. Initialize
            allData = concat(allData, encoder.encode(INIT));

            // 2. Logo (jika ada)
            if (receiptData.logo_url) {
                console.log('Memproses logo:', receiptData.logo_url);
                try {
                    const logoData = await this.getImagePrintData(receiptData.logo_url, 180); // Max width 180px agar pas
                    allData = concat(allData, encoder.encode(ALIGN_CENTER));
                    allData = concat(allData, logoData);
                    allData = concat(allData, encoder.encode("\n"));
                } catch (err) {
                    console.error('Gagal memproses logo, lanjut cetak teks saja:', err);
                }
            }
            
            // 3. Header & Content
            let textData = "";
            textData += ALIGN_CENTER;
            textData += BOLD_ON + receiptData.school_name + BOLD_OFF + "\n";
            textData += "SISTEM PERPUSTAKAAN\n";
            textData += "--------------------------------\n";
            textData += (receiptData.is_return ? "BUKTI PENGEMBALIAN" : "BUKTI PEMINJAMAN") + "\n\n";
            
            textData += ALIGN_LEFT;
            textData += "No Resi : TRX-" + receiptData.transaction_id + "\n";
            textData += "Siswa   : " + receiptData.student_name + "\n";
            textData += "NISN    : " + receiptData.student_nisn + "\n";
            textData += "--------------------------------\n";
            
            textData += ALIGN_CENTER;
            textData += BOLD_ON + "DATA BUKU\n" + BOLD_OFF;
            textData += receiptData.book_title + "\n\n";
            
            textData += ALIGN_LEFT;
            textData += "Tgl Pinjam    : " + receiptData.borrow_date + "\n";
            textData += "Batas Kembali : " + receiptData.expected_return_date + "\n";
            
            if (receiptData.return_date) {
                textData += "Dikembalikan  : " + receiptData.return_date + "\n";
                if (receiptData.fine > 0) {
                    textData += "--------------------------------\n";
                    textData += BOLD_ON + "DENDA         : Rp" + receiptData.fine + BOLD_OFF + "\n";
                }
            }
            
            textData += "--------------------------------\n";
            textData += ALIGN_CENTER;
            textData += "Terima Kasih!\n";
            textData += "Harap kembalikan buku tepat\n";
            textData += "waktu agar terhindar denda\n\n\n\n";
            
            allData = concat(allData, encoder.encode(textData));

            // 4. Send in chunks
            const chunkSize = 20; 
            for (let i = 0; i < allData.length; i += chunkSize) {
                const chunk = allData.slice(i, i + chunkSize);
                await this.characteristic.writeValue(chunk);
                await new Promise(resolve => setTimeout(resolve, 20)); 
            }

            return true;
        } catch (error) {
            console.error('Gagal mencetak:', error);
            throw error;
        }
    }

    /**
     * Mengubah Image URL menjadi ESC/POS Bitmap Data (GS v 0)
     */
    async getImagePrintData(url, maxWidth) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Hitung aspek rasio agar tidak penyet
                const scale = maxWidth / img.width;
                const width = maxWidth;
                const height = Math.floor(img.height * scale);
                
                // Width harus kelipatan 8 dots (1 byte per 8 dots)
                const realWidth = Math.ceil(width / 8) * 8;
                
                canvas.width = realWidth;
                canvas.height = height;
                
                // Putih sebagai background
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, width, height);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixels = imageData.data;
                const bitmap = [];
                
                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x += 8) {
                        let byte = 0;
                        for (let b = 0; b < 8; b++) {
                            const i = ((y * canvas.width) + (x + b)) * 4;
                            // Threshold: Ambil nilai rata-rata RGB, jika < 128 maka Hitam (1)
                            const luminance = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
                            if (luminance < 128) {
                                byte |= (1 << (7 - b));
                            }
                        }
                        bitmap.push(byte);
                    }
                }
                
                // GS v 0 m xL xH yL yH data
                const xL = (canvas.width / 8) % 256;
                const xH = Math.floor((canvas.width / 8) / 256);
                const yL = canvas.height % 256;
                const yH = Math.floor(canvas.height / 256);
                
                const header = new Uint8Array([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
                const res = new Uint8Array(header.length + bitmap.length);
                res.set(header);
                res.set(new Uint8Array(bitmap), header.length);
                
                resolve(res);
            };
            img.onerror = reject;
            img.src = url;
        });
    }
}

// Inisialisasi global
window.escposPrinter = new ESCPOSPrinter();
