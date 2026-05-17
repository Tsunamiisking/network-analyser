import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Select } from '../components/ui/select';
import { getProviderComparison, getBlackoutRate, getAggregatedHeatmap } from '../services/api';
import { SIGNAL_QUALITY } from '../config/api';

const PROVIDER_COLORS = {
  MTN: '#FCD34D', Airtel: '#F97316', Glo: '#22C55E', '9mobile': '#3B82F6',
};

// Compute signal quality distribution from aggregated heatmap cells
function buildQualityDist(cells) {
  const counts = Object.fromEntries(SIGNAL_QUALITY.map((t) => [t.label, 0]));
  cells.forEach((c) => {
    const dbm = c.medianSignalStrength;
    if (dbm > -85)      counts['Excellent']++;
    else if (dbm > -95) counts['Good']++;
    else if (dbm > -105) counts['Fair']++;
    else if (dbm > -115) counts['Poor']++;
    else                counts['Very Poor']++;
  });
  return SIGNAL_QUALITY.map((t) => ({ name: t.label, value: counts[t.label], color: t.color }));
}

function SectionTitle({ children }) {
  return <h2 className="text-base font-semibold text-gray-900">{children}</h2>;
}

export default function Analytics() {
  const [providers,  setProviders]  = useState([]);
  const [blackout,   setBlackout]   = useState([]);
  const [cells,      setCells]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [dateRange,  setDateRange]  = useState('all');

  const dateParams = (() => {
    const now = new Date();
    if (dateRange === '7d') {
      const s = new Date(now); s.setDate(s.getDate() - 7);
      return { startDate: s.toISOString(), endDate: now.toISOString() };
    }
    if (dateRange === '30d') {
      const s = new Date(now); s.setDate(s.getDate() - 30);
      return { startDate: s.toISOString(), endDate: now.toISOString() };
    }
    return {};
  })();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [provRes, blackRes, cellRes] = await Promise.allSettled([
          getProviderComparison(),
          getBlackoutRate(dateParams.startDate, dateParams.endDate),
          getAggregatedHeatmap(dateParams),
        ]);
        if (cancelled) return;
        if (provRes.status === 'fulfilled')  setProviders(provRes.value.data ?? []);
        if (blackRes.status === 'fulfilled') setBlackout(blackRes.value.data ?? []);
        if (cellRes.status === 'fulfilled')  setCells(cellRes.value.data ?? []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const qualityDist = buildQualityDist(cells);
  const totalCells = qualityDist.reduce((s, d) => s + d.value, 0);

  // Radar data: normalise each provider's signal to 0–100 scale
  // (-55 = 100, -130 = 0)
  const radarData = providers.map((p) => ({
    provider: p.provider,
    signal:   Math.round(Math.max(0, Math.min(100, ((p.averageSignal + 130) / 75) * 100))),
    samples:  p.totalSamples,
  }));

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Provider performance, coverage quality, and blackout analysis
          </p>
        </div>
        <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
          <option value="all">All time</option>
          <option value="30d">Last 30 days</option>
          <option value="7d">Last 7 days</option>
        </Select>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Row 1 — Signal strength + sample count */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avg signal strength */}
        <Card>
          <CardHeader>
            <SectionTitle>Average Signal Strength (dBm)</SectionTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-52 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={providers} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="provider" tick={{ fontSize: 12 }} />
                  <YAxis domain={[-130, -50]} tick={{ fontSize: 11 }} unit=" dBm" />
                  <Tooltip formatter={(v) => [`${v.toFixed(1)} dBm`, 'Avg Signal']} />
                  <Bar dataKey="averageSignal" radius={[4, 4, 0, 0]}>
                    {providers.map((p) => (
                      <Cell key={p.provider} fill={PROVIDER_COLORS[p.provider] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Signal strength is a latency-to-dBm proxy (Expo managed workflow limitation). 
              Closer to −55 dBm = stronger signal.
            </p>
          </CardContent>
        </Card>

        {/* Sample count */}
        <Card>
          <CardHeader>
            <SectionTitle>Sample Count by Provider</SectionTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-52 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={providers} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="provider" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [v.toLocaleString(), 'Measurements']} />
                  <Bar dataKey="totalSamples" radius={[4, 4, 0, 0]}>
                    {providers.map((p) => (
                      <Cell key={p.provider} fill={PROVIDER_COLORS[p.provider] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2 — Blackout rate + quality distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blackout rate */}
        <Card>
          <CardHeader>
            <SectionTitle>Blackout Rate (%)</SectionTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-52 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            ) : blackout.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={blackout}
                  margin={{ top: 4, right: 24, left: 20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="provider" tick={{ fontSize: 12 }} width={52} />
                  <Tooltip formatter={(v) => [`${v.toFixed(2)}%`, 'Blackout Rate']} />
                  <Bar dataKey="blackoutRate" radius={[0, 4, 4, 0]}>
                    {blackout.map((p) => (
                      <Cell
                        key={p.provider}
                        fill={p.blackoutRate > 15 ? '#EF4444' : p.blackoutRate > 5 ? '#F97316' : '#22C55E'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Blackout = measurement where device had no data connection (connectivityFlag = false).
            </p>
          </CardContent>
        </Card>

        {/* Signal quality distribution pie */}
        <Card>
          <CardHeader>
            <SectionTitle>Coverage Quality Distribution</SectionTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-52 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            ) : totalCells === 0 ? (
              <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No aggregated data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={qualityDist.filter((d) => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                      }
                      labelLine={false}
                    >
                      {qualityDist.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [v, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-xs text-gray-400 mt-1">
                  Based on {totalCells.toLocaleString()} geohash cells (aggregated heatmap).
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — Provider radar + raw table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar — signal quality score per provider */}
        <Card>
          <CardHeader>
            <SectionTitle>Signal Quality Score (0–100)</SectionTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-52 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="provider" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar
                      name="Signal Score"
                      dataKey="signal"
                      stroke="#3B82F6"
                      fill="#3B82F6"
                      fillOpacity={0.25}
                    />
                    <Tooltip formatter={(v) => [`${v}/100`, 'Score']} />
                  </RadarChart>
                </ResponsiveContainer>
                <p className="text-xs text-gray-400 mt-2">
                  Normalised from raw dBm: −55 dBm = 100, −130 dBm = 0.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Data table */}
        <Card>
          <CardHeader>
            <SectionTitle>Provider Summary Table</SectionTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'hsl(var(--border))' }}>
                  {['Provider', 'Avg Signal', 'Samples', 'Blackout %'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">Loading…</td>
                  </tr>
                ) : providers.map((p) => {
                  const bData = blackout.find((b) => b.provider === p.provider);
                  return (
                    <tr
                      key={p.provider}
                      className="border-b last:border-0"
                      style={{ borderColor: 'hsl(var(--border))' }}
                    >
                      <td className="px-4 py-3 font-medium">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: PROVIDER_COLORS[p.provider] ?? '#94a3b8' }}
                          />
                          {p.provider}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700">
                        {p.averageSignal.toFixed(1)} dBm
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {p.totalSamples.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {bData ? (
                          <span
                            className="font-medium"
                            style={{
                              color: bData.blackoutRate > 15 ? '#EF4444' : bData.blackoutRate > 5 ? '#F97316' : '#22C55E',
                            }}
                          >
                            {bData.blackoutRate.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
