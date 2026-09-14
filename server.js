const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Config
const ADMIN_USER = 'raksshana';
const ADMIN_PASS = 'raksshaas123';
const isVercel = !!process.env.VERCEL;

// Use /tmp for Vercel (only writable dir), else local
const DATA_FILE = isVercel ? path.join('/tmp', 'products.json') : path.join(__dirname, 'data', 'products.json');
const UPLOAD_DIR = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');

// Ensure dirs and data file
try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, {recursive:true});
  if (!isVercel && !fs.existsSync(path.join(__dirname,'data'))) fs.mkdirSync(path.join(__dirname,'data'), {recursive:true});
  
  if (!fs.existsSync(DATA_FILE)) {
    // Try to copy initial data from repo if exists
    const initialDataPath = path.join(__dirname, 'data', 'products.json');
    if (fs.existsSync(initialDataPath)) {
      const initial = fs.readFileSync(initialDataPath, 'utf8');
      fs.writeFileSync(DATA_FILE, initial);
    } else {
      fs.writeFileSync(DATA_FILE, JSON.stringify([
        {
          "id": "1",
          "title": "Bridal Aari Blouse",
          "price": "Custom Price",
          "description": "Gold zari + stone work — custom for muhurtham. Handmade with love in Salem.",
          "category": "Aari Bridal",
          "tag": "🔥 Bridal Aari",
          "image": "images/aari-blouse-1.jpg",
          "createdAt": "2026-09-14"
        },
        {
          "id": "2",
          "title": "Fairytale Birthday Gown",
          "price": "From ₹2,500",
          "description": "\"Delicate embroidery, dreamy layers\" — for little moments that deserve magic.",
          "category": "Kids Special",
          "tag": "✨ Kids Special",
          "image": "images/kids-gown.jpg",
          "createdAt": "2026-09-14"
        },
        {
          "id": "3",
          "title": "Designer Blouse Stitching",
          "price": "From ₹850",
          "description": "From threads to tradition — your design, our stitching, perfect fit.",
          "category": "Custom",
          "tag": "🪡 Custom",
          "image": "images/product-3.jpg",
          "createdAt": "2026-09-14"
        }
      ], null, 2));
    }
  }
} catch(e){
  console.error('Init error:', e.message);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));

// Simple token store (in-memory)
const validTokens = new Set();
function generateToken() {
  return Buffer.from(`admin-${Date.now()}-${Math.random()}`).toString('base64');
}
function authMiddleware(req,res,next){
  const auth = req.headers['authorization'];
  if(!auth) return res.status(401).json({error:'No token'});
  const token = auth.replace('Bearer ','');
  if(!validTokens.has(token)) return res.status(401).json({error:'Invalid token'});
  next();
}

// Multer config
const storage = multer.diskStorage({
  destination: (req,file,cb)=> cb(null, UPLOAD_DIR),
  filename: (req,file,cb)=>{
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.random().toString(36).substring(2,8) + ext;
    cb(null, name);
  }
});
const upload = multer({ 
  storage,
  limits:{fileSize: 8*1024*1024},
  fileFilter: (req,file,cb)=>{
    if(file.mimetype.startsWith('image/')) cb(null,true);
    else cb(new Error('Only images allowed'));
  }
});

// Helpers
function readProducts(){
  try{ return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); } catch(e){ console.error('Read error', e.message); return []; }
}
function writeProducts(products){
  try{
    fs.writeFileSync(DATA_FILE, JSON.stringify(products,null,2));
  }catch(e){
    console.error('Write error (Vercel FS is ephemeral):', e.message);
    // On Vercel, filesystem is ephemeral - this is expected, but we try anyway
  }
}

// API Routes
app.get('/api/health', (req,res)=>{
  res.json({status:'ok', vercel:isVercel, products: readProducts().length});
});

app.post('/api/login', (req,res)=>{
  const {username, password} = req.body;
  console.log('Login attempt:', username);
  if(username === ADMIN_USER && password === ADMIN_PASS){
    const token = generateToken();
    validTokens.add(token);
    setTimeout(()=> validTokens.delete(token), 12*60*60*1000);
    return res.json({success:true, token, username});
  }
  res.status(401).json({success:false, error:'Invalid username or password'});
});

app.get('/api/auth-check', authMiddleware, (req,res)=>{
  res.json({valid:true});
});

app.get('/api/products', (req,res)=>{
  const products = readProducts();
  res.json(products.slice().reverse());
});

app.post('/api/products', authMiddleware, upload.single('image'), (req,res)=>{
  try{
    const {title, price, description, category, tag} = req.body;
    if(!title) return res.status(400).json({error:'Title required'});
    const products = readProducts();
    const newProduct = {
      id: Date.now().toString(),
      title: title.trim(),
      price: price?.trim() || 'DM for Price',
      description: description?.trim() || '',
      category: category?.trim() || 'Custom',
      tag: tag?.trim() || '✨ New',
      image: req.file ? `/uploads/${req.file.filename}` : (req.body.imageUrl || 'images/product-1.jpg'),
      createdAt: new Date().toISOString().split('T')[0]
    };
    products.push(newProduct);
    writeProducts(products);
    console.log('Product added:', newProduct.title);
    res.json({success:true, product:newProduct});
  }catch(e){
    console.error(e);
    res.status(500).json({error:e.message});
  }
});

app.put('/api/products/:id', authMiddleware, upload.single('image'), (req,res)=>{
  const products = readProducts();
  const idx = products.findIndex(p=>p.id===req.params.id);
  if(idx===-1) return res.status(404).json({error:'Not found'});
  const {title, price, description, category, tag} = req.body;
  if(title) products[idx].title = title.trim();
  if(price) products[idx].price = price.trim();
  if(description) products[idx].description = description.trim();
  if(category) products[idx].category = category.trim();
  if(tag) products[idx].tag = tag.trim();
  if(req.file) products[idx].image = `/uploads/${req.file.filename}`;
  else if(req.body.imageUrl) products[idx].image = req.body.imageUrl;
  writeProducts(products);
  res.json({success:true, product:products[idx]});
});

app.delete('/api/products/:id', authMiddleware, (req,res)=>{
  let products = readProducts();
  const found = products.find(p=>p.id===req.params.id);
  if(!found) return res.status(404).json({error:'Not found'});
  if(found.image && found.image.startsWith('/uploads/')){
    try{
      const fileName = path.basename(found.image);
      const filePath = path.join(UPLOAD_DIR, fileName);
      if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }catch(e){console.error('Delete file error', e.message);}
  }
  products = products.filter(p=>p.id!==req.params.id);
  writeProducts(products);
  res.json({success:true});
});

// Serve uploads
app.use('/uploads', express.static(UPLOAD_DIR));
// Serve static files (website) - but exclude server.js etc via express static will serve
app.use(express.static(__dirname, {
  // Don't serve server.js as static for security, but it's okay
}));

// Fallback for admin and SPA
app.get('/admin', (req,res)=>{
  res.sendFile(path.join(__dirname,'admin.html'));
});

// For any other route that is not API and not a file, serve index.html (for SPA)
app.get('*', (req,res, next)=>{
  if(req.path.startsWith('/api/')) return next();
  if(req.path.includes('.')) return next(); // Let static handle files with extensions
  // For root, serve index
  if(req.path === '/' || req.path === '/index.html'){
    return res.sendFile(path.join(__dirname,'index.html'));
  }
  next();
});

// Only listen if run directly (not in Vercel serverless)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', ()=>{
    console.log(`✅ Raksshaas Fashion CMS running on http://0.0.0.0:${PORT}`);
    console.log(`Admin: http://0.0.0.0:${PORT}/admin`);
    console.log(`Login: ${ADMIN_USER} / ${ADMIN_PASS}`);
    console.log(`Vercel mode: ${isVercel}`);
  });
}

// For Vercel serverless
module.exports = app;
