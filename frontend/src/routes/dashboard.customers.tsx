import { createFileRoute } from "@tanstack/react-router";
import { Search, ChevronLeft, ChevronRight, Loader2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { dashboardApi, type DashCustomer, type DashCustomerProfile } from "@/lib/api";

export const Route = createFileRoute("/dashboard/customers")({ component: CustomersPage });

const PAGE_SIZE = 20;

function CustomersPage() {
  const [customers, setCustomers] = useState<DashCustomer[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DashCustomer | null>(null);
  const [profileDetail, setProfileDetail] = useState<DashCustomerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    dashboardApi.customers(500).then(setCustomers).catch(console.error);
  }, []);

  useEffect(() => {
    if (selected) {
      setLoadingProfile(true);
      dashboardApi.customerProfile(selected.customer_id)
        .then((res) => {
          setProfileDetail(res);
          setLoadingProfile(false);
        })
        .catch(() => {
          setProfileDetail(null);
          setLoadingProfile(false);
        });
    } else {
      setProfileDetail(null);
    }
  }, [selected]);

  const filtered = customers.filter((c) =>
    q
      ? c.customer_id.toString().includes(q) ||
        c.location.toLowerCase().includes(q.toLowerCase()) ||
        (c.full_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
        c.phone_number.includes(q)
      : true
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageView = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const startItem = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Profiles, risk scores, and empirical spending statistics.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search ID, name, phone or city…"
            className="w-64 bg-transparent py-1.5 text-xs outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main Customers Table with 20 items Pagination */}
        <div className="glass rounded-2xl p-4 lg:col-span-2 flex flex-col justify-between min-h-[580px]">
          <div>
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-white/5">
                  <th className="py-2 pr-3 font-medium">Customer</th>
                  <th className="py-2 pr-3 font-medium">Location</th>
                  <th className="py-2 pr-3 font-medium">Txns</th>
                  <th className="py-2 pr-3 font-medium">Avg Spend</th>
                  <th className="py-2 pr-3 font-medium">Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {pageView.length > 0 ? (
                  pageView.map((c) => {
                    const tone =
                      c.risk_score > 70
                        ? "bg-[color:var(--danger)]"
                        : c.risk_score > 40
                          ? "bg-[color:var(--warning)]"
                          : "bg-[color:var(--success)]";
                    const isSelected = selected?.customer_id === c.customer_id;
                    return (
                      <tr
                        key={c.customer_id}
                        onClick={() => setSelected(c)}
                        className={`cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors ${
                          isSelected ? "bg-white/[0.06]" : ""
                        }`}
                      >
                        <td className="py-2.5 pr-3 font-mono text-xs">
                          <div className="font-semibold text-white">{c.customer_id}</div>
                          <div className="text-[11px] text-muted-foreground">{c.full_name ?? c.phone_number}</div>
                        </td>
                        <td className="py-2.5 pr-3 text-muted-foreground">{c.location}</td>
                        <td className="py-2.5 pr-3 font-medium">{c.total_txns}</td>
                        <td className="py-2.5 pr-3">${c.avg_amount.toFixed(2)}</td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/5">
                              <div className={`h-full ${tone}`} style={{ width: `${c.risk_score}%` }} />
                            </div>
                            <span className="text-xs font-mono">{c.risk_score}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No customers match your search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls (20 Customers per Page) */}
          <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-medium text-white">{startItem}–{endItem}</span> of <span className="font-medium text-white">{filtered.length}</span> customers
            </div>

            <div className="flex items-center gap-2">
              <span className="mr-1">
                Page <span className="font-medium text-white">{currentPage}</span> of <span className="font-medium text-white">{totalPages}</span>
              </span>

              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Customer Detail & Real Baseline Profile Panel */}
        <div className="glass rounded-2xl p-5 min-h-[580px]">
          {selected ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Customer Profile</div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="rounded-full bg-cyan-500/10 p-2 text-cyan-400 border border-cyan-500/20">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-mono text-lg font-bold text-white">ID #{selected.customer_id}</div>
                    <div className="text-xs text-muted-foreground">
                      {selected.full_name ?? selected.phone_number} · {selected.location}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <Stat label="Total Txns" value={String(selected.total_txns)} />
                <Stat label="Avg Spend" value={`$${selected.avg_amount.toFixed(2)}`} />
                <Stat label="Terminals Used" value={String(selected.terminals_used)} />
                <Stat label="Risk Score" value={`${selected.risk_score}/100`} />
                {profileDetail?.mean_amount != null && (
                  <Stat label="Hist. Mean Spend" value={`$${profileDetail.mean_amount.toFixed(2)}`} />
                )}
                {profileDetail?.std_amount != null && (
                  <Stat label="Spend Variance" value={`$${profileDetail.std_amount.toFixed(2)}`} />
                )}
              </div>

              {/* Real Recent Transactions list */}
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Recent Account Transactions
                </div>

                {loadingProfile ? (
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" /> Fetching history...
                  </div>
                ) : profileDetail?.recent_transactions && profileDetail.recent_transactions.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {profileDetail.recent_transactions.map((tx) => (
                      <li
                        key={tx.transaction_id}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs"
                      >
                        <div>
                          <span className="font-mono text-[11px] text-muted-foreground">{tx.transaction_id.slice(0, 12)}…</span>
                          <div className="font-medium text-white">${tx.tx_amount.toFixed(2)}</div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              tx.status === "APPROVED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : tx.status === "DECLINED"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {tx.status}
                          </span>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {(tx.fraud_probability * 100).toFixed(0)}% prob
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2 text-xs text-muted-foreground py-3">No recent transactions recorded for this customer.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              {customers.length === 0 ? "Loading customers…" : "Select a customer from the table to view baseline details"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="mt-0.5 font-semibold text-white text-sm">{value}</div>
    </div>
  );
}
