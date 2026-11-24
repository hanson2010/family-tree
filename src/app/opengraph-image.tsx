import { ImageResponse } from 'next/og';
import { BRAND_GLYPH_PATH } from '@/components/BrandMark';

export const alt = '家谱';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The site's link-preview image: the logo's 族 on the brand colour, drawn from its outline so no
// font is needed. Persons without an avatar use it too.
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#b5402a' }}>
        <svg width="420" height="420" viewBox="0 0 100 100" fill="#f8fafc">
          <path d={BRAND_GLYPH_PATH} />
        </svg>
      </div>
    ),
    size
  );
}
