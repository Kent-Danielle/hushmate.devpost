import type { House } from '../../api/types';
import { Sheet } from '../../components/Sheet';
import JoinByIdForm from './JoinByIdForm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequested: (house: House) => void;
}

export default function JoinByIdSheet({ open, onOpenChange, onRequested }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Join a house">
      <JoinByIdForm onRequested={onRequested} />
    </Sheet>
  );
}
