/**
 * QR Decoder Utility for React Native
 *
 * Uses a hidden WebView with INLINE jsQR (no CDN dependency) to decode QR codes from images.
 * For barcode (non-QR) images, returns null → user enters code manually.
 *
 * Fixes applied:
 * 1. jsQR inlined (no CDN dependency - works offline/emulator)
 * 2. Uses injectJavaScript instead of postMessage (reliable on Android)
 * 3. WebView has proper dimensions for canvas rendering
 * 4. Comprehensive error logging
 *
 * Usage:
 *   const { decodeQR, QRDecoderView } = useQRDecoder();
 *   // Render <QRDecoderView /> somewhere (hidden but with dimensions)
 *   // const result = await decodeQR(imageUri);
 */
import React, { useRef, useCallback, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import { JSQR_SOURCE } from "./jsqrBundle";

// Build the WebView HTML with jsQR inlined
const WEBVIEW_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <canvas id="canvas" width="1024" height="1024"></canvas>
  <script>
    // ── Inline jsQR library ──
    ${JSQR_SOURCE}
  </script>
  <script>
    // ── QR Decoder Logic ──
    var _log = function(msg) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
      } catch(e) {}
    };

    // Check if jsQR loaded correctly
    if (typeof jsQR === 'function') {
      _log('jsQR loaded OK');
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    } else {
      _log('ERROR: jsQR not found as function. Type: ' + typeof jsQR);
      // Try to find it in different locations
      if (typeof window.jsQR === 'function') {
        _log('Found jsQR on window');
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
      } else {
        _log('jsQR not available anywhere');
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'result', 
          success: false, 
          error: 'jsQR library failed to load' 
        }));
      }
    }

    // Global decode function called via injectJavaScript
    window.decodeQRFromBase64 = function(base64Data, mimeType) {
      _log('decodeQRFromBase64 called, data length: ' + (base64Data ? base64Data.length : 0));
      
      try {
        var qrFunc = (typeof jsQR === 'function') ? jsQR : window.jsQR;
        if (typeof qrFunc !== 'function') {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'result',
            success: false,
            error: 'jsQR not available'
          }));
          return;
        }

        var img = new Image();
        img.onload = function() {
          _log('Image loaded: ' + img.width + 'x' + img.height);
          
          try {
            var canvas = document.getElementById('canvas');
            var ctx = canvas.getContext('2d');
            
            // Use original size or limit to 1024
            var maxSize = 1024;
            var w = img.width;
            var h = img.height;
            if (w > maxSize || h > maxSize) {
              var scale = maxSize / Math.max(w, h);
              w = Math.floor(w * scale);
              h = Math.floor(h * scale);
            }
            
            // Ensure minimum size
            if (w < 10 || h < 10) {
              w = Math.max(w, 100);
              h = Math.max(h, 100);
            }
            
            canvas.width = w;
            canvas.height = h;
            
            // Clear and draw
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            
            var imageData = ctx.getImageData(0, 0, w, h);
            _log('Canvas drawn: ' + w + 'x' + h + ', pixels: ' + imageData.data.length);
            
            // Try multiple strategies
            var code = null;
            
            // Strategy 1: Normal
            code = qrFunc(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
            
            if (!code) {
              _log('Strategy 1 failed, trying with dontInvert');
              code = qrFunc(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
            }
            
            if (!code && (w !== img.width || h !== img.height)) {
              // Strategy 2: Try at original resolution
              _log('Strategy 2: trying original resolution ' + img.width + 'x' + img.height);
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.clearRect(0, 0, img.width, img.height);
              ctx.drawImage(img, 0, 0);
              var origData = ctx.getImageData(0, 0, img.width, img.height);
              code = qrFunc(origData.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
            }
            
            if (code && code.data) {
              _log('QR DECODED: ' + code.data);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'result',
                success: true,
                data: code.data,
                format: 'qr'
              }));
            } else {
              _log('No QR code detected after all strategies');
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'result',
                success: false,
                error: 'No QR code detected'
              }));
            }
          } catch (canvasErr) {
            _log('Canvas error: ' + canvasErr.message);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'result',
              success: false,
              error: 'Canvas error: ' + canvasErr.message
            }));
          }
        };
        
        img.onerror = function(e) {
          _log('Image load error');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'result',
            success: false,
            error: 'Failed to load image in WebView'
          }));
        };
        
        img.src = 'data:' + mimeType + ';base64,' + base64Data;
        _log('Image src set, loading...');
        
      } catch (err) {
        _log('Decode error: ' + (err.message || err));
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'result',
          success: false,
          error: err.message || 'Unknown error'
        }));
      }
    };
    
    _log('Decoder script initialized');
  </script>
</body>
</html>
`;

interface DecodeResult {
  success: boolean;
  data?: string;
  format?: string;
  error?: string;
}

export function useQRDecoder() {
  const webViewRef = useRef<WebView>(null);
  const resolveRef = useRef<((result: DecodeResult) => void) | null>(null);
  const [isReady, setIsReady] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === "log") {
        console.log("[QRDecoder WebView]", msg.message);
        return;
      }

      if (msg.type === "ready") {
        console.log("[QRDecoder] WebView ready with jsQR");
        setIsReady(true);
      } else if (msg.type === "result") {
        console.log("[QRDecoder] Result:", JSON.stringify(msg));
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        if (resolveRef.current) {
          resolveRef.current(msg);
          resolveRef.current = null;
        }
      }
    } catch (e) {
      console.warn("[QRDecoder] Parse error:", e);
    }
  }, []);

  const decodeQR = useCallback(
    async (imageUri: string): Promise<DecodeResult> => {
      return new Promise(async (resolve) => {
        try {
          console.log("[QRDecoder] Starting decode for:", imageUri);
          console.log("[QRDecoder] WebView ready:", isReady);

          // Normalize URI: content:// → file:// by copying to cache
          let fileUri = imageUri;
          if (imageUri.startsWith('content://')) {
            console.log("[QRDecoder] Normalizing content:// URI to file://");
            const ext = imageUri.includes('.png') ? '.png' : imageUri.includes('.webp') ? '.webp' : '.jpg';
            const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
            const tempUri = cacheDir + 'qr_decode_' + Date.now() + ext;
            try {
              await FileSystem.copyAsync({ from: imageUri, to: tempUri });
              fileUri = tempUri;
              console.log("[QRDecoder] Copied to cache:", tempUri);
            } catch (copyErr) {
              console.warn("[QRDecoder] Copy failed, trying original URI:", copyErr);
            }
          }

          // Read image as base64
          const base64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: "base64" as any,
          });

          console.log("[QRDecoder] Base64 length:", base64.length);

          // Determine mime type
          const ext = imageUri.split(".").pop()?.toLowerCase() || "jpg";
          const mimeType =
            ext === "png"
              ? "image/png"
              : ext === "webp"
                ? "image/webp"
                : "image/jpeg";

          console.log("[QRDecoder] MIME type:", mimeType);

          // Set up response handler
          resolveRef.current = resolve;

          // Set timeout (10 seconds - increased for large images)
          timeoutRef.current = setTimeout(() => {
            console.warn("[QRDecoder] Timeout after 10s");
            resolveRef.current = null;
            resolve({ success: false, error: "Decode timeout (10s)" });
          }, 10000);

          // Use injectJavaScript instead of postMessage (more reliable on Android)
          // We need to escape the base64 string for JavaScript injection
          // Split into chunks to avoid string too long issues
          const chunkSize = 50000;
          if (base64.length > chunkSize) {
            // For large images, build the string in chunks
            console.log(
              "[QRDecoder] Large image, sending in chunks:",
              Math.ceil(base64.length / chunkSize),
            );
            let buildScript = `window._qrBase64 = '';`;
            for (let i = 0; i < base64.length; i += chunkSize) {
              const chunk = base64.substring(i, i + chunkSize);
              buildScript += `window._qrBase64 += '${chunk}';`;
            }
            buildScript += `window.decodeQRFromBase64(window._qrBase64, '${mimeType}'); true;`;
            webViewRef.current?.injectJavaScript(buildScript);
          } else {
            // Small enough to inject directly
            const script = `window.decodeQRFromBase64('${base64}', '${mimeType}'); true;`;
            webViewRef.current?.injectJavaScript(script);
          }

          console.log("[QRDecoder] JavaScript injected");
        } catch (err: any) {
          console.error("[QRDecoder] Error:", err);
          resolve({
            success: false,
            error: err.message || "Failed to read image",
          });
        }
      });
    },
    [isReady],
  );

  // Hidden WebView component that must be rendered
  // IMPORTANT: Must have real dimensions for canvas to work (at least 10x10)
  const QRDecoderView = useCallback(
    () => (
      <View style={styles.hidden}>
        <WebView
          ref={webViewRef}
          source={{ html: WEBVIEW_HTML }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          mixedContentMode="always"
          originWhitelist={["*"]}
          style={styles.webview}
          onError={(e) =>
            console.error("[QRDecoder] WebView error:", e.nativeEvent)
          }
          onHttpError={(e) =>
            console.error("[QRDecoder] HTTP error:", e.nativeEvent)
          }
        />
      </View>
    ),
    [handleMessage],
  );

  return { decodeQR, QRDecoderView, isReady };
}

const styles = StyleSheet.create({
  hidden: {
    position: "absolute",
    // Give real dimensions so canvas renders properly
    width: 10,
    height: 10,
    opacity: 0,
    overflow: "hidden",
    // Move off-screen
    left: -100,
    top: -100,
  },
  webview: {
    width: 10,
    height: 10,
  },
});