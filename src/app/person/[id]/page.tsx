import type { Metadata } from 'next';
import { FamilyTreeApp } from '@/components/FamilyTreeApp';
import { personMetadata } from '@/lib/person-metadata';

type Params = { params: Promise<{ id: string }> };

// Link previews for the person (see person-metadata.ts)
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return personMetadata(decodeURIComponent((await params).id));
}

// The family tree centered on this person
export default async function PersonPage({ params }: Params) {
  return <FamilyTreeApp personId={decodeURIComponent((await params).id)} />;
}
