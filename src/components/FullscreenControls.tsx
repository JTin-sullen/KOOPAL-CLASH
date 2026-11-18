import React, { useState } from 'react';
import { Download, Maximize2, Minimize2, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface FullscreenControlsProps {
  compact?: boolean;
  lockLandscape?: boolean;
}

export const FullscreenControls: React.FC<FullscreenControlsProps> = ({
  compact = false,
  lockLandscape = false,
}) => {
  const { isInstallable, isInstalled, isIOS, isFullscreen, install, enterFullscreen, exitFullscreen } =
    usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const canUseFullscreenApi =
    typeof document !== 'undefined' && Boolean(document.documentElement?.requestFullscreen);

  const toggleFs = () => {
    if (isFullscreen) {
      void exitFullscreen();
    } else if (canUseFullscreenApi) {
      void enterFullscreen(lockLandscape);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        {!isInstalled && isInstallable && (
          <button
            type="button"
            onClick={() => void install()}
            title="Install Fullscreen App (No URL Bar)"
            className={`rounded-lg bg-amber-400/95 hover:bg-amber-300 text-slate-950 font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              compact ? 'min-h-[36px] px-2.5 text-[11px]' : 'min-h-[38px] px-3 text-xs'
            }`}
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>{compact ? 'App' : 'Install App'}</span>
          </button>
        )}

        {!isInstalled && isIOS && (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            title="Hide Safari URL Bar"
            className={`rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              compact ? 'min-h-[36px] px-2.5 text-[11px]' : 'min-h-[38px] px-3 text-xs'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span>{compact ? 'Full' : 'Fullscreen App'}</span>
          </button>
        )}

        {!isInstalled && canUseFullscreenApi && (
          <button
            type="button"
            onClick={toggleFs}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (Hide URL Bar)'}
            className={`rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-100 font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              compact ? 'min-h-[36px] min-w-[36px] px-2 text-[11px]' : 'min-h-[38px] px-3 text-xs'
            }`}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
            )}
            {!compact && <span>{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>}
          </button>
        )}
      </div>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-amber-400/50 p-5 shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-white">
              Play Fullscreen Without Safari URL Bar
            </h3>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              iPhone &amp; iPad hide the browser bar completely when opened from your Home Screen:
            </p>
            <ol className="mt-3 space-y-1.5 text-xs text-slate-200 list-decimal list-inside">
              <li>
                Tap the <strong className="text-amber-300">Share</strong> icon in Safari&apos;s toolbar.
              </li>
              <li>
                Scroll down and tap <strong className="text-amber-300">Add to Home Screen</strong>.
              </li>
              <li>
                Launch <strong className="text-white">KOOPAL CLASH</strong> from your Home Screen icon.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full min-h-[42px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
