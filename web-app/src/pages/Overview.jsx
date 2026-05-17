import { useState, useEffect } from 'react';
import { Activity, FileText, Smartphone, Wifi } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardValue, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  getProviderComparison,
  getReports,
  getHeatmapData,
  getBlackoutRate,
} from '../services/api';
import { getSignalTier } from '../config/api';

const PROVIDER_COLORS = {
  MTN: '#FCD34D',
  Airtel: '#F97316',
  Glo: '#22C55E',
  '9mobile': '#3B82F6',
};

function StatCard({ icon: Icon, label, value, sub, iconColor = 'text-blue-600' }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{label}</CardTitle>
          <Icon size={16} className={iconColor} />
        </div>
      </CardHeader>
      <CardContent>
        <CardValue>{value ?? '—'}</CardValue>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString();
}

export default function Overview() {
  const [providers, setProviders]   = useState([]);
  const [reports, setReports]       = useState([]);
  const [totalMeas, setTotalMeas]   = useState(null);
  const [blackout, setBlackout]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [provRes, repRes, measRes, blackRes] = await Promise.allSettled([
          getProviderComparison(),
          getReports(),
          getHeatmapData(),
          getBlackoutRate(),
        ]);
        if (cancelled) return;
        if (provRes.status === 'fulfilled') setProviders(provRes.value.data ?? []);
        if (repRes.status === 'fulfilled')  setReports(repRes.value.data ?? []);
        if (measRes.status === 'fulfilled') setTotalMeas(measRes.value.count ?? 0);
        if (blackRes.status === 'fulfilled') setBlackout(blackRes.value.data ?? []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const timer = setInterval(load, 60000); // auto-refresh every 60s
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // Shift dBm by +130 so bars grow from 0 upward (stronger signal = taller bar).
  // Tooltip/axis formatters convert back to dBm for display.
  const chartProviders = providers.map((p) => ({ ...p, signalScore: p.averageSignal + 130 }));

  const totalSamples = providers.reduce((s, p) => s + (p.totalSamples ?? 0), 0);
  const bestProvider = providers[0];
  const recentReports = [...reports].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
  ).slice(0, 8);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Live network intelligence for Nigerian carrier coverage
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Could not load data: {error} — is the backend running?
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Total Measurements"
          value={loading ? '…' : totalMeas?.toLocaleString()}
          sub="all time"
        />
        <StatCard
          icon={FileText}
          label="Manual Reports"
          value={loading ? '…' : reports.length.toLocaleString()}
          sub="all time"
          iconColor="text-orange-500"
        />
        <StatCard
          icon={Smartphone}
          label="Carriers Tracked"
          value={loading ? '…' : providers.length}
          sub="MTN · Airtel · Glo · 9mobile"
          iconColor="text-green-600"
        />
        <StatCard
          icon={Wifi}
          label="Best Carrier (avg)"
          value={loading ? '…' : (bestProvider?.provider ?? '—')}
          sub={bestProvider ? `${bestProvider.averageSignal.toFixed(1)} dBm avg` : undefined}
          iconColor="text-purple-600"
        />
      </div>

      {/* Provider signal chart + blackout rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">
              Avg Signal Strength by Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartProviders} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="provider" tick={{ fontSize: 12 }} />
                  <YAxis
                    domain={[0, 80]}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v - 130} dBm`}
                  />
                  <Tooltip
                    formatter={(v) => [`${(v - 130).toFixed(1)} dBm`, 'Avg Signal']}
                    labelFormatter={(l) => `Provider: ${l}`}
                  />
                  <Bar dataKey="signalScore" radius={[4, 4, 0, 0]}>
                    {chartProviders.map((p) => (
                      <Cell key={p.provider} fill={PROVIDER_COLORS[p.provider] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Blackout rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">
              Blackout Rate by Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            ) : blackout.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
            ) : (
              <div className="space-y-3 pt-2">
                {blackout.map((p) => (
                  <div key={p.provider} className="flex items-center gap-3">
                    <span className="w-16 text-sm font-medium text-gray-700">{p.provider}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(p.blackoutRate, 100)}%`,
                          backgroundColor: p.blackoutRate > 15 ? '#EF4444' : p.blackoutRate > 5 ? '#F97316' : '#22C55E',
                        }}
                      />
                    </div>
                    <span className="w-14 text-right text-sm text-gray-600">
                      {p.blackoutRate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400">({p.totalSamples ?? p.totalMeasurements} pts)</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provider sample breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900">
            Sample Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-gray-400 text-sm">Loading…</div>
          ) : (
            <div className="space-y-2">
              {providers.map((p) => {
                const pct = totalSamples > 0 ? (p.totalSamples / totalSamples) * 100 : 0;
                const tier = getSignalTier(p.averageSignal);
                return (
                  <div key={p.provider} className="flex items-center gap-3">
                    <span className="w-16 text-sm font-medium">{p.provider}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: PROVIDER_COLORS[p.provider] ?? '#94a3b8' }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm text-gray-600">{p.totalSamples.toLocaleString()}</span>
                    <Badge
                      style={{ backgroundColor: tier.color + '20', color: tier.color, borderColor: tier.color + '40' }}
                      className="border text-xs"
                    >
                      {tier.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent reports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900">Recent Manual Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-gray-400 text-sm">Loading…</div>
          ) : recentReports.length === 0 ? (
            <div className="text-gray-400 text-sm py-4 text-center">No reports yet</div>
          ) : (
            <div className="space-y-2">
              {recentReports.map((r) => (
                <div
                  key={r._id}
                  className="flex items-start gap-3 rounded-md border px-3 py-2"
                  style={{ borderColor: 'hsl(var(--border))' }}
                >
                  <div
                    className="mt-0.5 h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: PROVIDER_COLORS[r.provider] ?? '#94a3b8' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{r.issueType}</span>
                      <Badge variant="outline" className="text-xs">{r.provider}</Badge>
                      {r.description && (
                        <span className="text-xs text-gray-500 truncate max-w-xs">{r.description}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {timeAgo(r.timestamp)}
                      {r.occurredAt && r.occurredAt !== r.timestamp && (
                        <span className="ml-2 italic">
                          (occurred {timeAgo(r.occurredAt)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
