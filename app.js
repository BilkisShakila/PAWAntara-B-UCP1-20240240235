const express = require('express');
const path = require('path');
const session = require('express-session'); // Tambahan package session
const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi View Engine EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware Bawaan
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi Session (Supaya status login tersimpan aman di server)
app.use(session({
    secret: 'rahasia-toko-sembako-ariesta',
    resave: false,
    saveUninitialized: true
}));

// 1. Custom Middleware: Logger
const requestLogger = (req, res, next) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] ${req.method} request ke ${req.url}`);
    next();
};
app.use(requestLogger);

// 2. Data Persistence (In-Memory Array)
// 2. Data Persistence (In-Memory Array) - Perbarui bagian ini:
let products = [
    { id: 1, name: "Beras Pandan Wangi 5kg", category: "sembako", price: 75000, stock: 20, image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80" },
    { id: 2, name: "Gula Pasir 1kg", category: "sembako", price: 15000, stock: 50, image: "https://th.bing.com/th/id/OIP.CrLni2j0zh_8J2iXZIkDhgHaHa?w=128&h=150&c=6&r=0&o=7&dpr=1.5&pid=1.7&rm=3" },
    { id: 3, name: "Minyak Goreng 2L", category: "sembako", price: 32000, stock: 15, image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80" },
    { id: 4, name: "Telur Ayam 1kg", category: "sembako", price: 28000, stock: 30, image: "https://images.pexels.com/photos/162712/egg-white-food-protein-162712.jpeg?auto=compress&cs=tinysrgb&w=600" },
    { id: 5, name: "Tepung Terigu 1kg", category: "sembako", price: 12000, stock: 40, image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80" },
    { id: 6, name: "Mie Instan (dus 10)", category: "sembako", price: 110000, stock: 100, image: "https://images.pexels.com/photos/803963/pexels-photo-803963.jpeg?auto=compress&cs=tinysrgb&w=600" }
];

// Akun Admin
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123'; // Bisa kamu ubah sesuai keinginan

// 3. Middleware Auth Khusus Web Session
const requireLogin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    // Jika belum login, kembalikan response Unauthorized atau redirect
    return res.status(401).json({ status: "error", message: 'Unauthorized, silakan login terlebih dahulu' });
};

// --- ROUTING HALAMAN (VIEWS) ---
app.get('/', (req, res) => {
    res.render('index', { products });
});

app.get('/produk', (req, res) => {
    let filteredProducts = products;
    const search = req.query.search || '';
    const kategori = req.query.kategori || '';

    if (search) {
        filteredProducts = filteredProducts.filter(p => 
            p.name.toLowerCase().includes(search.toLowerCase())
        );
    }

    if (kategori) {
        filteredProducts = filteredProducts.filter(p => p.category === kategori);
    }

    res.render('produk', { products: filteredProducts, search, kategori });
});

app.get('/produk/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const product = products.find(p => p.id === id);
    
    if (!product) {
        return res.status(404).render('404', { message: 'Produk tidak ditemukan' });
    }
    res.render('detail-produk', { product });
});

app.get('/tanya-ai', (req, res) => res.render('tanya-ai'));
app.get('/login', (req, res) => res.render('login'));

// Halaman Dashboard diproteksi: hanya bisa dibuka jika sudah login
app.get('/dashboard', (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/login');
    }
    res.render('dashboard', { products });
});

// --- HANDLE LOGIN DARI FORM HTML ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // Set status login di dalam session
        req.session.isAdmin = true;
        // Langsung arahkan ke dashboard
        return res.redirect('/dashboard');
    } else {
        return res.send('Login gagal! Username atau password salah. <a href="/login">Coba lagi</a>');
    }
});

// --- HANDLE LOGOUT ---
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// --- ENDPOINTS CRUD PRODUK (Menggunakan Session Auth) ---
app.get('/api/products', (req, res) => {
    res.json({ status: "success", data: products });
});

app.post('/api/products', requireLogin, (req, res) => {
    const { name, category, price, stock } = req.body;
    const newProduct = { 
        id: Date.now(), 
        name, 
        category: category || 'sembako', 
        price: Number(price), 
        stock: Number(stock) 
    };
    products.push(newProduct);
    res.status(201).json({ status: "success", message: 'Produk ditambahkan', data: newProduct });
});

app.delete('/api/products/:id', requireLogin, (req, res) => {
    const id = parseInt(req.params.id);
    const initialLength = products.length;
    products = products.filter(p => p.id !== id);
    
    if (products.length < initialLength) {
        res.json({ status: "success", message: 'Produk dihapus' });
    } else {
        res.status(404).json({ status: "error", message: 'Produk tidak ditemukan' });
    }
});

app.put('/api/products/:id', requireLogin, (req, res) => {
    const id = parseInt(req.params.id);
    const { name, category, price, stock } = req.body;
    
    const product = products.find(p => p.id === id);
    if (!product) {
        return res.status(404).json({ status: "error", message: 'Produk tidak ditemukan' });
    }

    if (name) product.name = name;
    if (category) product.category = category;
    if (price) product.price = Number(price);
    if (stock) product.stock = Number(stock);

    res.json({ status: "success", message: 'Produk berhasil diperbarui', data: product });
});

// --- ENDPOINT CHAT AI DUMMY ---
app.post('/api/chat', (req, res) => {
    const { message } = req.body;
    const msgLower = message ? message.toLowerCase() : '';
    
    let reply = "Terima kasih pertanyaannya. Silakan hubungi kontak layanan pesan antar kami untuk info ketersediaan barang secara langsung ya!";

    if (msgLower.includes('jam buka') || msgLower.includes('buka')) {
        reply = "Toko Sembako Ariesta buka setiap hari dari jam 07.00 pagi sampai 21.00 malam WIB.";
    } else if (msgLower.includes('ongkir') || msgLower.includes('antar')) {
        reply = "Untuk pengantaran ke rumah, ongkirnya flat Rp 5.000 untuk maksimal jarak 3km dari toko.";
    } else if (msgLower.includes('bayar') || msgLower.includes('pembayaran')) {
        reply = "Kamu bisa bayar pakai Uang Tunai saat barang diantar (COD) atau scan QRIS lewat kurir kami.";
    } else if (msgLower.includes('beras') || msgLower.includes('stok') || msgLower.includes('ada')) {
        reply = "Stok beras dan sembako lainnya tersedia lengkap! Silakan cek langsung di Halaman Produk ya.";
    } else if (msgLower.includes('halo') || msgLower.includes('hai') || msgLower.includes('hay')) {
        reply = "Halo! Ada yang bisa saya bantu seputar produk Toko Sembako Ariesta?";
    }

    res.json({ reply }); // Sesuaikan dengan struktur JSON yang dibaca oleh frontend kamu
});
app.post('/api/chat', (req, res) => {
    res.json({ 
        status: "success", 
        data: { 
            reply: "Toko kami buka setiap hari jam 07.00 - 20.00!" 
        } 
    });
});

// Menyalakan Server
// update langkah 5
app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));