import { useStoredImageUrl } from '../hooks';

export function ImageThumb({ imageId }: { imageId: string }) {
  const url = useStoredImageUrl(imageId);
  return url ? <img className="thumb" src={url} alt="" /> : <span className="thumb" />;
}
