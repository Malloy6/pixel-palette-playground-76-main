import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSafaricomMpesaPhone } from "@/lib/mpesa-phone";

type MpesaPhoneDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (phone: string) => void;
};

export function MpesaPhoneDialog({ open, onOpenChange, onSubmit }: MpesaPhoneDialogProps) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setPhone("");
      setError("");
    }
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSafaricomMpesaPhone(phone)) {
      setError("Enter 12 digits starting with 254, for example 254712345678.");
      return;
    }

    onOpenChange(false);
    onSubmit(phone);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-3xl border-border bg-card p-0 sm:max-w-md">
        <div className="h-1.5 bg-[image:var(--gradient-hero)]" />
        <div className="p-6 sm:p-8">
          <DialogHeader className="items-center text-center">
            <div className="mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Smartphone className="h-7 w-7" aria-hidden="true" />
            </div>
            <DialogTitle className="text-2xl font-bold">Pay with M-Pesa</DialogTitle>
            <DialogDescription className="max-w-sm">
              Enter the Safaricom number that should receive your secure payment prompt.
            </DialogDescription>
          </DialogHeader>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="mpesa-phone">Safaricom phone number</Label>
              <Input
                id="mpesa-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="254712345678"
                maxLength={12}
                pattern="254(10|11|70|71|72|74|75|76|79)[0-9]{7}"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value.replace(/\D/g, "").slice(0, 12));
                  if (error) setError("");
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "mpesa-phone-error" : "mpesa-phone-hint"}
                className="h-12 rounded-xl bg-background"
                autoFocus
              />
              {error ? (
                <p id="mpesa-phone-error" className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : (
                <p id="mpesa-phone-hint" className="text-sm text-muted-foreground">
                  Enter 254 followed by your 9-digit mobile number. Use digits only, with no + or
                  leading 0.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              Keep your phone nearby. Enter your M-Pesa PIN only on the Safaricom prompt.
            </div>

            <Button type="submit" size="lg" className="h-12 w-full rounded-xl">
              Send payment prompt
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
