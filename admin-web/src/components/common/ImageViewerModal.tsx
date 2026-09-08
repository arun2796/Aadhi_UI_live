import React, { useState, useEffect, useCallback } from 'react';
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
  Check
} from 'lucide-react';
import { normalizeImageUrl } from '../../utils/imageUrl';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  title?: string;
  subtitle?: string;
  altText?: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Payment Proof / Screenshot',
  subtitle,
  altText = 'Payment Screenshot'
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);

  // Normalize image URL
  const resolvedUrl = normalizeImageUrl(imageUrl);

  // Reset transform whenever modal opens or image changes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setHasError(false);
      setCopied(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in">
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
            <h3 className="font-bold text-sm text-slate-100 truncate">{title}</h3>
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
            <div className="text-center p-8 space-y-2 text-slate-400">
              <AlertCircle className="w-10 h-10 mx-auto text-amber-400" />
              <div className="font-bold text-slate-200">No screenshot attached</div>
              <p className="text-xs text-slate-500">The customer has not submitted an image proof for this transaction.</p>
            </div>
          ) : hasError ? (
            <div className="text-center p-8 max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-3">
              <AlertCircle className="w-10 h-10 mx-auto text-amber-400" />
              <div>
                <h4 className="font-bold text-slate-200 text-sm">Image file could not be displayed directly</h4>
                <p className="text-xs text-slate-400 mt-1">
                  The proof URL could not be rendered inline. You can copy the link or open it directly in a new window.
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

              <div className="flex justify-center gap-2 pt-2">
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold inline-flex items-center space-x-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open URL Directly</span>
                </a>
                <button
                  onClick={() => setHasError(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
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
