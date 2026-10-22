import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { playBeep } from '../../lib/sound';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  Zap,
  ZapOff,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  Smartphone
} from 'lucide-react';

export const MobileScannerView: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session') || 'default-register';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const [scanning, setScanning] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [lastScanned, setLastScanned] = useState<{
    code: string;
    variant?: any;
    time: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scanCount, setScanCount] = useState(0);

  // Cooldown to avoid duplicate multi-firing on the exact same barcode
  const lastCodeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  useEffect(() => {
    let active = true;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setErrorMsg('Camera access is not supported by your browser.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          // Check torch capability
          const track = stream.getVideoTracks()[0];
          const capabilities = (track.getCapabilities?.() as any) || {};
          if (capabilities.torch) {
            setHasTorch(true);
          }
        }

        // Start continuous decoding
        if (videoRef.current) {
          reader.decodeFromVideoElement(videoRef.current, (result, err) => {
            if (!active) return;
            if (result) {
              const text = result.getText().trim();
              if (text) {
                const now = Date.now();
                // 1.5s debounce for the exact same barcode
                if (lastCodeRef.current.code === text && now - lastCodeRef.current.time < 1500) {
                  return;
                }
                lastCodeRef.current = { code: text, time: now };
                handleBarcodeDetected(text);
              }
            }
          });
        }
      } catch (err: any) {
        console.error('Camera init error:', err);
        setErrorMsg(err.message || 'Unable to access phone camera. Please grant camera permission.');
      }
    };

    startCamera();

    return () => {
      active = false;
      try {
        reader.stopContinuousDecode();
      } catch (e) {
        // ignore
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleBarcodeDetected = async (code: string) => {
    // Vibrate & Sound
    if (navigator.vibrate) {
      try {
        navigator.vibrate(80);
      } catch (e) {}
    }
    playBeep('success');

    try {
      const res = await fetch('/api/pos/mobile-scanner/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, barcode: code })
      });
      const data = await res.json();

      setLastScanned({
        code,
        variant: data.variant,
        time: new Date().toLocaleTimeString()
      });
      setScanCount((prev) => prev + 1);
    } catch (e: any) {
      console.error('Failed to transmit barcode to POS:', e);
    }
  };

  const handleToggleTorch = async () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      try {
        await (track as any).applyConstraints({
          advanced: [{ torch: !torchOn }]
        });
        setTorchOn(!torchOn);
      } catch (e) {
        console.warn('Torch toggle failed:', e);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleBarcodeDetected(manualCode.trim());
      setManualCode('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col font-sans select-none overflow-hidden z-50">
      {/* Top Header */}
      <div className="bg-[#681C32] px-4 py-3 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="font-serif font-bold text-sm tracking-wide text-white">
              AAVNI MOBILE SCANNER
            </div>
            <div className="text-[10px] text-amber-200/90 flex items-center space-x-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Register: {sessionId}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {hasTorch && (
            <button
              onClick={handleToggleTorch}
              className={`p-2 rounded-full border transition-all ${
                torchOn
                  ? 'bg-amber-400 text-stone-900 border-amber-300 shadow-lg'
                  : 'bg-white/10 text-white border-white/20'
              }`}
            >
              {torchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          <div className="px-2.5 py-1 bg-white/10 rounded-full text-xs font-mono font-bold text-amber-300">
            {scanCount} Scanned
          </div>
        </div>
      </div>

      {/* Camera Viewfinder Area */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {errorMsg ? (
          <div className="p-6 text-center max-w-sm space-y-3 bg-stone-900 rounded-2xl border border-stone-800 m-4">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
            <div className="font-bold text-sm text-red-400">{errorMsg}</div>
            <p className="text-xs text-stone-400">
              Please ensure your mobile browser has permission to access the camera.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#681C32] text-white text-xs font-bold rounded-lg shadow-md"
            >
              Retry Camera
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Viewfinder Target Overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div className="w-72 h-44 border-2 border-emerald-400/80 rounded-2xl relative shadow-2xl flex items-center justify-center overflow-hidden">
                {/* Laser animation */}
                <div className="absolute inset-x-0 h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse"></div>
                <div className="absolute top-1 left-2 text-[10px] font-mono text-emerald-400 bg-black/60 px-1 rounded">
                  Point at tag barcode
                </div>
              </div>
              <p className="text-xs text-white/70 mt-3 drop-shadow bg-black/40 px-3 py-1 rounded-full">
                Hold 4-8 inches away from clothing label
              </p>
            </div>
          </>
        )}
      </div>

      {/* Real-time Scanned Item Feedback Banner */}
      {lastScanned && (
        <div className="bg-emerald-950 border-t border-emerald-800 px-4 py-2.5 shrink-0 flex items-center justify-between text-xs animate-in slide-in-from-bottom">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="font-bold text-emerald-200 truncate">
                {lastScanned.variant?.product_name || 'Item Ringing Up...'}
              </div>
              <div className="text-[11px] text-emerald-400 font-mono">
                Code: {lastScanned.code}{' '}
                {lastScanned.variant?.selling_price && `• ₹${lastScanned.variant.selling_price}`}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded shrink-0">
            Added to POS!
          </span>
        </div>
      )}

      {/* Manual Input Fallback */}
      <div className="bg-stone-900 p-3 border-t border-stone-800 shrink-0">
        <form onSubmit={handleManualSubmit} className="flex space-x-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Type barcode or SKU if damaged..."
            className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs text-white placeholder-stone-500 font-mono focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[#681C32] text-white font-bold text-xs rounded-lg hover:bg-[#85233f] transition-all"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
