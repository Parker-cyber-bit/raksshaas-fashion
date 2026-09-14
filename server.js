require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const { createClient } = require('@supabase/supabase-js');


// ======================================================
// SUPABASE
// ======================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY
);


// ======================================================
// APP
// ======================================================

const app = express();

const PORT = process.env.PORT || 3000;


// ======================================================
// CONFIG
// ======================================================

const ADMIN_USER = process.env.ADMIN_USER || 'raksshana';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Raksshaas0124';

const TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET ||
  'change-this-secret-before-production';

const BUCKET_NAME =
  process.env.SUPABASE_BUCKET || 'products-images';


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);


// ======================================================
// MULTER
// ======================================================
//
// IMPORTANT:
// We use memoryStorage instead of diskStorage.
// This is necessary because Vercel's filesystem is
// temporary and should not be used for permanent uploads.
//

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 8 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {

    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }

  }
});


// ======================================================
// AUTH TOKEN
// ======================================================

function createToken() {

  const timestamp = Date.now().toString();

  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(timestamp)
    .digest('hex');

  return `${timestamp}.${signature}`;
}


function verifyToken(token) {

  if (!token) return false;

  const parts = token.split('.');

  if (parts.length !== 2) {
    return false;
  }

  const timestamp = parts[0];
  const signature = parts[1];

  const tokenTime = Number(timestamp);

  if (!Number.isFinite(tokenTime)) {
    return false;
  }

  // 12 hours
  const TOKEN_LIFETIME = 12 * 60 * 60 * 1000;

  if (Date.now() - tokenTime > TOKEN_LIFETIME) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(timestamp)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}


function authMiddleware(req, res, next) {

  const auth = req.headers.authorization;

  if (!auth) {
    return res.status(401).json({
      error: 'No token'
    });
  }

  const token = auth.startsWith('Bearer ')
    ? auth.slice(7)
    : auth;

  if (!verifyToken(token)) {
    return res.status(401).json({
      error: 'Invalid or expired token'
    });
  }

  next();
}


// ======================================================
// SUPABASE STORAGE
// ======================================================

async function ensureBucket() {

  const { data, error } =
    await supabase.storage.getBucket(BUCKET_NAME);

  if (!error && data) {

    // Make sure the bucket is public.
    if (data.public !== true) {

      const { error: updateError } =
        await supabase.storage.updateBucket(
          BUCKET_NAME,
          {
            public: true
          }
        );

      if (updateError) {
        console.error(
          '⚠️ Could not make bucket public:',
          updateError.message
        );
      }
    }

    return;
  }


  // Bucket doesn't exist -> create it

  const { error: createError } =
    await supabase.storage.createBucket(
      BUCKET_NAME,
      {
        public: true,
        allowedMimeTypes: ['image/*'],
        fileSizeLimit: '8MB'
      }
    );

  if (createError) {

    // Ignore "already exists" type situations.
    if (
      !createError.message
        ?.toLowerCase()
        .includes('already exists')
    ) {
      throw createError;
    }

  }

  console.log(
    `✅ Supabase Storage bucket ready: ${BUCKET_NAME}`
  );
}


// ======================================================
// IMAGE HELPERS
// ======================================================

function getFileExtension(file) {

  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif'
  };

  return mimeMap[file.mimetype] || 'jpg';
}


function generateImagePath(file) {

  const extension = getFileExtension(file);

  const randomName =
    crypto.randomBytes(16).toString('hex');

  return `products/${Date.now()}-${randomName}.${extension}`;
}


function getPublicImageUrl(filePath) {

  const { data } =
    supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

  return data.publicUrl;
}


function getStoragePathFromUrl(imageUrl) {

  if (!imageUrl) {
    return null;
  }

  const marker =
    `/storage/v1/object/public/${BUCKET_NAME}/`;

  const index = imageUrl.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return decodeURIComponent(
    imageUrl.substring(index + marker.length)
  );
}


async function uploadImage(file) {

  if (!file) {
    return null;
  }

  await ensureBucket();

  const filePath = generateImagePath(file);

  const {
    error
  } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(
      filePath,
      file.buffer,
      {
        contentType: file.mimetype,
        cacheControl: '31536000',
        upsert: false
      }
    );

  if (error) {
    throw error;
  }

  return {
    path: filePath,
    url: getPublicImageUrl(filePath)
  };
}


async function deleteImage(imageUrl) {

  const storagePath =
    getStoragePathFromUrl(imageUrl);

  if (!storagePath) {
    return;
  }

  const {
    error
  } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    console.error(
      '⚠️ Could not delete image:',
      error.message
    );
  }
}


// ======================================================
// PRODUCT FORMATTER
// ======================================================

function formatProduct(product) {

  return {
    id: String(product.id),

    title: product.title || '',

    price:
      product.price ||
      'DM for Price',

    description:
      product.description ||
      '',

    category:
      product.category ||
      'Custom',

    tag:
      product.tag ||
      '✨ New',

    image:
      product.image ||
      '',

    createdAt:
      product.created_at
        ? new Date(product.created_at)
            .toISOString()
            .split('T')[0]
        : ''
  };
}


// ======================================================
// BASIC ROUTES
// ======================================================

app.get('/api/health', (req, res) => {

  res.json({
    status: 'ok'
  });

});


// ======================================================
// LOGIN
// ======================================================

app.post('/api/login', (req, res) => {

  const {
    username,
    password
  } = req.body;


  console.log(
    'Login attempt:',
    username
  );


  if (
    username === ADMIN_USER &&
    password === ADMIN_PASS
  ) {

    const token = createToken();

    return res.json({

      success: true,

      token,

      username

    });

  }


  return res.status(401).json({

    success: false,

    error: 'Invalid username or password'

  });

});


// ======================================================
// AUTH CHECK
// ======================================================

app.get(
  '/api/auth-check',
  authMiddleware,
  (req, res) => {

    res.json({
      valid: true
    });

  }
);


// ======================================================
// GET PRODUCTS
// ======================================================

app.get('/api/products', async (req, res) => {

  try {

    const {
      data,
      error
    } = await supabase
      .from('products')
      .select('*')
      .order(
        'created_at',
        {
          ascending: false
        }
      );


    if (error) {
      console.error(
        'Supabase products error:',
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }


    const products =
      (data || []).map(formatProduct);


    res.json(products);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: error.message
    });

  }

});


// ======================================================
// ADD PRODUCT
// ======================================================

app.post(
  '/api/products',
  authMiddleware,
  upload.single('image'),

  async (req, res) => {

    let uploadedImage = null;

    try {

      const {
        title,
        price,
        description,
        category,
        tag
      } = req.body;


      // ----------------------------
      // Validation
      // ----------------------------

      if (!title || !title.trim()) {

        return res.status(400).json({
          error: 'Title required'
        });

      }


      // ----------------------------
      // Upload image
      // ----------------------------

      if (req.file) {

        uploadedImage =
          await uploadImage(req.file);

      }


      // ----------------------------
      // Product data
      // ----------------------------

      const product = {

        title: title.trim(),

        price:
          price?.trim() ||
          'DM for Price',

        description:
          description?.trim() ||
          '',

        category:
          category?.trim() ||
          'Custom',

        tag:
          tag?.trim() ||
          '✨ New',

        image:
          uploadedImage?.url ||
          req.body.imageUrl ||
          '',

        created_at:
          new Date().toISOString()

      };


      // ----------------------------
      // Insert into Supabase
      // ----------------------------

      const {
        data,
        error
      } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();


      if (error) {

        // If DB insert failed,
        // remove uploaded image.
        if (uploadedImage) {

          await deleteImage(
            uploadedImage.url
          );

        }

        console.error(
          'Supabase insert error:',
          error
        );

        return res.status(500).json({
          error: error.message
        });

      }


      console.log(
        '✅ Product added:',
        data.title
      );


      res.json({

        success: true,

        product:
          formatProduct(data)

      });


    } catch (error) {

      if (uploadedImage) {

        await deleteImage(
          uploadedImage.url
        );

      }

      console.error(
        'Add product error:',
        error
      );

      res.status(500).json({
        error: error.message
      });

    }

  }
);


// ======================================================
// UPDATE PRODUCT
// ======================================================

app.put(
  '/api/products/:id',
  authMiddleware,
  upload.single('image'),

  async (req, res) => {

    let uploadedImage = null;

    try {

      const productId =
        req.params.id;


      // ----------------------------
      // Find existing product
      // ----------------------------

      const {
        data: existingProduct,
        error: findError
      } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();


      if (findError || !existingProduct) {

        return res.status(404).json({
          error: 'Product not found'
        });

      }


      // ----------------------------
      // Upload replacement image
      // ----------------------------

      if (req.file) {

        uploadedImage =
          await uploadImage(req.file);

      }


      // ----------------------------
      // Build update
      // ----------------------------

      const updateData = {};


      if (
        req.body.title !== undefined
      ) {

        updateData.title =
          req.body.title.trim();

      }


      if (
        req.body.price !== undefined
      ) {

        updateData.price =
          req.body.price.trim();

      }


      if (
        req.body.description !== undefined
      ) {

        updateData.description =
          req.body.description.trim();

      }


      if (
        req.body.category !== undefined
      ) {

        updateData.category =
          req.body.category.trim();

      }


      if (
        req.body.tag !== undefined
      ) {

        updateData.tag =
          req.body.tag.trim();

      }


      // New uploaded image
      if (uploadedImage) {

        updateData.image =
          uploadedImage.url;

      }

      // Image URL entered manually
      else if (req.body.imageUrl) {

        updateData.image =
          req.body.imageUrl;

      }


      // ----------------------------
      // Update Supabase
      // ----------------------------

      const {
        data,
        error
      } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .select()
        .single();


      if (error) {

        if (uploadedImage) {

          await deleteImage(
            uploadedImage.url
          );

        }

        console.error(
          'Supabase update error:',
          error
        );

        return res.status(500).json({
          error: error.message
        });

      }


      // ----------------------------
      // Delete old image
      // ----------------------------

      if (
        uploadedImage &&
        existingProduct.image &&
        existingProduct.image !== uploadedImage.url
      ) {

        await deleteImage(
          existingProduct.image
        );

      }


      res.json({

        success: true,

        product:
          formatProduct(data)

      });


    } catch (error) {

      if (uploadedImage) {

        await deleteImage(
          uploadedImage.url
        );

      }

      console.error(
        'Update product error:',
        error
      );

      res.status(500).json({
        error: error.message
      });

    }

  }
);


// ======================================================
// DELETE PRODUCT
// ======================================================

app.delete(
  '/api/products/:id',
  authMiddleware,

  async (req, res) => {

    try {

      const productId =
        req.params.id;


      // ----------------------------
      // Find product
      // ----------------------------

      const {
        data: product,
        error: findError
      } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();


      if (findError || !product) {

        return res.status(404).json({
          error: 'Product not found'
        });

      }


      // ----------------------------
      // Delete database row
      // ----------------------------

      const {
        error: deleteError
      } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);


      if (deleteError) {

        console.error(
          'Supabase delete error:',
          deleteError
        );

        return res.status(500).json({
          error: deleteError.message
        });

      }


      // ----------------------------
      // Delete image
      // ----------------------------

      if (product.image) {

        await deleteImage(
          product.image
        );

      }


      console.log(
        '✅ Product deleted:',
        product.title
      );


      res.json({
        success: true
      });


    } catch (error) {

      console.error(
        'Delete product error:',
        error
      );

      res.status(500).json({
        error: error.message
      });

    }

  }
);


// ======================================================
// SUPABASE TEST
// ======================================================

app.get(
  '/api/supabase-test',

  async (req, res) => {

    try {

      const {
        data,
        error
      } = await supabase
        .from('products')
        .select('*')
        .limit(1);


      if (error) {

        console.error(
          'Supabase error:',
          error
        );

        return res.status(500).json({

          connected: false,

          error:
            error.message

        });

      }


      res.json({

        connected: true,

        message:
          'Supabase connection working!',

        data

      });


    } catch (error) {

      res.status(500).json({

        connected: false,

        error:
          error.message

      });

    }

  }
);


// ======================================================
// STATIC WEBSITE
// ======================================================
//
// IMPORTANT:
// We DO NOT use:
// app.use(express.static(__dirname))
//
// because that could expose files such as .env/server.js.
//
// Instead we explicitly serve the folders/files we need.
//

app.use(
  '/images',
  express.static(
    path.join(__dirname, 'images')
  )
);


app.use(
  '/public',
  express.static(
    path.join(__dirname, 'public')
  )
);


// Optional existing static project folder
app.use(
  '/raksshaas-fashion',
  express.static(
    path.join(__dirname, 'raksshaas-fashion')
  )
);


// Homepage
app.get('/', (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      'index.html'
    )
  );

});


// Admin page
app.get('/admin', (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      'admin.html'
    )
  );

});


// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
  (err, req, res, next) => {

    console.error(
      'Server error:',
      err
    );


    if (
      err instanceof multer.MulterError
    ) {

      return res.status(400).json({
        error:
          `Upload error: ${err.message}`
      });

    }


    if (
      err.message ===
      'Only image files are allowed'
    ) {

      return res.status(400).json({
        error: err.message
      });

    }


    res.status(500).json({
      error:
        err.message ||
        'Internal server error'
    });

  }
);


// ======================================================
// LOCAL SERVER
// ======================================================
//
// Vercel imports this file instead of calling listen().
//

if (require.main === module) {

  app.listen(
    PORT,
    '0.0.0.0',
    () => {

      console.log(
        `✅ Raksshaas Fashion CMS running on http://localhost:${PORT}`
      );

      console.log(
        `Admin: http://localhost:${PORT}/admin`
      );

      console.log(
        `Supabase: ${SUPABASE_URL}`
      );

      console.log(
        `Storage bucket: ${BUCKET_NAME}`
      );

    }
  );

}


// ======================================================
// VERCEL
// ======================================================

module.exports = app;