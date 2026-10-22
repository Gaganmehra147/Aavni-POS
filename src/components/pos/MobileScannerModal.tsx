import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { playBeep } from '../../lib/sound';
import {
  X,
  Smartphone,
  Camera,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Wifi,
  Radio,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface MobileScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => void;
  sessionId?: string;
}

export const MobileScannerModal: React.FC<MobileScannerModalProps> = ({
  isOpen,
  onClose,
  onBarcodeScanned,
  sessionId = 'register-1'
}) => {
  const [activeTab, setActiveTab] = useState<'phone' | 'webcam'>('phone');
  const [hostInfo, setHostInfo] = useState<{ localIp: string; port: number; scannerUrl: string }>({
    localIp: 'localhost',
    port: 3000,
    scannerUrl: `http://localhost:3000/?view=mobile-scanner&session=${sessionId}`
  });
  const [copied, setCopied] = useState(false);
  const [recentScans, setRecentScans] = useState<Array<{ barcode: string; time: string; variant?: any }>>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  // Webcam scanning refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const lastWebcamCodeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // 1. Fetch LAN host information
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/pos/mobile-scanner/host-info')
      .then((res) => res.json())
      .then((data) => {
        const fullUrl = `http://${data.localIp}:${data.port}/?view=mobile-scanner&session=${sessionId}`;
        setHostInfo({
          localIp: data.localIp,
          port: data.port,
          scannerUrl: fullUrl
        });
      })
      .catch((err) => console.warn('Could not fetch host info:', err));
  }, [isOpen, sessionId]);

  // 2. SSE Listener for Mobile Phone Scans
  useEffect(() => {
    if (!isOpen) return;

    let eventSource: EventSource | null = null;
    let pollInterval: any = null;

    try {
      eventSource = new EventSource(`/api/pos/mobile-scanner/stream/${sessionId}`);

      eventSource.onopen = () => {
        setConnectionStatus('connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.barcode) {
            handleReceivedBarcode(data.barcode, data.variant);
          }
        } catch (e) {
          // ignore heartbeat
        }
      };

      eventSource.onerror = () => {
        setConnectionStatus('connecting');
      };
    } catch (e) {
      // Fallback to polling every 1.5s
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/pos/mobile-scanner/poll/${sessionId}?since=${Date.now() - 3000}`);
          const data = await res.json();
          if (data.events && data.events.length > 0) {
            data.events.forEach((ev: any) => handleReceivedBarcode(ev.barcode, ev.variant));
          }
        } catch (err) {}
      }, 1500);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isOpen, sessionId]);

  const handleReceivedBarcode = (barcode: string, variant?: any) => {
    playBeep('success');
    onBarcodeScanned(barcode);

    setRecentScans((prev) => [
      {
        barcode,
        variant,
        time: new Date().toLocaleTimeString()
      },
      ...prev.slice(0, 9)
    ]);
  };

  // 3. Device Camera (Webcam Tab)
  useEffect(() => {
    if (!isOpen || activeTab !== 'webcam') {
      if (readerRef.current) {
        try {
          readerRef.current.stopContinuousDecode();
        } catch (e) {}
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
      return;
    }

    let active = true;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    const startWebcam = async () => {
      try {
        setWebcamError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          reader.decodeFromVideoElement(videoRef.current, (result) => {
            if (!active) return;
            if (result) {
              const text = result.getText().trim();
              if (text) {
                const now = Date.now();
                if (lastWebcamCodeRef.current.code === text && now - lastWebcamCodeRef.current.time < 1800) {
                  return;
                }
                lastWebcamCodeRef.current = { code: text, time: now };
                handleReceivedBarcode(text);
              }
            }
          });
        }
      } catch (err: any) {
        setWebcamError(err.message || 'Unable to access camera on this PC/Laptop.');
      }
    };

    startWebcam();

    return () => {
      active = false;
      try {
        reader.stopContinuousDecode();
      } catch (e) {}
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    hostInfo.scannerUrl
  )}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(hostInfo.scannerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-[#E9DFE2] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#681C32] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base tracking-wide flex items-center space-x-2">
                <span>Mobile Barcode Scanner</span>
                <span className="text-[10px] bg-emerald-500 text-white font-sans font-bold px-2 py-0.5 rounded-full">
                  LIVE SYNC
                </span>
              </h2>
              <p className="text-xs text-white/80">
                Scan garment tags from smartphone or computer webcam
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#E9DFE2] bg-[#FDFBFA] p-1.5 shrink-0 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('phone')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'phone'
                ? 'bg-[#681C32] text-white shadow-sm'
                : 'text-[#776C70] hover:text-[#30262A] hover:bg-white'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Connect Smartphone (WiFi Scanner)</span>
          </button>
          <button
            onClick={() => setActiveTab('webcam')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'webcam'
                ? 'bg-[#681C32] text-white shadow-sm'
                : 'text-[#776C70] hover:text-[#30262A] hover:bg-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>This Device Camera (Webcam)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'phone' ? (
            <div className="space-y-4">
              {/* Instructions Banner */}
              <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E9DFE2] flex flex-col sm:flex-row items-center gap-5">
                {/* QR Code */}
                <div className="p-2 bg-white rounded-xl shadow-sm border border-[#E9DFE2] shrink-0 text-center">
                  <img
                    src={qrImageUrl}
                    alt="Scan with mobile"
                    className="w-36 h-36 rounded-lg object-contain mx-auto"
                    onError={(e) => {
                      // Fallback if external image blocked
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="text-[10px] text-stone-500 font-mono mt-1 font-semibold">
                    Scan with Phone Camera
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-2 text-xs text-[#30262A] flex-1">
                  <div className="font-bold text-sm text-[#681C32] flex items-center space-x-1.5">
                    <Wifi className="w-4 h-4 text-emerald-600" />
                    <span>How to use your phone as a barcode gun:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-stone-600 leading-relaxed">
                    <li>Connect phone to the same store WiFi.</li>
                    <li>Open phone camera & scan this QR code.</li>
                    <li>Point phone at any garment tag barcode.</li>
                    <li>Product is instantly added to your POS cart!</li>
                  </ol>

                  {/* Direct Link & Copy */}
                  <div className="pt-2">
                    <div className="text-[10px] text-stone-500 font-bold uppercase mb-1">
                      Direct Mobile Link:
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        readOnly
                        value={hostInfo.scannerUrl}
                        className="flex-1 bg-white border border-[#E9DFE2] px-2.5 py-1.5 rounded-lg text-xs font-mono text-stone-700 select-all"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg flex items-center space-x-1 shrink-0 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status & Live Scans Feed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700 flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>Live Cart Ingestion Feed</span>
                  </span>
                  <span className="text-[11px] text-stone-500 font-mono">
                    Session: {sessionId}
                  </span>
                </div>

                {recentScans.length === 0 ? (
                  <div className="p-6 text-center text-xs text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-200">
                    Point your phone camera at clothing labels. Scanned items will appear here and in your cart automatically!
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100 border border-emerald-100 bg-emerald-50/50 rounded-xl max-h-40 overflow-y-auto">
                    {recentScans.map((s, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-bold text-stone-800">
                              {s.variant?.product_name || 'Scanned Barcode'}
                            </span>
                            <span className="ml-2 font-mono text-stone-500 text-[11px]">
                              [{s.barcode}]
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-[#681C32] mr-2">
                            {s.variant?.selling_price ? `₹${s.variant.selling_price}` : ''}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">{s.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Webcam Direct Tab */
            <div className="space-y-3">
              <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
                {webcamError ? (
                  <div className="p-6 text-center space-y-2 text-white">
                    <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                    <div className="text-xs font-bold text-red-400">{webcamError}</div>
                    <p className="text-[11px] text-stone-400">
                      Check your browser camera permissions or switch to the Smartphone tab!
                    </p>
                  </div>
                ) : (
                  <>
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                      <div className="w-64 h-32 border-2 border-emerald-400 rounded-xl relative shadow-lg overflow-hidden">
                        <div className="absolute inset-x-0 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse"></div>
                      </div>
                      <p className="text-[11px] text-white/80 mt-2 bg-black/60 px-3 py-0.5 rounded-full">
                        Hold barcode steady in front of camera
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Scanned Items Feed */}
              {recentScans.length > 0 && (
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Last Scanned: <strong>{recentScans[0].barcode}</strong> (Added to Cart!)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700">{recentScans[0].time}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-[#E9DFE2] flex items-center justify-between shrink-0">
          <div className="text-xs text-stone-500 flex items-center space-x-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>Ready for continuous billing scans</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#681C32] text-white text-xs font-bold rounded-xl hover:bg-[#451222] transition-colors shadow-sm"
          >
            Done Scanning
          </button>
        </div>
      </div>
    </div>
  );
};
