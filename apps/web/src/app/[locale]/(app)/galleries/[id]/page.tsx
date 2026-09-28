import { use } from 'react';
import { GalleryDetailView } from '@/components/gallery/gallery-detail-view';

export default function GalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <GalleryDetailView id={id} />;
}
