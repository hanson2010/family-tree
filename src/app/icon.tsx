import { ImageResponse } from 'next/og';
import { BRAND_GLYPH_PATH } from '@/components/BrandMark';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

// The same outline as the page logo, so the tab icon is centred without depending on a font
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#b5402a',
          borderRadius: '6px',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 100 100" fill="#f8fafc">
          <path d={BRAND_GLYPH_PATH} />
        </svg>
      </div>
    ),
    size
  );
}
