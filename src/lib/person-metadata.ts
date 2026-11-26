import type { Metadata } from 'next';
import { getVisiblePerson } from '@/lib/family-service';
import { formatOtherNames } from '@/lib/other-names';
import { SITE_NAME, personHeading, personTitle } from '@/lib/person-title';
const DESCRIPTION_LENGTH = 160;

/**
 * Link previews (Open Graph and X cards) for a person's address. They are read by crawlers, which
 * never sign in, so only a public person is described; a private or missing person gets the
 * site's own preview, which reveals nothing about them.
 */
export async function personMetadata(id: string): Promise<Metadata> {
  let person;
  try {
    person = await getVisiblePerson(id);
  } catch {
    return { title: SITE_NAME };
  }

  const title = personHeading(person);
  const names = [
    person.courtesyName && `字${person.courtesyName}`,
    person.artName && `号${person.artName}`,
    person.otherNames?.length ? `又名${formatOtherNames(person.otherNames)}` : '',
  ].filter(Boolean);
  const text = [names.join('，'), person.description?.replace(/\s+/g, ' ').trim()].filter(Boolean).join('。');
  const description =
    (text.length > DESCRIPTION_LENGTH ? `${text.slice(0, DESCRIPTION_LENGTH - 1)}…` : text) || `${SITE_NAME}中的${person.name}`;
  // The avatar, or the site's preview image; both are served to anyone for a public person
  const image = person.avatar ?? '/opengraph-image';

  return {
    title: personTitle(person),
    description,
    openGraph: { type: 'profile', siteName: SITE_NAME, title, description, images: [{ url: image, alt: person.name }] },
    twitter: { card: 'summary', title, description, images: [image] },
  };
}
