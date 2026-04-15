import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SignatureCanvas from "./SignatureCanvas";

export default function SignatureDialog({ open, onOpenChange, contractTitle, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assinatura Digital</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Contrato: <span className="font-medium text-foreground">{contractTitle}</span>
          </p>
        </DialogHeader>

        <div className="py-2">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm text-amber-800">
            ⚠️ Ao confirmar, você declara estar de acordo com todos os termos do contrato. Esta assinatura tem validade legal.
          </div>
          <SignatureCanvas
            onSign={onConfirm}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}