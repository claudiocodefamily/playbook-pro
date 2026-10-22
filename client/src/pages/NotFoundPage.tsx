import { Flag } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '../components/ui/empty-state';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Flag}
      title="Flag en la jugada: esta página no existe"
      description="Puede que el enlace esté mal o que ya no tengas acceso."
      action={
        <Link to="/" className="font-semibold text-turf-700 hover:underline">
          Volver a mis equipos
        </Link>
      }
    />
  );
}
