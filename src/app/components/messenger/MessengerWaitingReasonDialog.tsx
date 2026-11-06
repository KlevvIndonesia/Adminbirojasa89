import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { AlertCircle, Clock } from "lucide-react";
import { WAITING_REASONS, SAMSAT_WAITING_REASONS, WaitingReason, SamsatWaitingReason } from "../../../domain/messenger/types";
import { toast } from "sonner";

interface MessengerWaitingReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  reasons?: readonly string[];
  onSubmit: (reason: any, note?: string) => void;
  isSubmitting?: boolean;
}

export function MessengerWaitingReasonDialog({
  open,
  onOpenChange,
  title = "Pilih Alasan Status Menunggu",
  description = "Status Menunggu memerlukan alasan wajib yang terstruktur.",
  reasons = SAMSAT_WAITING_REASONS,
  onSubmit,
  isSubmitting = false,
}: MessengerWaitingReasonDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      setError("Alasan menunggu wajib dipilih");
      toast.error("Alasan menunggu wajib dipilih");
      return;
    }

    setError(null);
    onSubmit(selectedReason as WaitingReason);
    setSelectedReason("");
  };

  const handleCancel = () => {
    setError(null);
    setSelectedReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              Alasan Menunggu <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedReason}
              onValueChange={(val) => {
                setSelectedReason(val as WaitingReason);
                setError(null);
              }}
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="-- Pilih Alasan Menunggu --" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((reason) => (
                  <SelectItem key={reason} value={reason} className="text-xs">
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Status Menunggu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
