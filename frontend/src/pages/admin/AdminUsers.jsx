import React, { useEffect, useState } from "react";
import { api } from "../../lib/store";
import { Input } from "../../components/MobileShell";
import { Plus, Trash2 } from "lucide-react";
import { inr } from "../../lib/format";
import { toast } from "sonner";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", mobile: "", password: "", wallet: 0 });
  const [adj, setAdj] = useState({});
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try { setUsers(await api.adminGetUsers()); } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { refresh(); }, []);

  const add = async () => {
    if (!form.name || form.mobile.length !== 10) return toast.error("Name + 10-digit mobile required");
    setBusy(true);
    try {
      await api.adminAddUser({ ...form, wallet: Number(form.wallet) || 0 });
      setForm({ name: "", mobile: "", password: "", wallet: 0 });
      await refresh();
      toast.success("User added");
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    try { await api.adminDeleteUser(id); await refresh(); toast("User removed"); } catch (e) { toast.error(e.message); }
  };
  const adjust = async (id, delta) => {
    const d = Number(delta);
    if (!d) return;
    try { await api.adminAdjustUser(id, d, "Admin adjustment"); setAdj({ ...adj, [id]: "" }); await refresh(); toast.success("Wallet adjusted"); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-[#94A3B8] mt-1">Manage app users and wallet balances.</p>
      </header>

      <section className="bg-[#151923] border border-white/5 rounded-2xl p-4 sm:p-5">
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#94A3B8] mb-4">Add user</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input data-testid="add-user-name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input data-testid="add-user-mobile" placeholder="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          <Input data-testid="add-user-password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Input data-testid="add-user-wallet" placeholder="Wallet" type="number" value={form.wallet} onChange={(e) => setForm({ ...form, wallet: e.target.value })} />
        </div>
        <button data-testid="add-user-btn" disabled={busy} onClick={add} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#9333EA] text-black font-semibold rounded-xl hover:bg-[#7C3AED] disabled:opacity-50">
          <Plus className="w-4 h-4" /> Add
        </button>
      </section>

      <section className="bg-[#151923] border border-white/5 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-[#0D1119] text-[#94A3B8]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Mobile</th>
              <th className="px-4 py-3 text-left font-medium">Wallet</th>
              <th className="px-4 py-3 text-left font-medium">Adjust (₹)</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-white">{u.name}</td>
                <td className="px-4 py-3 text-[#94A3B8]">+91 {u.mobile}</td>
                <td className="px-4 py-3 text-[#9333EA] font-heading font-semibold">{inr(u.wallet)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Input data-testid={`adj-${u.id}`} placeholder="±amount" value={adj[u.id] || ""} onChange={(e) => setAdj({ ...adj, [u.id]: e.target.value })} className="!py-2 max-w-[120px]" />
                    <button onClick={() => adjust(u.id, adj[u.id])} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm">Apply</button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button data-testid={`del-user-${u.id}`} onClick={() => remove(u.id)} className="text-[#EF4444] p-2 rounded-lg hover:bg-[#EF4444]/10"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[#94A3B8]">No users yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
