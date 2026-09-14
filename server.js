const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Config
const ADMIN_USER = 'raksshana';
const ADMIN_PASS = 'raksshaas123'; // Change this!
const DATA_FILE = path.join(__dirname, 'data', 'products.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure dirs
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, {recursive:true});
if (!fs.existsSync(path.join(__dirname,'data'))) fs.mkdirSync(path.join(__dirname,'data'), {recursive:true});
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

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
  try{ return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); } catch(e){ return []; }
}
function writeProducts(products){
  fs.writeFileSync(DATA_FILE, JSON.stringify(products,null,2));
}

// API Routes
app.post('/api/login', (req,res)=>{
  const {username, password} = req.body;
  console.log('Login attempt:', username);
  if(username === ADMIN_USER && password === ADMIN_PASS){
    const token = generateToken();
    validTokens.add(token);
    // Auto-expire after 12h
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
  // Newest first
  res.json(products.reverse());
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
  // Try delete file if in uploads
  if(found.image && found.image.startsWith('/uploads/')){
    const filePath = path.join(__dirname, found.image);
    if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  products = products.filter(p=>p.id!==req.params.id);
  writeProducts(products);
  res.json({success:true});
});

// Serve uploads
app.use('/uploads', express.static(UPLOAD_DIR));
// Serve static files (website)
app.use(express.static(__dirname));

// Fallback for admin
app.get('/admin', (req,res)=>{
  res.sendFile(path.join(__dirname,'admin.html'));
});

app.listen(PORT, '0.0.0.0', ()=>{
  console.log(`✅ Raksshaas Fashion CMS running on http://0.0.0.0:${PORT}`);
  console.log(`Admin: http://0.0.0.0:${PORT}/admin`);
  console.log(`Login: ${ADMIN_USER} / ${ADMIN_PASS}`);
});

// For Vercel serverless
module.exports = app;
