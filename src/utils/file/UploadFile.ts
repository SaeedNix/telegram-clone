import { S3 } from "aws-sdk";
import compressImage from "./CompressImage";

const checkNetworkConnectivity = async (): Promise<boolean> => {
  if (!navigator.onLine) {
    return false; // No internet connection detected by browser
  }

  // First try to check our own server (if it's running)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    await fetch(window.location.origin, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    console.error("Local server test Network check failed:", error);
    // Local server test failed, continue to external endpoints
  }

  // Array of reliable endpoints to test connectivity
  const testUrls = [
    "https://www.google.com/favicon.ico",
    "https://cloudflare.com/favicon.ico",
    "https://1.1.1.1/favicon.ico", // Cloudflare DNS (IP-based, less likely to be blocked)
  ];

  for (const testUrl of testUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 10000); // 10 seconds timeout per attempt

      await fetch(testUrl, {
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return true;
    } catch (error) {
      continue; // Try next URL
    }
  }

  return false;
};

const uploadFile = async (
  file: File,
  onProgress?: (progress: number) => void
) => {
  let uploadFile: File = file;

  if (file.type.match("image.*")) {
    uploadFile = await compressImage(file);
  }

  try {
    const s3 = new S3({
      accessKeyId: process.env.NEXT_PUBLIC_S3_ACCESS_KEY,
      secretAccessKey: process.env.NEXT_PUBLIC_S3_SECRET_KEY,
      endpoint: process.env.NEXT_PUBLIC_S3_ENDPOINT,
      s3ForcePathStyle: true,
    });
    const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error("S3 bucket name is not defined");
    }

    const uniqueFileName = `${Date.now()}-${uploadFile.name}`;
    const url = file.type.match("image.*") ? "images/" : "voices/";
    const key = url + encodeURIComponent(uniqueFileName);

    const params = {
      Bucket: bucketName,
      Key: key,
      Body: uploadFile,
      ContentType: uploadFile.type,
    };

    if (onProgress) {
      const upload = s3.upload(params);
      upload.on("httpUploadProgress", (progress) => {
        if (progress.total) {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          onProgress(percent);
        }
      });
      await upload.promise();
    } else {
      await s3.upload(params).promise();
    }

    const permanentSignedUrl = s3.getSignedUrl("getObject", {
      Bucket: bucketName,
      Key: key,
      Expires: 31536000000, // 1 year
    });

    return permanentSignedUrl;
  } catch (error) {
    throw error; // Re-throw the error to be caught by retry logic
  }
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds

const uploadFileWithRetry = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; error?: string; downloadUrl?: string }> => {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const isConnected = await checkNetworkConnectivity();
    if (!isConnected) {
      if (i < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      } else {
        return {
          success: false,
          error:
            "Network connection unavailable. Please check your internet connection.",
        };
      }
    }

    try {
      const result = await uploadFile(file, onProgress);
      return { success: true, downloadUrl: result };
    } catch (error: unknown) {
      if (i < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed permanently.";
        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  }
  return { success: false, error: "Unknown error during upload." };
};

export default uploadFileWithRetry;
