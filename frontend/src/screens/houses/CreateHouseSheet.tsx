import type { House } from '../../api/types';
import { Sheet } from '../../components/Sheet';
import CreateHouseForm from './CreateHouseForm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (house: House) => void;
}

export default function CreateHouseSheet({ open, onOpenChange, onCreated }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Create a house">
      <CreateHouseForm onCreated={onCreated} />
    </Sheet>
  );
}
