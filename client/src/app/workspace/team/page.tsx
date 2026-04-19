"use client";

import { useState, useEffect, useCallback } from "react";
import { LuMail, LuEllipsisVertical, LuPlus, LuLoader, LuUser, LuTrash2 } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import InviteModal from "@/components/team/invite-modal";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Member {
  id: string;
  name?: string;
  email: string;
  createdAt: string;
}

const MAX_MEMBERS = 5;

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMembers = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/organizations/${id}/members`);
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || "Failed to fetch team members");
      }
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load team members");
      console.error("[TeamPage] fetchMembers error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedOrgId = localStorage.getItem("meridian_org_id");
    if (storedOrgId) {
      setOrgId(storedOrgId);
      fetchMembers(storedOrgId);
    } else {
      setLoading(false);
    }
  }, [fetchMembers]);

  const getDisplayName = (member: Member) => {
    if (member.name) return member.name;
    const namePart = member.email.split("@")[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  };

  const getInitials = (member: Member) => {
    if (member.name) {
      return member.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
    }
    return member.email.substring(0, 2).toUpperCase();
  };

  const atCapacity = members.length >= MAX_MEMBERS;

  const handleInviteClick = () => {
    if (atCapacity) {
      toast.error(`Maximum of ${MAX_MEMBERS} members allowed per workspace.`);
      return;
    }
    setShowInviteModal(true);
  };

  const handleDelete = async () => {
    if (!pendingDelete || !orgId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/members/${pendingDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to remove member");

      toast.success("Member removed");
      setPendingDelete(null);
      fetchMembers(orgId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h2 className="text-3xl font-display font-semibold mb-2">Team Management</h2>
          <p className="text-text-secondary text-sm">
            Invite and manage collaborators in your workspace.{" "}
            <span className="font-mono text-[11px] text-text-muted">
              {members.length}/{MAX_MEMBERS} members
            </span>
          </p>
        </div>
        <Button
          onClick={handleInviteClick}
          disabled={atCapacity}
          className="gap-2 bg-amber hover:bg-amber-hover text-white shadow-sm font-bold uppercase tracking-widest text-[11px] h-11 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LuPlus className="text-lg" />
          {atCapacity ? "Limit Reached" : "Invite Member"}
        </Button>
      </div>

      <div className="bg-white border border-obs-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-text-muted">
            <LuLoader className="text-3xl animate-spin mb-4" />
            <p className="font-mono text-[11px] uppercase tracking-[0.2em]">Synchronizing Registry...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-surface border border-obs-border rounded-2xl flex items-center justify-center mb-6">
              <LuUser className="text-3xl text-text-muted" />
            </div>
            <h3 className="text-lg font-semibold text-text mb-2">No team members yet</h3>
            <p className="text-sm text-text-secondary max-w-xs mx-auto mb-8">
              Start building your research group by inviting collaborators to this organization.
            </p>
            <Button
              variant="outline"
              onClick={handleInviteClick}
              className="font-bold uppercase tracking-widest text-[10px] border-obs-border"
            >
              Add First Member
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-obs-border">
            {members.map((member) => (
              <div key={member.id} className="p-6 flex items-center justify-between hover:bg-surface/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber/10 text-amber border border-amber/20 flex items-center justify-center font-bold text-xs">
                    {getInitials(member)}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-text">
                      {getDisplayName(member)}
                    </h4>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-text-secondary font-mono">
                        <LuMail className="text-[12px] opacity-60" /> {member.email}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="hidden md:block px-2.5 py-0.5 rounded-full bg-emerald/5 border border-emerald/20 text-[9px] font-mono font-bold text-emerald uppercase tracking-tighter">
                      Active
                   </div>
                   <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                       <Button variant="ghost" size="icon" className="text-text-muted hover:text-text rounded-full hover:bg-white border border-transparent hover:border-obs-border transition-all">
                        <LuEllipsisVertical />
                      </Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end" className="w-44">
                       <DropdownMenuItem
                         onClick={() => setPendingDelete(member)}
                         className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer gap-2"
                       >
                         <LuTrash2 className="text-sm" />
                         Remove member
                       </DropdownMenuItem>
                     </DropdownMenuContent>
                   </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showInviteModal && (
        <InviteModal
          orgId={orgId}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => orgId && fetchMembers(orgId)}
        />
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `This will permanently remove ${getDisplayName(pendingDelete)} (${pendingDelete.email}) from your workspace. This action cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
