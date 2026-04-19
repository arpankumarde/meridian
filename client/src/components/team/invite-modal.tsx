"use client";

import { useState, useEffect } from "react";
import { LuMail, LuLock, LuLoader, LuUserPlus, LuUser} from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface InviteModalProps {
  onClose: () => void;
  onSuccess: () => void;
  orgId: string | null;
}

export default function InviteModal({ onClose, onSuccess, orgId }: InviteModalProps) {
  useEffect(() => {
    if (!orgId) {
      toast.error("Organization context missing. Please try logging in again.");
      onClose();
    }
  }, [orgId, onClose]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("All fields are required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite member");

      toast.success("Member added successfully");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-obs-border">
        <div className="relative p-8">
          <DialogHeader className="mb-8">
            <DialogTitle className="text-xl font-display font-semibold text-text mb-1">
              Invite Team Member
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary">
              Add a new collaborator to your organization.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[10px] uppercase tracking-widest font-bold text-text-secondary">
                Full Name
              </Label>
              <div className="relative">
                <LuUser className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm" />
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g. John Doe"
                  className="pl-10 h-11 border-obs-border focus:border-amber bg-surface"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] uppercase tracking-widest font-bold text-text-secondary">
                Email Address
              </Label>
              <div className="relative">
                <LuMail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className="pl-10 h-11 border-obs-border focus:border-amber bg-surface"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] uppercase tracking-widest font-bold text-text-secondary">
                Initial Password
              </Label>
              <div className="relative">
                <LuLock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-11 border-obs-border focus:border-amber bg-surface"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="flex-1 h-11 font-bold uppercase tracking-widest text-[11px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 h-11 bg-amber hover:bg-amber-hover text-white font-bold uppercase tracking-widest text-[11px] gap-2 shadow-sm"
              >
                {loading ? (
                  <LuLoader className="animate-spin" />
                ) : (
                  <LuUserPlus className="text-lg" />
                )}
                Add Member
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
