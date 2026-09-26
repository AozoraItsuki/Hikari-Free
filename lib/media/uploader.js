import FormData from 'form-data';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { hkNet } from '../utils/network.js';
const UPLOAD_SERVICES = {
  maelyn: 'https://cdn.maelyn.sbs/api/upload',
  catbox: 'https://catbox.moe/user/api.php',
  telegraph: 'https://telegra.ph/upload',
  fileio: 'https://file.io',
  tmpfiles: 'https://tmpfiles.org/api/v1/upload',
  '0x0': 'https://0x0.st',
  filebin: 'https://filebin.net',
  transfersh: 'https://transfer.sh',
  uguu: 'https://uguu.se/upload.php',
  anonfiles: 'https://api.anonfiles.com/upload',
  tempsh: 'https://temp.sh/upload',
  pixeldrain: 'https://pixeldrain.com/api/file',
};
const DEFAULT_CONFIG = {
  timeout: 30000,
  maxRetries: 2,
  retryDelay: 1000,
  maxSize: 100 * 1024 * 1024,
  defaultMime: 'application/octet-stream',
  defaultExt: 'bin',
  userAgent:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};
const validateInput = (fileBuffer, options) => {
  if (!(fileBuffer instanceof Buffer)) {
    throw new Error('Input must be a Buffer');
  }
  const { maxSize, allowedMimeTypes } = options;
  if (maxSize && fileBuffer.length > maxSize) {
    throw new Error(`File size ${fileBuffer.length} bytes exceeds max size ${maxSize} bytes`);
  }
  return fileBuffer.length > 0;
};
const detectFileType = async (fileBuffer, filename) => {
  const detected = await fileTypeFromBuffer(fileBuffer);
  if (!detected) {
    const ext = filename ? filename.split('.').pop() : DEFAULT_CONFIG.defaultExt;
    return {
      ext: ext || DEFAULT_CONFIG.defaultExt,
      mime: DEFAULT_CONFIG.defaultMime,
    };
  }
  return detected;
};
const generateFilename = (originalFilename, ext) => {
  return originalFilename || `${crypto.randomBytes(8).toString('hex')}.${ext}`;
};
const createRetryDelay = (attempt, baseDelay = DEFAULT_CONFIG.retryDelay) => {
  return new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1)));
};
const uploaders = {
  async maelyn(fileBuffer, filename, mime, options) {
    const formData = new FormData();
    formData.append('file', fileBuffer, filename);
    const response = await hkNet.post(UPLOAD_SERVICES.maelyn, formData, {
      headers: {
        ...formData.getHeaders(),
        'User-Agent': DEFAULT_CONFIG.userAgent,
        ...options.headers,
      },
      timeout: options.timeout,
    });
    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    return response.data;
  },
  async catbox(fileBuffer, filename, mime, options) {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', fileBuffer, filename);
    const response = await hkNet.post(UPLOAD_SERVICES.catbox, formData, {
      headers: {
        ...formData.getHeaders(),
        'User-Agent': DEFAULT_CONFIG.userAgent,
        ...options.headers,
      },
      timeout: options.timeout,
    });
    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    const result = response.data;
    if (!result.startsWith('https://')) {
      throw new Error('Upload failed: Invalid response URL');
    }
    return result.trim();
  },
  async telegraph(fileBuffer, filename, mime, options) {
    const formData = new FormData();
    formData.append('file', fileBuffer, filename);
    const response = await hkNet.post(UPLOAD_SERVICES.telegraph, formData, {
      headers: {
        ...formData.getHeaders(),
        'User-Agent': DEFAULT_CONFIG.userAgent,
        ...options.headers,
      },
      timeout: options.timeout,
    });
    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    const result = response.data;
    if (!result[0]?.src) {
      throw new Error('Upload failed: Invalid response');
    }
    return `https://telegra.ph${result[0].src}`;
  },
  async fileio(fileBuffer, filename, mime, options) {
    const formData = new FormData();
    formData.append('file', fileBuffer, filename);
    const response = await hkNet.post(UPLOAD_SERVICES.fileio, formData, {
      headers: {
        ...formData.getHeaders(),
        'User-Agent': DEFAULT_CONFIG.userAgent,
        ...options.headers,
      },
      timeout: options.timeout,
    });
    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    const result = response.data;
    if (!result.success) {
      throw new Error('Upload failed: ' + result.message);
    }
    return result.link;
  },
  async tmpfiles(fileBuffer, filename, mime, options) {
    const formData = new FormData();
    formData.append('file', fileBuffer, filename);
    const response = await hkNet.post(UPLOAD_SERVICES.tmpfiles, formData, {
      headers: {
        ...formData.getHeaders(),
        'User-Agent': DEFAULT_CONFIG.userAgent,
        ...options.headers,
      },
      timeout: options.timeout,
    });
    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    const result = response.data;
    if (result.status !== 'success') {
      throw new Error('Upload failed: ' + result.error?.message);
    }
    return result.data.url;
  },
  async '0x0'(fileBuffer, filename, mime, options) {
    const formData = new FormData();
    formData.append('file', fileBuffer, filename);
    const response = await hkNet.post(UPLOAD_SERVICES['0x0'], formData, {
      headers: {
        ...formData.getHeaders(),
        'User-Agent': DEFAULT_CONFIG.userAgent,
        ...options.headers,
      },
      timeout: options.timeout,
    });
    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    const result = response.data;
    const url = result.trim();
    if (!url.startsWith('https://')) {
      throw new Error('Upload failed: Invalid response URL');
    }
    return url;
  },
  async filebin(fileBuffer, filename, mime, options) {
    const binId = crypto.randomBytes(8).toString('hex');
    const response = await hkNet.post(
      `${UPLOAD_SERVICES.filebin}/${binId}/${filename}`,
      fileBuffer,
      {
        headers: {
          'Content-Type': mime,
          'User-Agent': DEFAULT_CONFIG.userAgent,
          ...options.headers,
        },
        timeout: options.timeout,
      }
    );
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    return `${UPLOAD_SERVICES.filebin}/${binId}/${filename}`;
  },
  async transfersh(fileBuffer, filename, mime, options) {
    const response = await hkNet.put(`${UPLOAD_SERVICES.transfersh}/${filename}`, fileBuffer, {
      headers: {
        'Content-Type': mime,
        'User-Agent': DEFAULT_CONFIG.userAgent,
        ...options.headers,
      },
      timeout: options.timeout,
    });
    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    const result = response.data;
    return typeof result === 'string' ? result.trim() : result;
  },
  async uguu(fileBuffer, filename, mime, options) {
    const formData = new FormData();
    formData.append('files[]', fileBuffer, filename);
    const response = await hkNet.post(UPLOAD_SERVICES.uguu, formData, {
      headers: {
        ...formData.getHeaders(),
        'User-Agent': DEFAULT_CONFIG.userAgent,
        ...options.headers,
      },
      timeout: options.timeout,
    });
    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    const result = response.data;
    if (!result.success) {
      throw new Error('Upload failed: ' + result.errorcode);
    }
    return result.files[0].url;
  },
  async anonfiles(fileBuffer, filename, mime, options) {
    const formData = new FormData();
    formData.append('file', fileBuffer, filename);
    const response = await hkNet.post(UPLOAD_SERVICES.anonfiles, formData, {
      headers: {
        ...formData.getHeaders(),
        'User-Agent': DEFAULT_CONFIG.userAgent,
        ...options.headers,
      },
      timeout: options.timeout,
    });
    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    const result = response.data;
    if (!result.status) {
      throw new Error('Upload failed: ' + result.error.message);
    }
    return result.data.file.url.full;
  },
  async tempsh(fileBuffer, filename, mime, options) {
    const formData = new FormData();
    formData.append('file', fileBuffer, filename);
    const response = await hkNet.post(UPLOAD_SERVICES.tempsh, formData, {
      headers: {
        ...formData.getHeaders(),
        'User-Agent': DEFAULT_CONFIG.userAgent,
        ...options.headers,
      },
      timeout: options.timeout,
    });
    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    const result = response.data;
    return typeof result === 'string' ? result.trim() : result;
  },
  async pixeldrain(fileBuffer, filename, mime, options) {
    const response = await hkNet.post(UPLOAD_SERVICES.pixeldrain, fileBuffer, {
      headers: {
        'Content-Type': mime,
        'User-Agent': DEFAULT_CONFIG.userAgent,
        ...options.headers,
      },
      timeout: options.timeout,
    });
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    const result = response.data;
    if (!result.success) {
      throw new Error('Upload failed: ' + result.message);
    }
    return `https://pixeldrain.com/u/${result.id}`;
  },
};
const executeUpload = async (service, fileBuffer, filename, mime, options) => {
  const uploader = uploaders[service];
  if (!uploader) {
    throw new Error(`Unsupported service: ${service}`);
  }
  return await uploader(fileBuffer, filename, mime, options);
};
const uploader = async (fileBuffer, service = 'catbox', options = {}) => {
  const config = {
    ...DEFAULT_CONFIG,
    ...options,
  };
  validateInput(fileBuffer, config);
  const { ext, mime } = await detectFileType(fileBuffer, config.filename);
  if (config.allowedMimeTypes && !config.allowedMimeTypes.includes(mime)) {
    throw new Error(`Invalid file type: ${mime}. Allowed: ${config.allowedMimeTypes.join(', ')}`);
  }
  const filename = generateFilename(config.filename, ext);
  let lastError;
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await executeUpload(service, fileBuffer, filename, mime, config);
    } catch (error) {
      lastError = error;
      if (attempt < config.maxRetries) {
        await createRetryDelay(attempt + 1, config.retryDelay);
      }
    }
  }
  const serviceName = service.charAt(0).toUpperCase() + service.slice(1);
  throw new Error(
    `${serviceName} upload failed after ${config.maxRetries + 1} attempts: ${lastError.message}`
  );
};
const uploadToMultiple = async (
  fileBuffer,
  services = ['catbox', 'telegraph', '0x0'],
  options = {}
) => {
  const results = await Promise.allSettled(
    services.map((service) => uploader(fileBuffer, service, options))
  );
  const successful = results.map((result, index) => ({
    service: services[index],
    status: result.status,
    url: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason.message : null,
  }));
  const successfulUploads = successful.filter((r) => r.status === 'fulfilled');
  if (successfulUploads.length === 0) {
    throw new Error(
      'All uploads failed: ' + successful.map((r) => `${r.service}: ${r.error}`).join(', ')
    );
  }
  return successful;
};
const testAllUploaders = async (fileBuffer, options = {}) => {
  console.log('🚀 Testing all upload services...\n');
  const allServices = Object.keys(UPLOAD_SERVICES);
  const results = [];
  const startTime = Date.now();
  for (const service of allServices) {
    const serviceStartTime = Date.now();
    console.log(`📤 Testing ${service}...`);
    try {
      const url = await uploader(fileBuffer, service, options);
      const duration = Date.now() - serviceStartTime;
      const result = {
        service,
        status: 'success',
        url,
        duration: `${duration}ms`,
        error: null,
      };
      results.push(result);
      console.log(`✅ ${service}: ${url} (${duration}ms)\n`);
    } catch (error) {
      const duration = Date.now() - serviceStartTime;
      const result = {
        service,
        status: 'failed',
        url: null,
        duration: `${duration}ms`,
        error: error.message,
      };
      results.push(result);
      console.log(`❌ ${service}: ${error.message} (${duration}ms)\n`);
    }
  }
  const totalDuration = Date.now() - startTime;
  const successCount = results.filter((r) => r.status === 'success').length;
  const failCount = results.filter((r) => r.status === 'failed').length;
  console.log('═'.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`   Total Services: ${allServices.length}`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   ⏱️  Total Duration: ${totalDuration}ms`);
  console.log('═'.repeat(60));
  return {
    summary: {
      total: allServices.length,
      successful: successCount,
      failed: failCount,
      duration: `${totalDuration}ms`,
    },
    results,
  };
};
const getServiceInfo = () => ({
  services: Object.keys(UPLOAD_SERVICES),
  requirements: {},
  limits: {
    maelyn: 'Unknown limits',
    catbox: '200MB max',
    telegraph: '5MB max for images',
    fileio: '100MB max, 14 day retention',
    tmpfiles: '100MB max, 1 hour retention',
    '0x0': '512MB max, various retention',
    filebin: 'No size limit, 5 days retention',
    transfersh: '10GB max, 14 days retention',
    uguu: '32MB max, 48 hours retention',
    anonfiles: '20GB max, permanent',
    tempsh: '100MB max, 1 day retention',
    pixeldrain: '10GB max, permanent',
  },
});
export { uploader, uploadToMultiple, testAllUploaders, getServiceInfo, UPLOAD_SERVICES };
