import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Download,
  ExternalLink,
  AlertCircle,
  Copy,
  Check,
  Upload,
  RefreshCw
} from 'lucide-react';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { resizeImageFile } from '../../utils/imageResize';
import { api, getApiErrorDetails } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  title?: string;
  subtitle?: string;
  altText?: string;
  orderId?: string;
  orderNumber?: string;
  utrNumber?: string;
  onScreenshotUpdated?: (newUrl: string) => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Payment Proof / Screenshot',
  subtitle,
  altText = 'Payment Screenshot',
  orderId,
  orderNumber,
  utrNumber,
  onScreenshotUpdated
}) => {
  const { showToast } = useToast();
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null | undefined>(imageUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize image URL
  const resolvedUrl = normalizeImageUrl(currentUrl);

  // A submitted payment proof is the customer's evidence and must never be overwritten
  // from the admin app. Attaching a screenshot is therefore allowed ONLY when the order
  // carries no proof at all (e.g. the customer sent it over WhatsApp) - never as a replace.
  const hasExistingProof = !!normalizeImageUrl(imageUrl);
  const canUpload = !hasExistingProof && !!orderId;

  // Reset transform and url whenever modal opens or image changes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setHasError(false);
      setCopied(false);
      setCurrentUrl(imageUrl);
      setUploadSuccess(false);
    }
  }, [isOpen, imageUrl]);

  // Handle ESC key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleCopyLink = () => {
    if (resolvedUrl) {
      navigator.clipboard.writeText(resolvedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!resolvedUrl) return;
    const link = document.createElement('a');
    link.href = resolvedUrl;
    link.download = `payment-proof-${Date.now()}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Hard guard: never overwrite an existing proof, even if a stale input event fires.
    if (!canUpload) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setIsUploading(true);
    try {
      // Shared downscale + EXIF-rotate path (utils/imageResize), pinned to JPEG because this
      // order endpoint takes a base64 payload rather than an uploaded R2 url. It never throws:
      // an undecodable file comes back untouched and is still submitted.
      const resized = await resizeImageFile(file, { maxEdge: 1600, outputType: 'image/jpeg' });
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error || new Error('Screenshot could not be read'));
        reader.readAsDataURL(resized.file);
      });

      if (orderId) {
        await api.submitPaymentProof(orderId, {
          utrNumber: utrNumber || 'MANUAL-PROOF',
          paymentScreenshotBase64: base64,
          orderNumber: orderNumber
        });
      }

      setCurrentUrl(base64);
      setHasError(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      onScreenshotUpdated?.(base64);
    } catch (err) {
      const { message } = getApiErrorDetails(err);
      showToast(message || 'Failed to upload payment proof', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      {/* Hidden file input - only mounted when the order has no proof yet (attach, never replace) */}
      {canUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg"
          className="hidden"
          onChange={handleFileSelect}
        />
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Window */}
      <div className="relative z-10 w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 text-white">
          <div className="min-w-0 pr-4">
            <h3 className="font-bold text-sm text-slate-100 truncate flex items-center gap-2">
              <span>{title}</span>
              {uploadSuccess && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 animate-pulse">
                  Saved & Persistent!
                </span>
              )}
            </h3>
            {subtitle && <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{subtitle}</p>}
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {resolvedUrl && !hasError && (
              <>
                <button
                  onClick={handleZoomIn}
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleReset}
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                  title="Reset (100%)"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                  title="Download Image"
                >
                  <Download className="w-4 h-4" />
                </button>
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                  title="Open Full Image in New Tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition ml-2"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Canvas */}
        <div className="flex-1 min-h-[350px] sm:min-h-[480px] max-h-[75vh] overflow-auto flex items-center justify-center p-4 bg-slate-950/90 relative select-none">
          {!resolvedUrl ? (
            <div className="text-center p-8 space-y-3 text-slate-400 max-w-sm">
              <AlertCircle className="w-10 h-10 mx-auto text-amber-400" />
              <div className="font-bold text-slate-200">No screenshot attached</div>
              <p className="text-xs text-slate-500">The customer has not submitted an image proof for this transaction.</p>
              {canUpload && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold inline-flex items-center space-x-1.5 shadow-md transition disabled:opacity-50 cursor-pointer mt-2"
                >
                  {isUploading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{isUploading ? 'Uploading & Saving...' : 'Upload Payment Proof'}</span>
                </button>
              )}
            </div>
          ) : hasError ? (
            <div className="text-center p-8 max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-3">
              <AlertCircle className="w-10 h-10 mx-auto text-amber-400" />
              <div>
                <h4 className="font-bold text-slate-200 text-sm">Image File Not Found on Server (404)</h4>
                <p className="text-xs text-slate-400 mt-1">
                  The original screenshot was stored on ephemeral cloud storage that was cleared during a server restart. The submitted proof cannot be replaced from here - verify the payment against the UTR and your bank statement instead.
                </p>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-xl font-mono text-[11px] text-slate-400 break-all text-left border border-slate-800 flex items-center justify-between gap-2">
                <span className="truncate">{resolvedUrl}</span>
                <button
                  onClick={handleCopyLink}
                  className="p-1 rounded text-slate-400 hover:text-white flex-shrink-0"
                  title="Copy URL"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <button
                  onClick={() => setHasError(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="relative flex items-center justify-center w-full h-full">
              <img
                src={resolvedUrl}
                alt={altText}
                onError={() => setHasError(true)}
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out'
                }}
                className="max-h-[70vh] max-w-full object-contain rounded shadow-lg"
              />
            </div>
          )}
        </div>

        {/* Footer info & zoom level */}
        <div className="px-5 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div>
            {resolvedUrl && !hasError && (
              <span>
                Zoom: <span className="font-mono text-slate-200">{Math.round(scale * 100)}%</span>
                {rotation > 0 && <span> • {rotation}°</span>}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline">Use controls above to zoom, rotate or download</span>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
