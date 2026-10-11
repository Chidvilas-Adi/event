'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export interface ModalDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  type?: 'confirm' | 'alert' | 'prompt' | 'info';
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'gold' | 'emerald' | 'blue';
  promptPlaceholder?: string;
  promptValue?: string;
  onPromptChange?: (val: string) => void;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function ModalDialog({
  isOpen,
  title,
  message,
  type = 'confirm',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'gold',
  promptPlaceholder = 'Enter reason or value...',
  promptValue = '',
  onPromptChange,
  onConfirm,
  onCancel,
}: ModalDialogProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertTriangle className="w-5 h-5 text-vc-rose" />;
      case 'emerald':
        return <CheckCircle2 className="w-5 h-5 text-vc-emerald" />;
      case 'blue':
        return <Info className="w-5 h-5 text-vc-blue" />;
      default:
        return <AlertCircle className="w-5 h-5 text-vc-gold" />;
    }
  };

  const getButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'bg-vc-rose hover:bg-rose-600 text-white';
      case 'emerald':
        return 'bg-vc-emerald hover:bg-emerald-400 text-black';
      case 'blue':
        return 'bg-vc-blue hover:bg-blue-400 text-black';
      default:
        return 'bg-vc-gold hover:bg-yellow-400 text-black';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#0a0f1d] border border-vc-border rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl font-mono text-xs">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2.5">
            {getIcon()}
            <h3 className="font-syne font-bold text-white text-base tracking-wide">{title}</h3>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800/60"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        {message && <p className="text-gray-300 leading-relaxed">{message}</p>}

        {/* Prompt Input */}
        {type === 'prompt' && onPromptChange && (
          <div className="pt-1">
            <textarea
              rows={2}
              value={promptValue}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder={promptPlaceholder}
              className="w-full bg-[#030712] border border-gray-700 focus:border-vc-gold rounded p-2.5 text-white outline-none resize-none font-mono text-xs"
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-800">
          {type !== 'alert' && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded font-medium transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 font-syne font-bold rounded shadow transition-all ${getButtonClass()}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
