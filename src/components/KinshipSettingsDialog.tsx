'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLocale } from '@/components/LocaleProvider';
import { useKinshipSettings } from '@/components/KinshipSettingsProvider';
import type { TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** One choice of a setting: buttons in a row, the chosen one marked */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50',
              value === option.value ? 'border-primary bg-primary/10 font-medium' : 'bg-card hover:bg-accent'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** How kinship terms are worded: formal or casual, and for casual ones southern or northern */
export function KinshipSettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const { options, setOptions } = useKinshipSettings();
  const label = (key: TranslationKey) => t(key);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="confirm">
        <DialogHeader>
          <DialogTitle>{t('kinshipSettings')}</DialogTitle>
          <DialogDescription>{t('kinshipSettingsHint')}</DialogDescription>
        </DialogHeader>
        <Choice
          label={label('kinshipStyle')}
          value={options.style}
          options={[
            { value: 'formal', label: t('kinshipStyleFormal') },
            { value: 'casual', label: t('kinshipStyleCasual') },
          ]}
          onChange={(style) => setOptions({ ...options, style })}
        />
        <Choice
          label={label('kinshipRegion')}
          value={options.region}
          options={[
            { value: 'southern', label: t('kinshipRegionSouthern') },
            { value: 'northern', label: t('kinshipRegionNorthern') },
          ]}
          onChange={(region) => setOptions({ ...options, region })}
          disabled={options.style === 'formal'}
        />
      </DialogContent>
    </Dialog>
  );
}
